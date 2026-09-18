// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 核心数据与接口类型定义（纯描述，无运行依赖）

// Poi：兴趣点
// { uid, name, lng, lat, type, fenlei, zixin (可信度 0~1) }

// RouteResult：一次算路结果
// { durationSec, distanceM, polyline: [{lng,lat}...] }

// GeoProvider 接口（所有适配器必须实现，是跨端复用的统一契约）：
//   walkingRoute(origin, dest) -> Promise<RouteResult>
//   routeMatrix(origins[], dests[]) -> Promise<{durationSec,distanceM}[][] | null>
//   searchPoi(center, keywords[], radiusM) -> Promise<Poi[]>
//   reverseGeocode(point) -> Promise<{address, aoi, poiType}>
// 复用方式：
//   Web/Electron 桌面端 —— bmapWeb.js（BMap JS SDK）/ bmapServer.js（主进程 Web 服务 API）
//   小程序端 —— 用 wx.request 调百度 Web 服务 API 实现上述 4 个方法（新建 adapters/wxMini.js）
//   安卓端 —— 用 WebView 加载同一份构建产物，或 Kotlin 经 JSBridge 暴露同签名方法（新建 adapters/android.js）
//   离线演示 —— mock.js（零 AK 兜底）
// 核心引擎 src/core 为纯 JS、零 DOM、零 BMap 依赖，任意端 import 后传入对应 provider 即可。

// 体检参数
// { zhongXin:{lng,lat}, mubiaoMiao:900, dangwei:'fast'|'standard'|'fine' }

// 体检报告（Report）
// {
//   zhongXin, canshu, total, dengji,
//   dengshiquan: { ceng: [{miao, polygon:[...]}], yangBenDian:[...], luXian:[...], geshe:[] },
//   fenleiPingfen: [{fenlei, score, C,A,D,B, shuliang}],
//   mangquList: [{id, level, polygon, areaM2, quekou, zhongxin, jianyi, yujiFugaiRenkou}],
//   warnings: [],
//   xinxi: { qingQiuShu, haoShiMs, miDu }
// }

export const FENLEI = ['yiliao', 'jiaoyu', 'gouwu', 'yanglao', 'jiaotong', 'xiuxian'];

// 各维度默认权重
export const FENLEI_QUANZHONG = {
  yiliao: 0.2,
  jiaoyu: 0.2,
  gouwu: 0.2,
  yanglao: 0.15,
  jiaotong: 0.15,
  xiuxian: 0.1,
};

// 设施检索同义词表（关键词 → 维度）
export const FENLEI_GUANJIANCI = {
  yiliao: ['社区卫生服务中心', '社区医院', '诊所', '医院', '卫生服务站', '药店', '药房'],
  jiaoyu: ['小学', '幼儿园', '九年一贯制', '教育'],
  gouwu: ['菜市场', '农贸市场', '生鲜', '超市', '便利店', '商场'],
  yanglao: ['养老院', '日间照料', '老年活动中心', '养老服务'],
  jiaotong: ['公交站', '地铁站', '地铁', '共享单车', '停车场'],
  xiuxian: ['公园', '广场', '健身', '文化', '体育'],
};

// 三项必备（盲区判定）
export const BISU = ['caiShiChang', 'yaoDian', 'xiaoXue'];

// 圈内设施覆盖基准值（评分用，管理员可改）
export const BIAOZHUN = {
  yiliao: 3,
  jiaoyu: 2,
  gouwu: 4,
  yanglao: 2,
  jiaotong: 4,
  xiuxian: 3,
};

// 默认体检配置（管理员控制面板读取/覆盖的唯一来源）
export const MOREN_PEI_ZHI = {
  mubiaoMiao: 900, // 目标步行时长（秒）
  biaozhun: { ...BIAOZHUN },
  quanzhong: { ...FENLEI_QUANZHONG },
};

// 维度的中文名（跨端共用展示）
export const FENLEI_MING = {
  yiliao: '医疗',
  jiaoyu: '教育',
  gouwu: '购物',
  yanglao: '养老',
  jiaotong: '交通',
  xiuxian: '休闲',
};
