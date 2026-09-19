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
  xiuxian: '#e64980',
};
const MI_CAISE = { 300: '#3ddc97', 600: '#2f9bff', 900: '#ff6b6b' };
const MI_OPA = { 300: 0.34, 600: 0.22, 900: 0.12 };

function svgIcon(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function simpleKey(obj) {
  return JSON.stringify(obj);
}

export const MapCanvas = React.memo(function MapCanvas({ report, center, onPick, xianshi, ditu = 'baidu', onDitu }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ iso: [], poi: [], blind: [], center: [] });
  const keysRef = useRef({ iso: '', poi: '', blind: '', center: '' });
  const onPickRef = useRef(onPick);
  const ziFaRef = useRef(null); // 由地图点击产生的中心点，避免重复居中造成视图跳动
  const [engine, setEngine] = useState(ditu === 'tile' ? 'tile' : 'loading');
  const drawTimerRef = useRef(0);
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
        // 底图瓦片 3 秒内未加载完成（AK 被风控时百度瓦片会一直不来）→ 停止等待并提示，不再降级非百度底图
        readyTimer = setTimeout(() => {
          if (cancelled) return;
          setEngine('error');
        }, 3000);
        map.addEventListener('tilesloaded', () => clearTimeout(readyTimer));
      } catch (e) {
        // 百度初始化异常 → 提示错误（赛道要求必须使用百度地图，不降级第三方底图）
        setEngine('error');
      }
    }

    setEngine('loading');
    loadBmap()
      .then((B) => {
        if (cancelled || !B || !B.Map) {
          if (!cancelled) setEngine('error');
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
        // 百度脚本加载失败 → 提示错误（赛道要求必须使用百度地图，不降级第三方底图）
        setEngine('error');
      });
    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      if (mapRef.current && mapRef.current.map.destroy) mapRef.current.map.destroy();
      mapRef.current = null;
    };
  }, [ditu]);

  // 重绘叠加层：防抖 80ms，避免连续状态更新触发多次全量绘制
  useEffect(() => {
    if (engine !== 'baidu' || !mapRef.current) return;
    clearTimeout(drawTimerRef.current);
    drawTimerRef.current = setTimeout(() => drawBaidu(), 80);
    return () => clearTimeout(drawTimerRef.current);
  }, [engine, report, center, xianshi]);

  function clearLayer(name) {
    if (!mapRef.current) return;
    const { map } = mapRef.current;
    (layersRef.current[name] || []).forEach((o) => map.removeOverlay(o));
    layersRef.current[name] = [];
  }
  function addTo(name, o) {
    layersRef.current[name].push(o);
    mapRef.current.map.addOverlay(o);
  }

  function drawBaidu() {
    const { map, B } = mapRef.current;
    const c0 = Z(center);
    // 若中心点来自地图自身点击，不重复居中（否则画面会整体平移，观感为乱跳）
    const z = ziFaRef.current;
    const ziFa = z && Math.abs(z.lng - center.lng) < 1e-9 && Math.abs(z.lat - center.lat) < 1e-9;
    if (!ziFa) map.setCenter(new B.Point(c0.lng, c0.lat));

    // ① 等时圈热力分层：仅当数据变化时重建
    const isoKey = simpleKey(report?.dengShiQuan?.ceng);
    if (isoKey !== keysRef.current.iso) {
      keysRef.current.iso = isoKey;
      clearLayer('iso');
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
          addTo(
            'iso',
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
    }

    // ② POI 散点：仅当 POI 数据或图层显隐变化时重建
    const poiSet = report?.poiSet;
    const poiKey = simpleKey({
      counts: Object.fromEntries(Object.keys(COLOR).map((f) => [f, (poiSet?.fenleiSet?.[f] || []).length])),
      xianshi,
    });
    if (poiKey !== keysRef.current.poi) {
      keysRef.current.poi = poiKey;
      clearLayer('poi');
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
          addTo('poi', new B.Marker(new B.Point(q.lng, q.lat), { icon: icons[f] }));
        }
      }
    }

    // ③ 服务盲区点位
    const blindKey = simpleKey((report?.mangquList || []).map((m) => m.id));
    if (blindKey !== keysRef.current.blind) {
      keysRef.current.blind = blindKey;
      clearLayer('blind');
      for (const mq of report?.mangquList || []) {
        if (mq.polygon && mq.polygon.length > 2) {
          const pts = mq.polygon.map((p) => {
            const q = Z(p);
            return new B.Point(q.lng, q.lat);
          });
          addTo(
            'blind',
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
          addTo(
            'blind',
            new B.Circle(new B.Point(q.lng, q.lat), r, {
              strokeColor: '#ff6b6b',
              strokeWeight: 2,
              fillColor: '#ff6b6b',
              fillOpacity: 0.3,
            })
          );
        }
      }
    }

    // ④ 体检中心：中心点变化时重建，避免每次 pan 都清掉
    const centerKey = `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`;
    if (centerKey !== keysRef.current.center) {
      keysRef.current.center = centerKey;
      clearLayer('center');
      // 定位图钉（24x30），anchor 设在尖端 (12,30) 使其精确指向坐标
      addTo(
        'center',
        new B.Marker(new B.Point(c0.lng, c0.lat), {
          icon: new B.Icon(
            svgIcon(
              `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='30' viewBox='0 0 24 30'><ellipse cx='12' cy='28.6' rx='5' ry='1.5' fill='rgba(15,23,42,0.28)'/><path d='M12 0C5.9 0 1 4.9 1 11c0 7.4 9.6 17.4 10.1 17.9.3.3.9.3 1.2 0C13.4 28.4 23 18.4 23 11 23 4.9 18.1 0 12 0z' fill='#1f6feb' stroke='#ffffff' stroke-width='1.5'/><circle cx='12' cy='11' r='4.2' fill='#ffffff'/></svg>`
            ),
            new B.Size(24, 30),
            { anchor: new B.Size(12, 30) }
          ),
        })
      );
    }
  }

  return (
    <div className="map-view">
      {engine === 'baidu' && <div ref={mapDivRef} className="map-inner" />}
      {engine === 'tile' && (
        <DiTuCanvas report={report} center={center} onPick={onPick} xianshi={xianshi} />
      )}
      {engine === 'loading' && (
        <div className="map-loading">
          <span>百度地图加载中…</span>
        </div>
      )}
      {engine === 'error' && (
        <div className="map-loading">
          <span>百度地图加载失败：请检查 .env 中 VITE_BMAP_AK 配置、百度控制台 Referer 白名单及网络，然后刷新重试。</span>
          <button type="button" className="link-btn" onClick={() => window.location.reload()}>
            刷新重试
          </button>
        </div>
      )}
    </div>
  );
});
