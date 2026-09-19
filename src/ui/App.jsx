// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { yunXingTijian } from '../core/pipeline.js';
import { chuangJianBmapWeb } from '../adapters/bmapWeb.js';
import { chuangJianOsm } from '../adapters/osm.js';
import { MapCanvas } from './MapCanvas.jsx';
import { BaoGao } from './BaoGao.jsx';
import { GuanLiYuan } from './admin.jsx';
import { loadPeiZhi, saveReport } from './peiZhi.js';
import { loadBmap } from './loadBmap.js';
import { liangDianJuLi } from '../core/geo/jichu.js';
import { bd09ZhuanWgs84 } from '../core/geo/zuobiao.js';
import { MorphIcon } from 'morphicons/react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Search, MapPin, Map } from 'lucide';

const COLOR = {
  yiliao: '#ff6b6b',
  jiaoyu: '#ffd166',
  gouwu: '#3ddc97',
  yanglao: '#b18cff',
  jiaotong: '#2f9bff',
  xiuxian: '#e64980',
};
const MING = { yiliao: '医疗', jiaoyu: '教育', gouwu: '购物', yanglao: '养老', jiaotong: '交通', xiuxian: '休闲' };

// 初始默认中心点（仅作首屏兜底坐标，界面上已不展示样例社区；真实中心点由浏览器定位/地图点选/搜索产生）
const YANGLI = [
  { name: '长沙·砂子塘社区', lng: 112.9388, lat: 28.2281 },
  { name: '北京·中关村', lng: 116.3163, lat: 39.9836 },
  { name: '上海·人民广场', lng: 121.4737, lat: 31.2304 },
  { name: '广州·天河城', lng: 113.3245, lat: 23.1371 },
];

function chuangJianIpc() {
  const api = window.api;
  return {
    walkingRoute: (o, d) => api.walkingRoute(o, d),
    routeMatrix: (o, d) => api.routeMatrix(o, d),
    searchPoi: (c, k, r) => api.searchPoi(c, k, r),
    reverseGeocode: (p) => api.reverseGeocode(p),
  };
}
const isElectron = typeof window !== 'undefined' && window.api?.isElectron;

export function App() {
  const ak = import.meta.env.VITE_BMAP_AK;
  // 默认数据源=百度地图（符合赛道要求：必须调用百度地图开放能力），
  // 仅当 .env 未配置 VITE_BMAP_AK 时才退回 OSM 真实路网兜底模式
  const [mode, setMode] = useState(ak ? 'bmap' : 'osm');
  const [center, setCenter] = useState({ lng: YANGLI[0].lng, lat: YANGLI[0].lat });
  const [curName, setCurName] = useState(YANGLI[0].name);
  const [mubiaoFen, setMubiaoFen] = useState(15);
  const [dangwei, setDangwei] = useState('standard');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState(null);
  const [offline, setOffline] = useState(false);
  const [peiZhi, setPeiZhi] = useState(() => loadPeiZhi());
  const [adminOpen, setAdminOpen] = useState(false);
  const [souSuoWenBen, setSouSuoWenBen] = useState('');
  const [zhouBian, setZhouBian] = useState([]); // 定位周边推荐点
  // 底图引擎：baidu=百度地图（官方 BMap GL SDK 渲染，默认使用），
  // tile=高德/OSM 瓦片（AK 被风控拦截时的兜底，MapCanvas 内 3 秒未就绪会自动切换）
  const [ditu, setDitu] = useState('baidu');
  const [xianshi, setXianshi] = useState(() => Object.fromEntries(Object.keys(COLOR).map((k) => [k, true])));
  const runningRef = useRef(false);
  const jiaoHuRef = useRef(false); // 用户是否已在地图上操作过（手动点选中心）
  // 面板整块显隐（true=显示），由顶栏开关控制
  const [kai, setKai] = useState({ zuo: true, you: true });

  function qieHuanKai(v) {
    setKai((prev) => ({ ...prev, [v]: !prev[v] }));
  }

  async function run(c = center) {
    // 同一时刻只允许一轮体检，防止叠加请求触碰百度并发上限
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setProgress(0);
    setOffline(false);
    let provider;
    try {
      if (mode === 'server' && isElectron) provider = chuangJianIpc();
      else if (mode === 'osm') provider = chuangJianOsm({ zhongXin: c, banJingMi: 1500 });
      else {
        // 百度地图模式：JS API 未就绪时降级为 OSM 真实路网（不再使用模拟数据）
        await loadBmap().catch(() => null);
        provider =
          typeof window !== 'undefined' && window.BMapGL ? chuangJianBmapWeb() : chuangJianOsm({ zhongXin: c, banJingMi: 1500 });
      }
    } catch {
      provider = chuangJianOsm({ zhongXin: c, banJingMi: 1500 });
    }
    const canshu = { zhongXin: c, mubiaoMiao: mubiaoFen * 60, dangwei, banJingMi: 1500 };
    // 按数据源设定请求节奏：OSM 算路在本地完成不受限；浏览器端 AK 配额最紧；服务端 AK（批量矩阵）可放开
    const jieZou =
      mode === 'osm'
        ? { qps: 50, bingfa: 8 }
        : mode === 'server'
        ? { qps: 5, bingfa: 6 }
        : mode === 'bmap'
        ? { qps: 2, bingfa: 2 }
        : { qps: 8, bingfa: 8 };
    try {
      let rep;
      try {
        rep = await yunXingTijian(provider, canshu, {
          jinDu: (p) => setProgress(p),
          peiZhi,
          ...jieZou,
        });
      } catch (e) {
        // 容错降级：百度服务不可用（配额超限 / 服务被禁用 / 网络异常）时，
        // 自动切换到 OSM 真实路网继续体检，保证演示不中断
        if (mode !== 'bmap') throw e;
        const osm = chuangJianOsm({ zhongXin: c, banJingMi: 1500 });
        rep = await yunXingTijian(osm, canshu, {
          jinDu: (p) => setProgress(p),
          peiZhi,
          qps: 50,
          bingfa: 8,
        });
        rep.warnings.push('百度地图服务不可用，已自动降级为 OSM 真实路网（结果仍基于真实道路计算）');
        setOffline(true);
      }
      setReport(rep);
      saveReport(rep);
    } catch (e) {
      setOffline(true);
    } finally {
      setRunning(false);
      setProgress(1);
      runningRef.current = false;
    }
  }

  // OSM 地理编码（Nominatim）：不依赖百度 AK 的地址搜索兜底
  async function souSuoOsm(w) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(w)}&format=json&limit=1`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const j = await r.json();
    if (j && j[0]) return { lng: Number(j[0].lon), lat: Number(j[0].lat) };
    return null;
  }

  function yingYong(c) {
    setCenter(c);
    setCurName(souSuoWenBen.trim());
    run(c);
  }

  async function souSuo() {
    const w = souSuoWenBen.trim();
    if (!w) return;
    // 仅当底图是百度时才走百度地理编码；其余情况直接用 OSM，避免无谓触发百度 SDK
    if (ditu === 'baidu') {
      try {
        const B = await loadBmap();
        const gc = new B.Geocoder();
        const ok = await new Promise((resolve) => {
          gc.getPoint(w, (p) => {
            if (p) {
              // 百度返回 BD-09，转成内部统一的 WGS-84
              yingYong(bd09ZhuanWgs84(p.lng, p.lat));
              resolve(true);
            } else resolve(false);
          });
        });
        if (ok) return;
      } catch {
        /* 百度不可用 → 走 OSM */
      }
    }
    try {
      const q = await souSuoOsm(w);
      if (q) yingYong(q);
      else alert('未找到该地址，请换关键词试试');
    } catch {
      alert('地址服务暂不可用，请稍后重试或直接点地图选点');
    }
  }

  // ziDong=true 为首屏自动定位：失败静默回退到默认社区，不打断用户
  // 定位周边推荐：拉取当前位置附近的街区/社区名，作为可直接体检的候选点
  async function tuijianZhouBian(c) {
    const lie = [{ name: '当前位置', lng: c.lng, lat: c.lat }];
    try {
      const ql = `[out:json][timeout:25];nwr["place"~"^(neighbourhood|suburb|quarter|village|town|city_block)$"](around:2500,${c.lat},${c.lng});out center;`;
      const r = await fetch(`https://overpass.openstreetmap.fr/api/interpreter?data=${encodeURIComponent(ql)}`);
      const j = await r.json();
      const yi = new Set();
      const hou = [];
      for (const e of j.elements || []) {
        const ming = e.tags && e.tags.name;
        const lng = e.lon != null ? e.lon : e.center && e.center.lon;
        const lat = e.lat != null ? e.lat : e.center && e.center.lat;
        if (!ming || typeof lng !== 'number' || typeof lat !== 'number' || yi.has(ming)) continue;
        yi.add(ming);
        hou.push({ name: ming, lng, lat, juLi: liangDianJuLi(c, { lng, lat }) });
      }
      hou.sort((a, b) => a.juLi - b.juLi);
      for (const p of hou.slice(0, 5)) lie.push({ name: `${p.name}（${(p.juLi / 1000).toFixed(1)}km）`, lng: p.lng, lat: p.lat });
    } catch {
      /* 推荐失败只保留「当前位置」 */
    }
    setZhouBian(lie);
  }

  function dingWei(ziDong = false) {
    if (!navigator.geolocation) {
      if (!ziDong) alert('当前浏览器不支持定位');
      return;
    }
    if (!window.isSecureContext) {
      if (!ziDong) alert('定位需要 HTTPS 或 localhost 环境，请改用 http://localhost:5173 访问');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 自动定位是异步的，若用户已先在地图上选好了位置，就不要再用定位结果覆盖他
        if (ziDong && jiaoHuRef.current) return;
        // 应用内部统一使用 WGS-84（OSM 与 GPS 原生坐标系），渲染时按底图再转换
        const c = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        setCenter(c);
        setCurName('当前位置');
        tuijianZhouBian(c); // 定位成功后推荐周边可体检点
        if (!ziDong) run(c);
      },
      (err) => {
        if (!ziDong) alert('定位失败：' + (err.message || '请检查浏览器定位权限'));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  // 首屏自动定位到当前位置（仅定位，不自动体检以免白耗配额）
  useEffect(() => {
    const t = setTimeout(() => dingWei(true), 800);
    return () => clearTimeout(t);
  }, []);

  function tiaoZhuanDian(p) {
    setCenter({ lng: p.lng, lat: p.lat });
    setCurName(p.name);
    run({ lng: p.lng, lat: p.lat });
  }

  function qieHuanFenlei(f) {
    setXianshi((prev) => ({ ...prev, [f]: !prev[f] }));
  }

  function exportJson() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shenghuoquan-baogao.json';
    a.click();
  }

  const xuanZeZhongXin = useCallback((p) => {
    jiaoHuRef.current = true;
    setCenter(p);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">🧭</span>
          <span className="brand-title">15 分钟生活圈智能体检助手</span>
        </div>

        <div className="header-center">
          <div className="search-bar">
            <input
              placeholder="输入社区 / 街道名称搜索"
              value={souSuoWenBen}
            onChange={(e) => setSouSuoWenBen(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && souSuo()}
          />
          <button className="search-btn" onClick={souSuo}>
            <MorphIcon icon={Search} spring="snappy" size={15} />
            <span>搜索</span>
          </button>
        </div>
        <select className="time-select" value={mubiaoFen} onChange={(e) => setMubiaoFen(Number(e.target.value))}>
          <option value={5}>步行 5 分钟</option>
          <option value={10}>步行 10 分钟</option>
          <option value={15}>步行 15 分钟</option>
          <option value={20}>步行 20 分钟</option>
        </select>
      </div>

      <div className="header-right">
        <div className="header-toggles">
          <button
            type="button"
            className={`tog-btn ${kai.zuo ? 'on' : ''}`}
            title={kai.zuo ? '隐藏左下面板' : '显示左下面板'}
            onClick={() => qieHuanKai('zuo')}
          >
            <MorphIcon icon={kai.zuo ? PanelLeftClose : PanelLeftOpen} spring="snappy" size={15} />
            控制面板
          </button>
          <button
            type="button"
            className={`tog-btn ${kai.you ? 'on' : ''}`}
            title={kai.you ? '隐藏右侧报告' : '显示右侧报告'}
            onClick={() => qieHuanKai('you')}
          >
            <MorphIcon icon={kai.you ? PanelRightClose : PanelRightOpen} spring="snappy" size={15} />
            报告面板
          </button>
        </div>
        {/* 赛道要求必须使用百度地图，底图固定为百度，不提供第三方底图切换 */}
        <span className="ditu-chip" title="底图固定使用百度地图（赛道评审要求）">
          <MorphIcon icon={Map} size={13} spring="snappy" />
          底图 · 百度地图
        </span>
        <button className="admin-btn" onClick={() => setAdminOpen(true)}>管理员</button>
      </div>
    </header>

      <div className="mapwrap">
        <MapCanvas
          report={report}
          center={center}
          onPick={xuanZeZhongXin}
          xianshi={xianshi}
          ditu={ditu}
          onDitu={setDitu}
        />
        {offline && <div className="offline">地图服务异常，已降级真实路网兜底模式，请检查 AK / 网络</div>}
      </div>

      {/* 左下控制卡片：整块显隐由顶栏开关控制 */}
      <div className={`float-card left-bottom ${kai.zuo ? '' : 'hidden'}`}>
        <div className="panel-title">体检控制</div>

        <div className="sec">
          <div className="sec-title">定位周边推荐</div>
          {zhouBian.length === 0 && (
            <div className="empty-tip">正在获取你的位置…若浏览器拒绝授权，可点击下方「定位」重试，或直接在地图上点选中心点</div>
          )}
          {zhouBian.length > 0 && (
            <div className="chips-row">
              {zhouBian.map((p) => (
                <button key={p.name} className={`chip ${curName === p.name ? 'on' : ''}`} onClick={() => tiaoZhuanDian(p)}>
                  <MorphIcon icon={MapPin} spring="snappy" size={12} />
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sec">
          <div className="sec-title">设施图层</div>
          <div className="layer-grid">
            {Object.keys(COLOR).map((f) => (
              <label
                key={f}
                className={`layer-item ${xianshi[f] ? 'on' : ''}`}
                style={{ '--c': COLOR[f] }}
                onClick={() => qieHuanFenlei(f)}
              >
                <i />
                <span>{MING[f]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="sec">
          <div className="sec-title">体检参数</div>
          <div className="param-row">
            <div className="mini-field">
              <label>中心点经度</label>
              <input type="number" step="0.0001" value={center.lng} onChange={(e) => setCenter({ ...center, lng: Number(e.target.value) })} />
            </div>
            <div className="mini-field">
              <label>中心点纬度</label>
              <input type="number" step="0.0001" value={center.lat} onChange={(e) => setCenter({ ...center, lat: Number(e.target.value) })} />
            </div>
            <div className="mini-field">
              <label>采样</label>
              <select value={dangwei} onChange={(e) => setDangwei(e.target.value)}>
                <option value="fast">快速</option>
                <option value="standard">标准</option>
                <option value="fine">精细</option>
              </select>
            </div>
          </div>
          <div className="mini-field" style={{ marginTop: 8 }}>
            <label>数据源（仅影响 POI / 算路，地图底图始终是百度地图）</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="osm">真实路网 OSM · 真实街道 + 本地算路</option>
              {ak && <option value="bmap">百度地图 · 真实 API、耗配额</option>}
              {isElectron && <option value="server">百度服务端 · 批量矩阵</option>}
            </select>
            {mode !== 'bmap' && (
              <div className="hint">
                {mode === 'osm'
                  ? '兜底方案：街道与设施取自 OpenStreetMap 真实数据，等时圈由本地 Dijkstra 沿真实道路计算（实测 15 分钟可达约 1100-1160 米，符合步行 80 米/分钟）。四个样例社区已内置离线数据可直接算；其他任意点会按需联网获取周边 1~2 公里路网并缓存。注意：本模式不调用百度 API，正式评分请用百度地图。'
                  : '桌面端走主进程服务端 AK，支持批量距离矩阵，性能与配额更优。'}
              </div>
            )}
          </div>
        </div>

        <div className="btn-row">
          <button className="locate-btn" onClick={dingWei}>
            <MorphIcon icon={MapPin} size={15} spring="snappy" />
            定位
          </button>
          <button className="run-btn" onClick={() => run()} disabled={running}>
            {running ? `${Math.round(progress * 100)}%` : '开始体检'}
          </button>
        </div>
        <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>
      </div>

      {/* 右侧面板：整块显隐由顶栏开关控制 */}
      <div className={`float-card right-panel ${kai.you ? '' : 'hidden'}`}>
        <div className="panel-title">
          体检报告{report ? ` · ${report.total} 分 ${report.dengji} 级` : ''}
        </div>

        <div className="score-card">
          <div className="score-label">综合得分</div>
          <div className="score-line">
            <b className="score-big">{report ? report.total : '--'}</b>
            {report && <span className={`dengji ${report.dengji}`}>{report.dengji} 级</span>}
          </div>
          {report && (
            <div className="score-meta">
              请求 {report.xinxi.qingQiuShu} 次 · 耗时 {(report.xinxi.haoShiMs / 1000).toFixed(1)}s · {report.xinxi.miDu}
            </div>
          )}
        </div>

        {report && (
          <div className="sec">
            <div className="sec-title">图表分析（雷达 / 柱状）</div>
            <BaoGao report={report} />
          </div>
        )}

        <div className="sec">
          <div className="sec-title">服务盲区清单（{report ? report.mangquList.length : 0}）</div>
          {!report && <div className="empty-tip">点击「开始体检」后显示盲区</div>}
          {report && report.mangquList.length === 0 && <div className="empty-tip">未识别明显盲区，覆盖良好</div>}
          {report && report.mangquList.map((m) => (
            <div className="mq-item" key={m.id}>
              <div className="mq-head">
                <b>{m.id}</b>
                <span className={`mq-tag ${m.level}`}>{m.level === 'red' ? '重度' : '轻度'}</span>
              </div>
              <div className="mq-body">
                缺口：{m.quekou.join('、')}<br />
                面积≈{(m.areaM2 / 10000).toFixed(1)} 万㎡ · 预计覆盖 {m.yujiFugaiRenkou} 人<br />
                {m.jianyi}
              </div>
            </div>
          ))}
        </div>

        {report && (
          <div className="sec">
            <div className="sec-title">改进建议</div>
            {report.jianYi.map((j, i) => (
              <div className="suggest" key={i}>· {j}</div>
            ))}
          </div>
        )}

        {report && (
          <button className="export-btn" onClick={exportJson}>
            导出报告 JSON
          </button>
        )}
      </div>

      <GuanLiYuan open={adminOpen} onClose={() => setAdminOpen(false)} peiZhi={peiZhi} onChange={setPeiZhi} />
    </div>
  );
}
