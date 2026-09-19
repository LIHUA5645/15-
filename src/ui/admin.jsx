// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，19
// 管理员控制面板：登录鉴权 + 体检标准/权重配置 + 历史报告查阅
// 样式统一走 index.css 的 admin-* 类，与主界面视觉语言一致
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
    <div className="admin-mask" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-head">
          <div className="panel-title">管理员控制面板</div>
          <button className="a-btn a-btn-ghost" onClick={onClose}>关闭</button>
        </div>

        {!auth ? (
          <div className="admin-body">
            <div className="a-tip">默认账号 admin / 密码 admin，可在面板内修改。</div>
            <input
              className="a-input"
              placeholder="账号"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            <input
              className="a-input"
              type="password"
              placeholder="密码"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
            {err && <div className="a-tip a-tip-err">{err}</div>}
            <button className="a-btn a-btn-primary" onClick={doLogin}>登录</button>
          </div>
        ) : (
          <div className="admin-body">
            <div className="a-row">
              <button className="a-btn a-btn-ghost" onClick={logout}>退出登录</button>
              <button className="a-btn a-btn-ghost" onClick={() => setReports(loadReports())}>刷新报告</button>
            </div>

            <div className="a-field">
              <label className="a-label">目标步行时长（秒，默认 900 = 15 分钟）</label>
              <input
                className="a-input"
                type="number"
                value={draft.mubiaoMiao}
                onChange={(e) => setDraft({ ...draft, mubiaoMiao: Number(e.target.value) })}
              />
            </div>

            <table className="a-table">
              <thead>
                <tr>
                  <th>维度</th>
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
                        className="a-input a-input-sm"
                        type="number"
                        value={draft.biaozhun[f]}
                        onChange={(e) =>
                          setDraft({ ...draft, biaozhun: { ...draft.biaozhun, [f]: Number(e.target.value) } })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="a-input a-input-sm"
                        type="number"
                        step="0.05"
                        value={draft.quanzhong[f]}
                        onChange={(e) =>
                          setDraft({ ...draft, quanzhong: { ...draft.quanzhong, [f]: Number(e.target.value) } })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="a-row">
              <button className="a-btn a-btn-primary" onClick={save}>保存配置</button>
              <button className="a-btn a-btn-ghost" onClick={reset}>恢复默认</button>
            </div>

            <div className="a-field">
              <label className="a-label">修改管理员密码</label>
              <div className="a-row">
                <input
                  className="a-input"
                  type="password"
                  placeholder="新密码"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                />
                <button className="a-btn a-btn-primary" onClick={changePwd}>修改</button>
              </div>
            </div>

            <div className="a-field">
              <div className="sec-title">历史体检记录（{reports.length}）</div>
              <div className="a-history">
                {reports.length === 0 && <div className="empty-tip">暂无记录，运行体检后自动归档。</div>}
                {reports.map((r, i) => (
                  <div className="a-record" key={i}>
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
