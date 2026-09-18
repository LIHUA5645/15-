# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
# 覆盖度评分：每类设施按「数量是否达标 + 最近可达时长」打 1~5 星，汇总综合分

from app import map_api

# 各类设施「宜居基线」：圈内最少应有数量
JIXIAN = {
    '菜市场': 1, '药店': 1, '小学': 1,
    '社区医院': 1, '公园': 1, '银行': 1,
}

def jisuan_pingfen(zhongxin, sheshi_list, banjing):
    """返回 {zonghe(0-100), xiangqing:[{ming, xingji, shuliang, zuijin_shichang_s}]}"""
    xiangqing = []
    for ming in sheshi_list:
        poi = map_api.huoqu_poi(zhongxin, ming, banjing=banjing)
        shuliang = len(poi)
        # 最近可达时长
        if poi:
            zhongdian = [(p['weidu'], p['jingdu']) for p in poi]
            shichang = map_api.jisuan_juzhen(zhongxin, zhongdian)
            zuijin = min(shichang)
        else:
            zuijin = None
        # 星级：数量达标 + 最近在 15 分钟内给高分
        xingji = 1
        if shuliang >= JIXIAN.get(ming, 1):
            xingji += 2
        if zuijin is not None and zuijin <= 900:
            xingji += 1
        if zuijin is not None and zuijin <= 600:
            xingji += 1
        xingji = min(5, xingji)
        xiangqing.append({
            'ming': ming, 'xingji': xingji,
            'shuliang': shuliang,
            'zuijin_shichang_s': int(zuijin) if zuijin is not None else None,
        })
    if xiangqing:
        zonghe = int(sum(x['xingji'] for x in xiangqing) / len(xiangqing) / 5 * 100)
    else:
        zonghe = 0
    return {'zonghe': zonghe, 'xiangqing': xiangqing}
