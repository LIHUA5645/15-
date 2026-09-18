// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// 管理员控制面板：登录鉴权 + 体检标准/权重配置 + 历史报告查阅
import React, { useState } from 'react';
import { FENLEI_MING, MOREN_PEI_ZHI } from '../core/types.js';
import { savePeiZhi, loadReports } from './peiZhi.js';

const FENLEI = Object.keys(FENLEI_MING);

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

const PWD_KEY = 'sq_admin_pwd';
const SESSION_KEY = 'sq_admin_session';

export function GuanLiYuan({ open, onClose, peiZhi, onChange }) {
  const [user, setUser] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [auth, setAuth] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  );
  const [draft, setDraft] = useState(() => ({ ...peiZhi }));
  const [reports, setReports] = useState([]);
  const [newPwd, setNewPwd] = useState('');

  if (!open) return null;

  function doLogin() {
    const stored = localStorage.getItem(PWD_KEY) || hash('admin');
    if (user === 'admin' && hash(pwd) === stored) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setAuth(true);
      setErr('');
      setReports(loadReports());
    } else {
      setErr('账号或密码错误');
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuth(false);
  }

  function save() {
    savePeiZhi(draft);
    onChange(draft);
    alert('配置已保存并立即生效');
  }

  function reset() {
    const d = { ...MOREN_PEI_ZHI };
    setDraft(d);
    savePeiZhi(d);
    onChange(d);
  }

  function changePwd() {
    if (!newPwd) return;
    localStorage.setItem(PWD_KEY, hash(newPwd));
    setNewPwd('');
    alert('管理员密码已修改');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 520, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>管理员控制面板</h3>
          <button className="btn" style={{ width: 'auto', padding: '4px 10px' }} onClick={onClose}>
            关闭
          </button>
        </div>

        {!auth ? (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="warn">默认账号 admin / 密码 admin，可在面板内修改。</div>
            <input
              className="field"
              style={{ padding: 9, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' }}
              placeholder="账号"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            <input
              type="password"
              placeholder="密码"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              style={{ padding: 9, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' }}
            />
            {err && <div className="warn" style={{ color: 'var(--danger)' }}>{err}</div>}
            <button className="btn" onClick={doLogin}>登录</button>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={logout}>退出登录</button>
              <button className="btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => setReports(loadReports())}>刷新报告</button>
            </div>

            <div>
              <label className="field">目标步行时长（秒，默认 900=15 分钟）</label>
              <input
                type="number"
                value={draft.mubiaoMiao}
                onChange={(e) => setDraft({ ...draft, mubiaoMiao: Number(e.target.value) })}
                style={{ width: '100%', padding: 8, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' }}
              />
            </div>

            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th style={{ textAlign: 'left' }}>维度</th>
                  <th>圈内基准数</th>
                  <th>权重</th>
                </tr>
              </thead>
              <tbody>
                {FENLEI.map((f) => (
                  <tr key={f}>
                    <td>{FENLEI_MING[f]}</td>
                    <td>
                      <input
                        type="number"
                        value={draft.biaozhun[f]}
                        onChange={(e) =>
                          setDraft({ ...draft, biaozhun: { ...draft.biaozhun, [f]: Number(e.target.value) } })
                        }
                        style={{ width: 70, padding: 6, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.05"
                        value={draft.quanzhong[f]}
                        onChange={(e) =>
                          setDraft({ ...draft, quanzhong: { ...draft.quanzhong, [f]: Number(e.target.value) } })
                        }
                        style={{ width: 70, padding: 6, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={save}>保存配置</button>
              <button className="btn" style={{ width: 'auto', padding: '8px 14px', background: 'var(--panel-2)' }} onClick={reset}>恢复默认</button>
            </div>

            <div>
              <label className="field">修改管理员密码</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="password"
                  placeholder="新密码"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  style={{ flex: 1, padding: 8, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)' }}
                />
                <button className="btn" style={{ width: 'auto', padding: '8px 14px' }} onClick={changePwd}>修改</button>
              </div>
            </div>

            <div>
              <h3>历史体检记录（{reports.length}）</h3>
              <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                {reports.length === 0 && <div className="warn">暂无记录，运行体检后自动归档。</div>}
                {reports.map((r, i) => (
                  <div className="mq" key={i}>
                    {new Date(r.t).toLocaleString()} · 等级 <b>{r.dengji}</b> · 得分 {r.total} · 盲区 {r.mang}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
