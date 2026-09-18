// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 地图可视化：支持两种底图引擎
//   ① 百度地图（BMapGL）—— 需有效 AK
//   ② 开源瓦片（DiTuCanvas）—— 不依赖任何 AK，百度不可用时自动降级
// 两种引擎均叠加：等时圈热力分层 / 设施散点 / 服务盲区 / 体检中心
import React, { useEffect, useRef, useState } from 'react';
import { loadBmap } from './loadBmap.js';
import { DiTuCanvas } from './DiTuCanvas.jsx';
import { wgs84ZhuanBd09, bd09ZhuanWgs84 } from '../core/geo/zuobiao.js';

// 应用内部统一 WGS-84；百度底图需要 BD-09，绘制与拾取时转换
const Z = (p) => wgs84ZhuanBd09(p.lng, p.lat);

const COLOR = {
  yiliao: '#ff6b6b',
  jiaoyu: '#ffd166',
  gouwu: '#3ddc97',
  yanglao: '#b18cff',
  jiaotong: '#2f9bff',
  xiuxian: '#4ecdc4',
};
const MI_CAISE = { 300: '#3ddc97', 600: '#2f9bff', 900: '#ff6b6b' };
const MI_OPA = { 300: 0.34, 600: 0.22, 900: 0.12 };

function svgIcon(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function MapCanvas({ report, center, onPick, xianshi, ditu = 'baidu', onDitu }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const onPickRef = useRef(onPick);
  const ziFaRef = useRef(null); // 由地图点击产生的中心点，避免重复居中造成视图跳动
  const [engine, setEngine] = useState(ditu === 'tile' ? 'tile' : 'loading');
  onPickRef.current = onPick;

  // 初始化百度地图
  useEffect(() => {
    if (ditu !== 'baidu') {
      setEngine('tile');
      return undefined;
    }
    let cancelled = false;
    let readyTimer = 0;

    function chuShiHua(B) {
      if (cancelled || !mapDivRef.current) return;
      try {
        const map = new B.Map(mapDivRef.current, { enableMapClick: false });
        map.enableScrollWheelZoom(true);
        map.centerAndZoom(new B.Point(center.lng, center.lat), 15);
        mapRef.current = { map, B };
        map.addEventListener('click', (e) => {
          const ll = e.latlng || e.point;
          if (!ll || !onPickRef.current) return;
          // 百度返回 BD-09，转回内部 WGS-84 后再回传
          const p = bd09ZhuanWgs84(ll.lng, ll.lat);
          ziFaRef.current = p; // 标记来源，绘制时不再重复居中
          onPickRef.current(p);
        });
        const ro = new ResizeObserver(() => map.resize && map.resize());
        ro.observe(mapDivRef.current);
        setEngine('baidu');
        // 底图瓦片 5 秒内未加载完成（AK 被限流时百度瓦片会一直不来）→ 自动切换开源底图
        readyTimer = setTimeout(() => {
          if (cancelled) return;
          try {
            map.destroy && map.destroy();
          } catch {
            /* 忽略 */
          }
          mapRef.current = null;
          if (onDitu) onDitu('tile');
          else setEngine('tile');
        }, 5000);
        map.addEventListener('tilesloaded', () => clearTimeout(readyTimer));
      } catch (e) {
        // 百度不可用 → 开源瓦片，并同步顶栏选择，避免状态与实际不一致
        if (onDitu) onDitu('tile');
        else setEngine('tile');
      }
    }

    setEngine('loading');
    loadBmap()
      .then((B) => {
        if (cancelled || !B || !B.Map) {
          if (!cancelled) {
            if (onDitu) onDitu('tile');
            else setEngine('tile');
          }
          return;
        }
        if (!mapDivRef.current || !mapDivRef.current.clientWidth) {
          setTimeout(() => chuShiHua(B), 80);
          return;
        }
        chuShiHua(B);
      })
      .catch(() => {
        if (cancelled) return;
        // 百度脚本加载失败 → 切开源瓦片并同步顶栏
        if (onDitu) onDitu('tile');
        else setEngine('tile');
      });
    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      if (mapRef.current && mapRef.current.map.destroy) mapRef.current.map.destroy();
      mapRef.current = null;
    };
  }, [ditu]);

  // 重绘叠加层
  useEffect(() => {
    if (engine === 'baidu' && mapRef.current) drawBaidu();
  }, [engine, report, center, xianshi]);

  function clearOv() {
    const { map } = mapRef.current;
    overlaysRef.current.forEach((o) => map.removeOverlay(o));
    overlaysRef.current = [];
  }
  function add(o) {
    overlaysRef.current.push(o);
    mapRef.current.map.addOverlay(o);
  }

  function drawBaidu() {
    const { map, B } = mapRef.current;
    const c0 = Z(center);
    // 若中心点来自地图自身点击，不重复居中（否则画面会整体平移，观感为乱跳）
    const z = ziFaRef.current;
    const ziFa = z && Math.abs(z.lng - center.lng) < 1e-9 && Math.abs(z.lat - center.lat) < 1e-9;
    if (!ziFa) map.setCenter(new B.Point(c0.lng, c0.lat));
    clearOv();

    // ① 等时圈热力分层（外→内，内层叠于上方更亮）
    const ceng = (report?.dengShiQuan?.ceng || []).slice().sort((a, b) => b.miao - a.miao);
    for (const c of ceng) {
      const col = MI_CAISE[c.miao] || '#2f9bff';
      const opa = MI_OPA[c.miao] || 0.18;
      for (const ring of c.polygon) {
        const pts = ring.map((p) => {
          const q = Z(p);
          return new B.Point(q.lng, q.lat);
        });
        if (!pts.length) continue;
        add(
          new B.Polygon(pts, {
            strokeColor: '#e6ecf5',
            strokeWeight: 1,
            strokeOpacity: 0.55,
            fillColor: col,
            fillOpacity: opa,
          })
        );
      }
    }

    // ② POI 散点
    const poiSet = report?.poiSet;
    const icons = {};
    for (const f of Object.keys(COLOR)) {
      if (xianshi && !xianshi[f]) continue;
      if (!icons[f]) {
        icons[f] = new B.Icon(
          svgIcon(
            `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><circle cx='7' cy='7' r='5' fill='${COLOR[f]}' stroke='#0f1420' stroke-width='2'/></svg>`
          ),
          new B.Size(14, 14)
        );
      }
      const list = (poiSet?.fenleiSet?.[f] || []).slice(0, 90);
      for (const p of list) {
        const q = Z(p);
        add(new B.Marker(new B.Point(q.lng, q.lat), { icon: icons[f] }));
      }
    }

    // ③ 服务盲区点位
    for (const mq of report?.mangquList || []) {
      if (mq.polygon && mq.polygon.length > 2) {
        const pts = mq.polygon.map((p) => {
          const q = Z(p);
          return new B.Point(q.lng, q.lat);
        });
        add(
          new B.Polygon(pts, {
            strokeColor: '#ff6b6b',
            strokeWeight: 2,
            strokeOpacity: 0.9,
            fillColor: '#ff6b6b',
            fillOpacity: 0.3,
          })
        );
      } else {
        const r = Math.max(80, Math.sqrt((mq.areaM2 || 400000) / Math.PI));
        const q = Z(mq.zhongxin);
        add(
          new B.Circle(new B.Point(q.lng, q.lat), r, {
            strokeColor: '#ff6b6b',
            strokeWeight: 2,
            fillColor: '#ff6b6b',
            fillOpacity: 0.3,
          })
        );
      }
    }

    // ④ 体检中心
    add(
      new B.Marker(new B.Point(c0.lng, c0.lat), {
        icon: new B.Icon(
          svgIcon(
            `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='7' fill='#3ddc97' stroke='#fff' stroke-width='3'/></svg>`
          ),
          new B.Size(24, 24)
        ),
      })
    );
    const lb = new B.Label('体检中心', { offset: new B.Size(14, -10) });
    lb.setPosition(new B.Point(c0.lng, c0.lat));
    add(lb);
  }

  return (
    <div className="map-view">
      {engine === 'baidu' && <div ref={mapDivRef} className="map-inner" />}
      {engine === 'tile' && (
        <DiTuCanvas report={report} center={center} onPick={onPick} xianshi={xianshi} />
      )}
      {engine === 'loading' && (
        <div className="map-loading">
          <span>地图加载中…</span>
          {onDitu && (
            <button type="button" className="link-btn" onClick={() => onDitu('tile')}>
              改用瓦片底图
            </button>
          )}
        </div>
      )}
    </div>
  );
}
