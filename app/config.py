# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
# 配置与密钥读取：AK 统一出口 + 日志脱敏，绝不让密钥进代码库或进日志

import os
import sys
import pathlib

# 用户配置目录：%APPDATA%/shenghuoquan（打包版）/ 项目 data（开发版）
def huoqu_peizhi_mulu():
    if getattr(sys, 'frozen', False):
        base = pathlib.Path(os.environ.get('APPDATA', pathlib.Path.home()))
        return base / 'shenghuoquan'
    return pathlib.Path(__file__).resolve().parent.parent / 'data'

# 从用户配置文件读取（界面里填的，打包版走这条）
def _duqu_yonghu_peizhi():
    p = huoqu_peizhi_mulu() / 'peizhi.json'
    if p.exists():
        try:
            import json
            return json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            return {}
    return {}

# AK 读取优先级：用户配置 > 环境变量 > 项目 .env
def huoqu_ak(ming='BAIDU_AK'):
    peizhi = _duqu_yonghu_peizhi()
    if ming in peizhi and peizhi[ming]:
        return peizhi[ming]
    val = os.environ.get(ming)
    if val:
        return val
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass
    return os.environ.get(ming, '')

# 浏览器端 AK（JS API 用），与服务端 AK 分开
def huoqu_wab_ak():
    return huoqu_ak('WEB_AK')

# 日志脱敏：只保留头尾各 3 位
def yinshen(s):
    if not s or len(s) <= 8:
        return '****'
    return f'{s[:3]}...{s[-3:]}'

# 是否处于降级模式（没配服务端 AK 时，用直线距离估算，保证能演示）
def shifou_jiangji():
    return not bool(huoqu_ak('BAIDU_AK'))
