# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
# 后端入口：FastAPI 提供静态页面 + 体检接口，所有算法在 app/ 下

import sys
import pathlib
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app import config, map_api, isochrone, blindspot, score

app = FastAPI(title='15分钟生活圈智能体检助手')

# 静态资源目录：开发态用项目 web/，打包态用 _MEIPASS/web
_jichu = pathlib.Path(getattr(sys, '_MEIPASS', pathlib.Path(__file__).parent))
_web = _jichu / 'web'

class TijianQingqiu(BaseModel):
    jingdu: float = None
    weidu: float = None
    dizhi: str = None
    sheshi: list = None
    shichang: int = 15

@app.get('/api/health')
def jiankang():
    return {'ok': True, 'port': 8765, 'jiangji': config.shifou_jiangji(),
            'ak_peizhi': bool(config.huoqu_ak('BAIDU_AK'))}

@app.get('/api/config')
def huoqu_peizhi():
    # 前端渲染百度底图需要浏览器端 AK，这里原样返回（日志已脱敏）
    return {'web_ak': config.huoqu_wab_ak(), 'jiangji': config.shifou_jiangji()}

@app.post('/api/tijian')
def tijian(q: TijianQingqiu):
    # 1) 确定中心点
    if q.weidu and q.jingdu:
        zhongxin = (q.weidu, q.jingdu)
    elif q.dizhi:
        zb = map_api.zuobiao_bianma(q.dizhi)
        if not zb:
            return JSONResponse(status_code=400, content={'code': 400, 'msg': '地址解析失败，请检查 AK 或改用经纬度'})
        zhongxin = zb
    else:
        return JSONResponse(status_code=400, content={'code': 400, 'msg': '请传入地址或经纬度'})

    sheshi = q.sheshi or ['菜市场', '药店', '小学', '社区医院', '公园', '银行']
    banjing = q.shichang * 100  # 15 分钟步行约 1.5km

    # 2) 等时圈
    ds = isochrone.jisuan_dengshiquan(zhongxin, shichang_fenzhong=q.shichang)

    # 3) POI 点（供前端标点）
    poi_map = {}
    for s in sheshi:
        poi_map[s] = map_api.huoqu_poi(zhongxin, s, banjing=banjing)

    # 4) 盲区
    mangqu = blindspot.shibie_mangqu(zhongxin, banjing, sheshi)

    # 5) 评分
    pf = score.jisuan_pingfen(zhongxin, sheshi, banjing)

    return {
        'zhongxin': {'jingdu': zhongxin[1], 'weidu': zhongxin[0]},
        'dengshiquan': ds,
        'poi': poi_map,
        'mangqu': mangqu,
        'pingfen': pf,
        'jiangji': config.shifou_jiangji(),
    }

if _web.exists():
    app.mount('/', StaticFiles(directory=str(_web), html=True), name='web')

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8765)
