// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 体检流水线总编排：检索→等时圈→盲区→评分→报告
import { shengChengDengshiquan } from './isochrone/dengshiquan.js';
import { souSuoBingQingXi } from './poi/qingxi.js';
import { shiBieMangQu } from './blindspot/mangqu.js';
import { pingFen, shengChengJianYi } from './scoring/pingfen.js';
import { LingPaiTong, BingFaChi, HuanCun } from './scheduler/xianliu.js';

export async function yunXingTijian(provider, canShu, opt = {}) {
  const t0 = Date.now();
  const warnings = [];
  // 构造调度器：并发池 + 令牌桶限流，并统计实际经过限流器的请求数
  const qps = opt.qps || 2;
  const bingfa = opt.bingfa || 3;
  const tong = new LingPaiTong(qps);
  const xl = new BingFaChi(bingfa);
  let qingQiuShu = 0;
  const xianliu = {
    run: (fn) => xl.run(async () => {
      await tong.huoQu();
      qingQiuShu++;
      return fn();
    }),
  };
  const hc = opt.huanCun || new HuanCun(opt.store);

  // 1. 检索与清洗
  if (opt.jinDu) opt.jinDu(0, 'sousuo');
  const poiSet = await souSuoBingQingXi(provider, canShu.zhongXin, canShu.banJingMi || 1500, {
    xianliu,
    huanCun: hc,
  });
  if (poiSet.cunYi && poiSet.cunYi.length) {
    warnings.push(`POI 清洗阶段有 ${poiSet.cunYi.length} 条低可信度数据未参评`);
  }

  // 2. 等时圈
  const dengShiQuan = await shengChengDengshiquan(provider, canShu, {
    huanCun: hc,
    xianliu,
    jinDu: opt.jinDu,
  });
  if (dengShiQuan.geshe && dengShiQuan.geshe.length) {
    warnings.push(`检测到 ${dengShiQuan.geshe.length} 个方位存在明显阻隔/割裂`);
  }
  const jiangZhiYangBen = (dengShiQuan.yangBenDian || []).filter((s) => s.degraded);
  if (jiangZhiYangBen.length) {
    warnings.push(`${jiangZhiYangBen.length} 个采样点因算路失败降级为直线估算`);
  }

  // 3. 盲区
  const mangquList = await shiBieMangQu(provider, canShu, poiSet, {
    huanCun: hc,
    xianliu,
    jinDu: opt.jinDu,
  });

  // 4. 评分（管理员配置可覆盖基准值/权重/目标时长）
  const peiZhi = opt.peiZhi || null;
  const { fenleiPingfen, total, dengji } = pingFen(
    canShu.zhongXin,
    poiSet.fenleiSet,
    dengShiQuan,
    peiZhi
  );
  const jianYi = shengChengJianYi(fenleiPingfen);

  const report = {
    zhongXin: canShu.zhongXin,
    canShu,
    total,
    dengji,
    dengShiQuan,
    poiSet,
    fenleiPingfen,
    mangquList,
    jianYi,
    warnings,
    xinxi: {
      qingQiuShu,
      haoShiMs: Date.now() - t0,
      miDu: dengShiQuan.miDu,
    },
  };
  return report;
}
