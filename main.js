// 作者：肖沐樑　QQ：3387432690
// 完成时间：2026，09，18
// Electron 主进程：拉起后端 -> 等健康 -> 开窗口 -> 退出清进程树

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');

const DUANKOU = 8765;
let houduanJincheng = null;

// 用户数据目录：打包版进 %APPDATA%/shenghuoquan，开发版进项目 data/
function zhunbeiShujuMulu() {
  const mulu = app.isPackaged
    ? path.join(app.getPath('appData'), 'shenghuoquan')
    : path.join(__dirname, 'data');
  fs.mkdirSync(mulu, { recursive: true });
  return mulu;
}

// 选后端：打包版用包内 server.exe，开发版跑 python server.py
function xuanzeHouduan() {
  if (!app.isPackaged) return null;
  const exe = path.join(__dirname, 'server.exe').replace('app.asar', 'app.asar.unpacked');
  return fs.existsSync(exe) ? exe : null;
}

function qidongHouduan() {
  const exe = xuanzeHouduan();
  if (exe) {
    houduanJincheng = spawn(exe, [], { stdio: 'ignore' });
  } else {
    try {
      houduanJincheng = spawn('py', ['server.py'], { cwd: __dirname, stdio: 'ignore' });
    } catch (e) {
      console.error('启动后端失败：', e);
    }
  }
}

// 兜底清端口残留
function shifangDuankou() {
  try {
    execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr LISTENING ^| findstr :${DUANKOU}') do taskkill /F /PID %a`,
      { stdio: 'ignore' });
  } catch (e) { /* 无残留则忽略 */ }
}

// 退出时结束整棵进程树，避免后端孤儿进程占用端口
function guanbiJinchengShu() {
  if (houduanJincheng && houduanJincheng.pid) {
    try { execSync(`taskkill /F /T /PID ${houduanJincheng.pid}`); } catch (e) { /* ignore */ }
  }
  try { execSync('taskkill /F /IM server.exe /T'); } catch (e) { /* ignore */ }
}

// 轮询后端健康接口，最多 15 秒
function dengDaiJiankang() {
  return new Promise((resolve) => {
    let n = 0;
    const timer = setInterval(() => {
      http.get(`http://127.0.0.1:${DUANKOU}/api/health`, (r) => {
        r.resume();
        clearInterval(timer);
        resolve(true);
      }).on('error', () => {
        if (++n > 30) { clearInterval(timer); resolve(false); }
      });
    }, 500);
  });
}

function chuangjianChuangkou() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(`http://127.0.0.1:${DUANKOU}/`);
  win.once('ready-to-show', () => win.show());
  return win;
}

app.whenReady().then(async () => {
  app.setAppUserModelId('15分钟生活圈体检助手');
  zhunbeiShujuMulu();
  shifangDuankou();
  qidongHouduan();
  await dengDaiJiankang();
  chuangjianChuangkou();
});

app.on('window-all-closed', () => {
  guanbiJinchengShu();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => guanbiJinchengShu());
