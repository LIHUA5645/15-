# 作者：肖沐樑　QQ：3387432690
# 完成时间：2026，09，18
# SQLite 缓存：同样的「中心点 + 半径 + 设施 + 步行方式」命中即秒出，不重复烧 API 额度

import sqlite3
import json
import hashlib
import threading
from app.config import huoqu_peizhi_mulu

_suo = threading.Lock()

def _lianjie():
    mulu = huoqu_peizhi_mulu()
    mulu.mkdir(parents=True, exist_ok=True)
    db = mulu / 'huancun.db'
    conn = sqlite3.connect(str(db), check_same_thread=False)
    conn.execute('''CREATE TABLE IF NOT EXISTS huancun (
        biaoshi TEXT PRIMARY KEY,
        shuju TEXT,
        shijian REAL
    )''')
    conn.commit()
    return conn

def shengcheng_biaoshi(*args):
    # 把入参拼成稳定指纹
    qingxi = '|'.join(str(a) for a in args)
    return hashlib.md5(qingxi.encode('utf-8')).hexdigest()

def duqu_huancun(biaoshi):
    try:
        with _suo:
            conn = _lianjie()
            row = conn.execute('SELECT shuju FROM huancun WHERE biaoshi=?', (biaoshi,)).fetchone()
            conn.close()
            if row:
                return json.loads(row[0])
    except Exception:
        return None
    return None

def xieru_huancun(biaoshi, shuju):
    try:
        with _suo:
            conn = _lianjie()
            conn.execute('REPLACE INTO huancun VALUES (?,?,?)',
                         (biaoshi, json.dumps(shuju, ensure_ascii=False), __import__('time').time()))
            conn.commit()
            conn.close()
    except Exception:
        pass
