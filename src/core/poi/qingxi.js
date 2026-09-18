// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 多源 POI 检索编排 + 清洗（归一/去重/过滤/可信度/分维归档）
import { liangDianJuLi } from '../geo/jichu.js';
import { FENLEI_GUANJIANCI, BIAOZHUN } from '../types.js';

const HEIMINGDAN = ['公司', '仓库', '批发', '养殖', '工地', '废弃', '工厂', '物流园'];

// 名称编辑距离（Levenshtein）
function bianJiJuLi(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
}

function piPeiFenlei(name) {
  for (const f of Object.keys(FENLEI_GUANJIANCI)) {
    for (const kw of FENLEI_GUANJIANCI[f]) {
      if (name.includes(kw)) return f;
    }
  }
  return null;
}

// 可信度打分
function keXinDu(poi) {
  let s = 0;
  const fenlei = piPeiFenlei(poi.name);
  if (poi.name && fenlei) s += 0.4;
  if (poi.type) s += 0.3;
  if (poi.lng && poi.lat) s += 0.2;
  if (poi.address) s += 0.1;
  return Math.max(0, Math.min(1, s));
}

// 清洗主流程：去重 + 过滤 + 可信度 + 分维
export function qingXi(rawList, zhongXin) {
  const list = rawList
    .filter((p) => p && p.lng && p.lat && p.lng !== 0 && p.lat !== 0)
    .map((p) => ({ ...p, _clng: zhongXin.lng, _clat: zhongXin.lat }));
  const out = [];
  for (const p of list) {
    // 噪声过滤
    if (HEIMINGDAN.some((w) => (p.name || '').includes(w))) continue;
    const fenlei = piPeiFenlei(p.name || '');
    if (!fenlei) continue;
    // 去重：与已保留项比较
    let dup = false;
    for (const q of out) {
      if (q.fenlei !== fenlei) continue;
      const d = liangDianJuLi(p, q);
      if (q.uid && p.uid && q.uid === p.uid) {
        dup = true;
        break;
      }
      if (bianJiJuLi(q.name || '', p.name || '') <= 2 && d < 50) {
        dup = true;
        break;
      }
      if (q.brand && p.brand && q.brand === p.brand && d < 200) {
        dup = true;
        break;
      }
    }
    if (dup) continue;
    const zixin = keXinDu(p);
    out.push({ ...p, fenlei, zixin });
  }
  // 分维归档
  const fenleiSet = {};
  for (const f of Object.keys(FENLEI_GUANJIANCI)) fenleiSet[f] = [];
  for (const p of out) fenleiSet[p.fenlei].push(p);
  return { suoyou: out, fenleiSet, cunYi: out.filter((p) => p.zixin < 0.45) };
}

// 检索并清洗：对所有关键词组检索后合并清洗
// opt.xianliu 走限流器（避免触碰百度「地点检索」并发/QPS 上限）
// opt.huanCun 命中缓存直接复用，同中心点重复体检不再重复消耗配额
export async function souSuoBingQingXi(provider, zhongXin, banJingMi = 1500, opt = {}) {
  const { xianliu, huanCun } = opt;
  const all = [];
  for (const f of Object.keys(FENLEI_GUANJIANCI)) {
    const ckey = `poi:${f}:${zhongXin.lng.toFixed(4)},${zhongXin.lat.toFixed(4)}:${banJingMi}`;
    let r = huanCun ? huanCun.get(ckey) : null;
    if (!r) {
      const renWu = () => provider.searchPoi(zhongXin, FENLEI_GUANJIANCI[f], banJingMi);
      r = xianliu ? await xianliu.run(renWu) : await renWu();
      if (r && huanCun) huanCun.set(ckey, r);
    }
    for (const p of r || []) all.push({ ...p, brand: p.brand || guessBrand(p.name) });
  }
  return qingXi(all, zhongXin);
}

// 简单品牌识别（取前 4 字作为品牌指纹）
function guessBrand(name = '') {
  return name.slice(0, 4);
}

export { BIAOZHUN, piPeiFenlei };
