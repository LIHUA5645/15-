// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 开源瓦片底图引擎：不依赖百度 AK，直接绘制真实地图瓦片并叠加等时圈/设施/盲区
// 采用 Web Mercator 投影，与瓦片坐标系一致，叠加层与底图严格对齐
import React, { useCallback, useEffect, useRef } from 'react';

const TILE = 256;

// 瓦片源（按国内可用性排序：高德最快且有中文注记，失败自动切 OSM）
const WA_YUAN = [
  (z, x, y) => `https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`,
  (z, x, y) => `https://a.tile.openstreetmap.fr/hot/${z}/${x}/${y}.png`,
];

const COLOR = {
  yiliao: '#ff6b6b',
  jiaoyu: '#f4b400',
  gouwu: '#22a06b',
  yanglao: '#8b5cf6',
  jiaotong: '#2f9bff',
  xiuxian: '#0ea5a4',
};
const MI_CAISE = { 300: '#22a06b', 600: '#2f9bff', 900: '#ff6b6b' };
const MI_OPA = { 300: 0.3, 600: 0.2, 900: 0.11 };

function lngLatToWorld(lng, lat, z) {
  const scale = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}
function worldToLngLat(x, y, z) {
  const scale = TILE * 2 ** z;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    lng: (x / scale) * 360 - 180,
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
  };
}

export function DiTuCanvas({ report, center, onPick, xianshi }) {
  const wrapRef = useRef(null);
  const cvsRef = useRef(null);
  const stRef = useRef({ z: 15, cx: 0, cy: 0, yuan: 0 });
  const tilesRef = useRef(new Map());
  const dragRef = useRef(null);
  const rafRef = useRef(0);
  const shiBaiRef = useRef(new Set()); // 已失败的瓦片（按源区分）
  const jiShuRef = useRef(0); // 当前源失败次数
  const ziFaRef = useRef(null); // 由地图自身点击产生的中心点（避免自己点完又强行居中，导致视图跳动）

  const draw = useCallback(() => {
    const cvs = cvsRef.current;
    const wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (!W || !H) return;
    if (cvs.width !== W * dpr || cvs.height !== H * dpr) {
      cvs.width = W * dpr;
      cvs.height = H * dpr;
      cvs.style.width = W + 'px';
      cvs.style.height = H + 'px';
    }
    const ctx = cvs.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const st = stRef.current;
    const z = st.z;
    const ox = st.cx - W / 2;
    const oy = st.cy - H / 2;

    // ① 瓦片
    const x0 = Math.floor(ox / TILE);
    const x1 = Math.floor((ox + W) / TILE);
    const y0 = Math.floor(oy / TILE);
    const y1 = Math.floor((oy + H) / TILE);
    const zuiDa = 2 ** z;
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= zuiDa) continue;
        const wx = ((tx % zuiDa) + zuiDa) % zuiDa;
        const key = `${z}/${wx}/${ty}`;
        let img = tilesRef.current.get(key);
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, tx * TILE - ox, ty * TILE - oy, TILE, TILE);
        } else if (!img) {
          const biao = `${st.yuan}|${key}`;
          if (shiBaiRef.current.has(biao)) continue; // 已失败过，避免无限重试
          img = new Image();
          // 注意：不能设置 crossOrigin。瓦片服务器不返回 CORS 头，
          // 设了会导致图片加载全部失败；画布只做 drawImage 不需要读取像素。
          const k = st.yuan;
          img.src = WA_YUAN[k](z, wx, ty);
          img.onload = () => jianGeChongHua();
          img.onerror = () => {
            tilesRef.current.delete(key);
            shiBaiRef.current.add(biao);
            jiShuRef.current += 1;
            // 同一源累计失败 6 次 → 切换下一个瓦片源并重试
            if (jiShuRef.current >= 6 && st.yuan + 1 < WA_YUAN.length) {
              st.yuan += 1;
              jiShuRef.current = 0;
              tilesRef.current.clear();
              shiBaiRef.current.clear();
            }
            jianGeChongHua();
          };
          tilesRef.current.set(key, img);
        }
      }
    }

    // ② 等时圈（外→内叠加，形成热力分层）
    const toXY = (p) => {
      const w = lngLatToWorld(p.lng, p.lat, z);
      return { x: w.x - ox, y: w.y - oy };
    };
    const ceng = (report?.dengShiQuan?.ceng || []).slice().sort((a, b) => b.miao - a.miao);
    for (const c of ceng) {
      for (const ring of c.polygon || []) {
        ctx.beginPath();
        ring.forEach((pt, i) => {
          const { x, y } = toXY(pt);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.globalAlpha = MI_OPA[c.miao] || 0.18;
        ctx.fillStyle = MI_CAISE[c.miao] || '#2f9bff';
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // ③ 设施散点
    const poiSet = report?.poiSet;
    if (poiSet) {
      for (const f of Object.keys(COLOR)) {
        if (xianshi && !xianshi[f]) continue;
        for (const p of (poiSet.fenleiSet?.[f] || []).slice(0, 120)) {
          const { x, y } = toXY(p);
          ctx.beginPath();
          ctx.arc(x, y, 3.4, 0, Math.PI * 2);
          ctx.fillStyle = COLOR[f];
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // ④ 服务盲区
    for (const mq of report?.mangquList || []) {
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#ff6b6b';
      ctx.strokeStyle = '#d13438';
      ctx.lineWidth = 1.6;
      if (mq.polygon && mq.polygon.length > 2) {
        ctx.beginPath();
        mq.polygon.forEach((pt, i) => {
          const { x, y } = toXY(pt);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (mq.zhongxin) {
        const { x, y } = toXY(mq.zhongxin);
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ⑤ 体检中心
    const c = toXY(center);
    ctx.beginPath();
    ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#3ddc97';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.font = '12px sans-serif';
    ctx.fillText('体检中心', c.x + 12, c.y - 8);
  }, [report, center, xianshi]);

  function jianGeChongHua() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      draw();
    });
  }

  // 中心点变化 → 视图居中
  // 但若这次中心点就是「用户刚点地图产生的」，则不再居中，否则每点一次画面整体平移，观感就是乱跳
  useEffect(() => {
    const z = ziFaRef.current;
    const ziFa =
      z && Math.abs(z.lng - center.lng) < 1e-9 && Math.abs(z.lat - center.lat) < 1e-9;
    if (!ziFa) {
      const st = stRef.current;
      const w = lngLatToWorld(center.lng, center.lat, st.z);
      st.cx = w.x;
      st.cy = w.y;
    }
    jianGeChongHua();
  }, [center]);

  useEffect(() => {
    jianGeChongHua();
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => jianGeChongHua());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  function xiaBiao(e) {
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  }
  function yiDong(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const st = stRef.current;
    st.cx -= dx;
    st.cy -= dy;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: d.moved };
    jianGeChongHua();
  }
  function taiQi(e) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.moved || !onPick) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const st = stRef.current;
    const ox = st.cx - wrapRef.current.clientWidth / 2;
    const oy = st.cy - wrapRef.current.clientHeight / 2;
    const p = worldToLngLat(ox + (e.clientX - rect.left), oy + (e.clientY - rect.top), st.z);
    ziFaRef.current = p; // 标记：该中心点来自地图点击
    onPick(p);
  }
  function gunLun(e) {
    e.preventDefault();
    const st = stRef.current;
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ox = st.cx - wrapRef.current.clientWidth / 2;
    const oy = st.cy - wrapRef.current.clientHeight / 2;
    const di = worldToLngLat(ox + mx, oy + my, st.z);
    const nz = Math.max(3, Math.min(19, st.z + (e.deltaY < 0 ? 1 : -1)));
    st.z = nz;
    tilesRef.current.clear();
    const nw = lngLatToWorld(di.lng, di.lat, nz);
    st.cx = nw.x + (wrapRef.current.clientWidth / 2 - mx);
    st.cy = nw.y + (wrapRef.current.clientHeight / 2 - my);
    jianGeChongHua();
  }

  return (
    <div className="map-tile-layer" ref={wrapRef}>
      <canvas
        ref={cvsRef}
        className="map-tile"
        onMouseDown={xiaBiao}
        onMouseMove={yiDong}
        onMouseUp={taiQi}
        onMouseLeave={() => (dragRef.current = null)}
        onWheel={gunLun}
      />
      <div className="map-attri">© OpenStreetMap contributors</div>
    </div>
  );
}
