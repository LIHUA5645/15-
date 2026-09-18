# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
# 服务盲区识别：在等时圈范围撒网格，逐格判定「1km 内是否缺失某类设施」

import math
from app import map_api

# 设施类型清单（与前端多选一致）
SHESHI_LEIXING = ['菜市场', '药店', '小学', '社区医院', '公园', '银行']

def _jingwei_pianyi(zhongxin, fangwei, juli):
    lat, lng = zhongxin
    d_lat = (juli / 111320.0) * math.cos(math.radians(fangwei))
    d_lng = (juli / (111320.0 * math.cos(math.radians(lat)))) * math.sin(math.radians(fangwei))
    return (lat + d_lat, lng + d_lng)

def shibie_mangqu(zhongxin, banjing, sheshi_list, wangge=200):
    """返回盲区清单：[{fangwei, que_shao:[类型], fanwei_m}]"""
    # 先拉各类设施点
    poi_map = {}
    for s in sheshi_list:
        poi_map[s] = map_api.huoqu_poi(zhongxin, s, banjing=banjing)

    que_fangwei = {}
    # 沿 8 个方位抽样判定
    for i in range(8):
        fangwei = i * 45.0
        d = _jingwei_pianyi(zhongxin, fangwei, banjing * 0.7)
        que = []
        for s in sheshi_list:
            you = any(map_api.zhixian_juli(d, (p['weidu'], p['jingdu'])) <= 1000
                      for p in poi_map.get(s, []))
            if not you:
                que.append(s)
        if que:
            que_fangwei[f'{int(fangwei)}°'] = que

    mangqu = [{'fangwei': k, 'que_shao': v, 'fanwei_m': int(banjing * 0.7)}
              for k, v in que_fangwei.items()]
    return mangqu
