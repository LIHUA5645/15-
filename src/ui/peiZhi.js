// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 浏览器端管理员配置读写（localStorage 持久化，跨刷新保留）
import { MOREN_PEI_ZHI } from '../core/types.js';

const KEY = 'sq_admin_conf';
const RKEY = 'sq_reports';

export function loadPeiZhi() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...MOREN_PEI_ZHI, ...JSON.parse(s) };
  } catch {
    /* 忽略 */
  }
  return { ...MOREN_PEI_ZHI };
}

export function savePeiZhi(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

// 报告存档（管理员可查看历史体检记录）
export function saveReport(rep) {
  try {
    const list = JSON.parse(localStorage.getItem(RKEY) || '[]');
    list.unshift({
      t: Date.now(),
      zhongXin: rep.zhongXin,
      total: rep.total,
      dengji: rep.dengji,
      mang: rep.mangquList.length,
    });
    localStorage.setItem(RKEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* 忽略 */
  }
}

export function loadReports() {
  try {
    return JSON.parse(localStorage.getItem(RKEY) || '[]');
  } catch {
    return [];
  }
}
