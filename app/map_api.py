# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
# 百度地图开放能力封装：地理编码 / 逆地理编码 / POI 周边检索 / 批量距离矩阵
# 无 AK 时自动降级为直线距离估算（步行速度约 1.2 m/s），保证算法与图表仍能演示

import math
import httpx
from app.config import huoqu_ak, shifou_jiangji, yinshen

# 百度坐标密钥签名（如服务端 AK 开启了 SN 校验才需要，这里留空函数便于扩展）
def _qianming(_url):
    return _url

# 直线距离（米），输入为 bd09 或 wgs84 近似即可，演示量级足够
def zhixian_juli(a, b):
    r = 6371000.0
    lat1, lng1 = math.radians(a[0]), math.radians(a[1])
    lat2, lng2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    x = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))

# 步行时长（秒）：无 AK 时用直线距离 / 步行速度估算
def buxing_shichang(a, b):
    sudu = 1.2  # m/s
    return zhixian_juli(a, b) / sudu

def zuobiao_bianma(dizhi):
    """地址 -> 经纬度。返回 (lat, lng) 或 None"""
    if shifou_jiangji():
        return None
    ak = huoqu_ak('BAIDU_AK')
    url = 'https://api.map.baidu.com/geocoding/v3/'
    params = {'address': dizhi, 'output': 'json', 'ak': ak}
    try:
        r = httpx.get(url, params=params, timeout=8)
        j = r.json()
        if j.get('status') == 0:
            loc = j['result']['location']
            return (loc['lat'], loc['lng'])
    except Exception as e:
        print(f'[地图] 地理编码失败（已忽略，走降级）: {e}')
    return None

def huoqu_poi(zhongxin, zhonglei, banjing=1500, ye=0):
    """周边检索 POI。返回 [{mingcheng, jingdu, weidu, dizhi}]"""
    if shifou_jiangji():
        return []
    ak = huoqu_ak('BAIDU_AK')
    url = 'https://api.map.baidu.com/place/v2/search'
    params = {
        'query': zhonglei,
        'location': f'{zhongxin[0]},{zhongxin[1]}',
        'radius': banjing,
        'output': 'json',
        'ak': ak,
        'page_num': ye,
    }
    try:
        r = httpx.get(url, params=params, timeout=8)
        j = r.json()
        if j.get('status') == 0:
            return [{
                'mingcheng': p.get('name', ''),
                'jingdu': p['location']['lng'],
                'weidu': p['location']['lat'],
                'dizhi': p.get('address', ''),
            } for p in j.get('results', [])]
    except Exception as e:
        print(f'[地图] POI 检索失败（已忽略）: {e}')
    return []

def jisuan_juzhen(qidian, zhongdian_list, bingfa=4):
    """批量距离矩阵：起点 -> 多个终点，返回各终点步行时长（秒）。
    优先用百度 routematrix walking；无 AK 或失败则直线估算。"""
    if shifou_jiangji():
        return [buxing_shichang(qidian, z) for z in zhongdian_list]
    ak = huoqu_ak('BAIDU_AK')
    origins = f'{qidian[0]},{qidian[1]}'
    destinations = ';'.join(f'{z[0]},{z[1]}' for z in zhongdian_list)
    url = 'https://api.map.baidu.com/routematrix/v2/walking/'
    params = {
        'origins': origins,
        'destinations': destinations,
        'coord_type': 'bd09ll',
        'output': 'json',
        'ak': ak,
    }
    try:
        r = httpx.get(url, params=params, timeout=10)
        j = r.json()
        if j.get('status') == 0:
            return [int(s.get('duration', {}).get('value', buxing_shichang(qidian, z)))
                    for s, z in zip(j.get('result', []), zhongdian_list)]
    except Exception as e:
        print(f'[地图] 距离矩阵失败，转直线估算: {e}')
    return [buxing_shichang(qidian, z) for z in zhongdian_list]
