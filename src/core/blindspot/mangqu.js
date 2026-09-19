// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 服务盲区识别：候选网格 → 居住性过滤 → 粗筛 → 精算 → DBSCAN 聚类 → 补建建议
import { liangDianJuLi, chuangJianWangGe } from '../geo/jichu.js';

const R_WAI = 2000; // 外扩半径（米）
const CUCAI_BU = { fast: 300, standard: 200, fine: 150 };
const FEI_JUZHU = ['water', 'green', 'industry', 'railway', 'river', 'park'];
const T_MUBIAO = 900; // 15 分钟

// 取某维度最近 POI 的直线距离
function zuiJinJuLi(dian, poiList) {
  let min = Infinity;
  for (const p of poiList) {
    const d = liangDianJuLi(dian, p);
    if (d < min) min = d;
  }
  return min;
}

// DBSCAN 聚类：用栅格索引替代 O(n²) 全量扫描
function dbscan(dianLie, eps, minPts) {
  const n = dianLie.length;
  if (n === 0) return [];
  const visited = new Array(n).fill(false);
  const cluster = new Array(n).fill(-1);
  let cid = 0;
  const wangGe = chuangJianWangGe(dianLie, eps);
  const quYu = (i) => wangGe.zaiBanJingNei(dianLie[i], eps).map((it) => it.i);
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const nei = quYu(i);
    if (nei.length < minPts) continue;
    cluster[i] = cid;
    const queue = nei.slice();
    while (queue.length) {
      const q = queue.pop();
      if (!visited[q]) {
        visited[q] = true;
        const nq = quYu(q);
        if (nq.length >= minPts) queue.push(...nq);
      }
      if (cluster[q] === -1) cluster[q] = cid;
    }
    cid++;
  }
  return cluster;
}

async function shiBieMangQu(provider, canShu, poiSet, opt = {}) {
  const { zhongXin } = canShu;
  const dangwei = canShu.dangwei || 'standard';
  const bu = CUCAI_BU[dangwei] || 200;
  const xl = opt.xianliu || { run: (f) => f() };

  // 1. 候选网格（在经纬度上近似偏移，仅用于候选采样）
  const grid = [];
  for (let dx = -R_WAI; dx <= R_WAI; dx += bu) {
    for (let dy = -R_WAI; dy <= R_WAI; dy += bu) {
      const lat = zhongXin.lat + dy / 110540;
      const lng = zhongXin.lng + dx / (111320 * Math.cos((zhongXin.lat * Math.PI) / 180));
      grid.push({ lng, lat, dx, dy });
    }
  }

  // 2. 居住性过滤 + 3. 粗筛
  const xuYao = []; // 需要精算的点
  const poigouwu = poiSet.fenleiSet.gouwu || [];
  const poiyiliao = poiSet.fenleiSet.yiliao || [];
  const poijiaoyu = poiSet.fenleiSet.jiaoyu || [];
  for (const g of grid) {
    // 居住性过滤
    try {
      const rg = await provider.reverseGeocode(g);
      if (rg && FEI_JUZHU.includes(rg.poiType)) continue;
    } catch {
      /* 忽略，默认居住 */
    }
    const dCai = zuiJinJuLi(g, poigouwu);
    const dYao = zuiJinJuLi(g, poiyiliao);
    const dXiao = zuiJinJuLi(g, poijiaoyu);
    // 三类直线皆 >800m → 可能盲区，需精算；否则认为覆盖
    if (dCai > 800 || dYao > 800 || dXiao > 800) {
      g._d = { caiShiChang: dCai, yaoDian: dYao, xiaoXue: dXiao };
      xuYao.push(g);
    }
  }

  // 4. 精算：批量距离矩阵优先
  const mangquDian = [];
  if (xuYao.length && typeof provider.routeMatrix === 'function') {
    const dests = [
      ...poigouwu.map((p) => ({ lng: p.lng, lat: p.lat })),
      ...poiyiliao.map((p) => ({ lng: p.lng, lat: p.lat })),
      ...poijiaoyu.map((p) => ({ lng: p.lng, lat: p.lat })),
    ];
    const matrix = await xl.run(() => provider.routeMatrix(xuYao, dests));
    if (matrix) {
      for (let k = 0; k < xuYao.length; k++) {
        const row = matrix[k];
        const cai = Math.min(...row.slice(0, poigouwu.length).map((m) => m.durationSec));
        const yao = Math.min(
          ...row.slice(poigouwu.length, poigouwu.length + poiyiliao.length).map((m) => m.durationSec)
        );
        const xiao = Math.min(
          ...row.slice(poigouwu.length + poiyiliao.length).map((m) => m.durationSec)
        );
        if (cai > T_MUBIAO && yao > T_MUBIAO && xiao > T_MUBIAO) mangquDian.push(xuYao[k]);
      }
    }
  }
  // 无矩阵能力时降级：用直线×1.35 估算
  if (!mangquDian.length) {
    for (const g of xuYao) {
      const cai = (g._d.caiShiChang * 1.35) / (80 / 60);
      const yao = (g._d.yaoDian * 1.35) / (80 / 60);
      const xiao = (g._d.xiaoXue * 1.35) / (80 / 60);
      if (cai > T_MUBIAO && yao > T_MUBIAO && xiao > T_MUBIAO) mangquDian.push(g);
    }
  }

  // 5. 聚类成斑块 + 补建建议
  const cluster = dbscan(mangquDian, 250, 2);
  const bans = {};
  mangquDian.forEach((g, i) => {
    const c = cluster[i];
    if (c < 0) return;
    if (!bans[c]) bans[c] = [];
    bans[c].push(g);
  });
  const list = Object.values(bans).map((pts, idx) => {
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const areaM2 = (pts.length * bu * bu) | 0;
    return {
      id: 'MQ' + (idx + 1),
      level: pts.length > 12 ? 'red' : 'orange',
      polygon: pts,
      areaM2,
      quekou: ['菜市场', '药店', '小学'],
      zhongxin: { lng, lat },
      jianyi: `建议在 (${lng.toFixed(5)}, ${lat.toFixed(5)}) 周边增设社区菜市场与药店`,
      yujiFugaiRenkou: pts.length * 260,
    };
  });

  if (opt.jinDu) opt.jinDu(1, 'mangqu');
  return list;
}

export { shiBieMangQu };
