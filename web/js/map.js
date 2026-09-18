// 作者：肖沐樑　QQ：3387432690
// 完成时间：2026，09，18
// 百度地图 JS API 封装：加载脚本 / 初始化 / 等时圈热力图 / POI 标记
// 无浏览器端 AK 时地图不可用，但右侧图表与清单仍可演示

let dangqianMap = null;

function zairuBaidu(ak) {
  return new Promise((resolve) => {
    if (window.BMap) return resolve();
    const s = document.createElement('script');
    s.src = `https://api.map.baidu.com/api?v=3.0&ak=${ak}&callback=__baiDuInit`;
    window.__baiDuInit = () => {
      const h = document.createElement('script');
      h.src = 'https://api.map.baidu.com/library/Heatmap/2.0/src/Heatmap_min.js';
      h.onload = resolve; h.onerror = resolve;
      document.head.appendChild(h);
    };
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

// 返回带兼容方法的包装对象，便于 index.html 用统一接口调用
function chushihuaDitu(ak) {
  if (!ak || !window.BMap) return null;
  const map = new BMap.Map('map');
  map.centerAndZoom(new BMap.Point(116.404, 39.915), 12);
  dangqianMap = map;
  return {
    raw: map,
    addEventListener: (ev, cb) => map.addEventListener(ev, (e) =>
      cb({ latlng: { lat: e.point.lat, lng: e.point.lng } })),
    setView: (p, z) => map.centerAndZoom(new BMap.Point(p[1], p[0]), z),
  };
}

function huatReheat(dengshiquan) {
  if (!dangqianMap || !window.BMapLib || !BMapLib.HeatmapOverlay) return;
  const yu = dengshiquan.shichang || 900;
  const data = (dengshiquan.houxuan || []).map((d) => ({
    lng: d.jingdu, lat: d.weidu,
    count: Math.max(0, Math.round((1 - d.shichang / yu) * 100)),
  }));
  const heat = new BMapLib.HeatmapOverlay({ radius: 25, visible: true });
  dangqianMap.addOverlay(heat);
  heat.setDataSet({ data, max: 100 });
}

function huaBiaoji(poiMap) {
  if (!dangqianMap) return;
  const yanse = { '菜市场': '#e74c3c', '药店': '#27ae60', '小学': '#2980b9',
                  '社区医院': '#8e44ad', '公园': '#16a085', '银行': '#f39c12' };
  Object.keys(poiMap || {}).forEach((ming) => {
    (poiMap[ming] || []).forEach((p) => {
      const mk = new BMap.Marker(new BMap.Point(p.jingdu, p.weidu));
      const label = new BMap.Label(ming, { offset: new BMap.Size(8, -4) });
      mk.setLabel(label);
      dangqianMap.addOverlay(mk);
    });
  });
}
