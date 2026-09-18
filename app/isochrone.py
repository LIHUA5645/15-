# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
# 等时圈生成：扇形采样 + 批量距离矩阵 + IDW 空间插值
# 思路：从中心点沿 N 个方向布候选点 -> 批量测步行时长 -> 得到时间场 -> 取<=阈值范围

import math
import threading
from app import map_api
from app import cache
from app.config import shifou_jiangji

_bingfa = threading.Semaphore(4)  # 并发 <=4，防 QPS 限流

def _jingwei_pianyi(zhongxin, fangwei, juli):
    """以中心点按方位角+距离推算候选经纬度（演示量级足够，bd09 近似）"""
    lat, lng = zhongxin
    d_lat = (juli / 111320.0) * math.cos(math.radians(fangwei))
    d_lng = (juli / (111320.0 * math.cos(math.radians(lat)))) * math.sin(math.radians(fangwei))
    return (lat + d_lat, lng + d_lng)

def jisuan_dengshiquan(zhongxin, shichang_fenzhong=15, fangxiang=24,
                       banjing_max=1500, buchang=200):
    """返回时间场候选点：[{jingdu, weidu, shichang(秒), zaiquan(bool)}]"""
    biaoshi = cache.shengcheng_biaoshi('dengshiquan', zhongxin, shichang_fenzhong,
                                       fangxiang, banjing_max, buchang)
    old = cache.duqu_huancun(biaoshi)
    if old:
        return old

    yu = shichang_fenzhong * 60
    houxuan = []
    for i in range(fangxiang):
        fangwei = i * (360.0 / fangxiang)
        for j in range(1, int(banjing_max / buchang) + 1):
            juli = j * buchang
            d = _jingwei_pianyi(zhongxin, fangwei, juli)
            houxuan.append({'jingdu': d[1], 'weidu': d[0], 'shichang': 0, 'zaiquan': False})

    # 批量测时：一次性把所有候选点交给距离矩阵
    zhongdian = [(h['weidu'], h['jingdu']) for h in houxuan]
    shichang_list = map_api.jisuan_juzhen(zhongxin, zhongdian)
    for h, s in zip(houxuan, shichang_list):
        h['shichang'] = int(s)
        h['zaiquan'] = s <= yu

    jieguo = {
        'shichang': yu,
        'jiangji': shifou_jiangji(),
        'houxuan': houxuan,
        'zhongxin': {'jingdu': zhongxin[1], 'weidu': zhongxin[0]},
    }
    cache.xieru_huancun(biaoshi, jieguo)
    return jieguo
