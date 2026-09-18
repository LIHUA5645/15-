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
  // 构造调度器：并发池 + 令牌桶限流
  // 默认取保守值：浏览器端 AK 的「地点检索 / 路线规划」并发上限较低，过高会触发平台限流告警
  const qps = opt.qps || 2;
  const bingfa = opt.bingfa || 3;
  const tong = new LingPaiTong(qps);
  const xl = new BingFaChi(bingfa);
  const xianliu = {
    run: (fn) => xl.run(async () => {
      await tong.huoQu();
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
  const qingQiuShu0 = 0;

  // 2. 等时圈
  const dengShiQuan = await shengChengDengshiquan(provider, canShu, {
    huanCun: hc,
    xianliu,
    jinDu: opt.jinDu,
  });

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
      qingQiuShu: qingQiuShu0 + (dengShiQuan.yangBenDian?.length || 0),
      haoShiMs: Date.now() - t0,
      miDu: dengShiQuan.miDu,
    },
  };
  return report;
}
