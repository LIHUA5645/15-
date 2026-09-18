// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
import { describe, it, expect } from 'vitest';
import {
  liangDianJuLi,
  tuiSuanDian,
  fangWeiJiao,
  pingHuaXian,
} from '../src/core/geo/jichu.js';
import { qingXi } from '../src/core/poi/qingxi.js';
import { chuangJianMock } from '../src/adapters/mock.js';
import { yunXingTijian } from '../src/core/pipeline.js';

describe('基础几何工具', () => {
  it('两点距离合理', () => {
    const a = { lng: 112.9388, lat: 28.2281 };
    const b = { lng: 112.9488, lat: 28.2281 };
    expect(liangDianJuLi(a, b)).toBeGreaterThan(900);
    expect(liangDianJuLi(a, b)).toBeLessThan(1100);
  });
  it('方位推算可往返', () => {
    const a = { lng: 112.9388, lat: 28.2281 };
    const b = tuiSuanDian(a, 90, 500);
    expect(liangDianJuLi(a, b)).toBeCloseTo(500, 0);
    expect(fangWeiJiao(a, b)).toBeCloseTo(90, 0);
  });
  it('Chaikin 平滑保持点数增加', () => {
    const line = [{ lng: 0, lat: 0 }, { lng: 1, lat: 1 }, { lng: 2, lat: 0 }];
    expect(pingHuaXian(line, 1).length).toBeGreaterThan(line.length);
  });
});

describe('POI 清洗', () => {
  it('去重与分类', () => {
    const raw = [
      { uid: '1', name: '惠民菜市场', lng: 112.94, lat: 28.23 },
      { uid: '2', name: '惠民菜市场', lng: 112.9401, lat: 28.2301 },
      { uid: '3', name: '某物流公司仓库', lng: 112.95, lat: 28.24 },
    ];
    const r = qingXi(raw, { lng: 112.9388, lat: 28.2281 });
    expect(r.suoyou.length).toBe(1); // 同名近距去重 + 公司仓库过滤
    expect(r.fenleiSet.gouwu.length).toBe(1);
  });
});

describe('端到端体检（mock 适配器）', () => {
  it('标准档可生成完整报告', async () => {
    const provider = chuangJianMock();
    const rep = await yunXingTijian(
      provider,
      { zhongXin: { lng: 112.9388, lat: 28.2281 }, mubiaoMiao: 900, dangwei: 'standard' },
      // 测试用 mock 适配器无真实配额限制，放开节奏避免用例超时
      { qps: 50, bingfa: 16 }
    );
    expect(typeof rep.total).toBe('number');
    expect(rep.total).toBeGreaterThanOrEqual(0);
    expect(rep.dengShiQuan.ceng.length).toBeGreaterThanOrEqual(1);
    expect(rep.fenleiPingfen.length).toBe(6);
    expect(Array.isArray(rep.mangquList)).toBe(true);
    expect(rep.xinxi.miDu).toBe('standard');
  }, 30000);
});
