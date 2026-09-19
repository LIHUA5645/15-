// 版权声明：肖沐樑  QQ：3387432690
// 完成时间：2026，09，18
// Electron 主进程：窗口 + 服务端 API 代理（批量距离矩阵）+ 磁盘缓存 + 离线样例
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { chuangJianBmapServer } = require('../src/adapters/bmapServer.js');

// 磁盘缓存（落 userData，重复体检秒开、降配额）
const cacheFile = path.join(app.getPath('userData'), 'cache.json');
let cacheMap = {};
try {
  cacheMap = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
} catch {
  cacheMap = {};
}
let dirty = false;
let writeTimer = null;
function flushCache() {
  if (!dirty) return;
  dirty = false;
  fs.writeFile(cacheFile, JSON.stringify(cacheMap), (err) => {
    if (err) console.error('缓存写入失败', err);
  });
}
function cacheSet(k, v) {
  cacheMap[k] = { t: Date.now(), v };
  dirty = true;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushCache, 500); // 500ms 内合并多次写入
}
function cacheGet(k) {
  const o = cacheMap[k];
  if (!o) return null;
  if (Date.now() - o.t > 7 * 864e5) return null;
  return o.v;
}
// 应用退出前强制落盘
app.on('before-quit', flushCache);
const store = { get: cacheGet, set: cacheSet };

const serverAk = process.env.BAIDU_SERVER_AK || '';
const provider = chuangJianBmapServer({ ak: serverAk, referer: 'http://localhost' });

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 开发模式加载 Vite，生产加载构建产物
  const dev = process.env.ELECTRON_DEV === '1';
  if (dev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// IPC 桥：渲染进程通过 window.api.* 调用主进程代理（AK 不进前端产物）
ipcMain.handle('walkingRoute', async (_e, o, d) => provider.walkingRoute(o, d));
ipcMain.handle('routeMatrix', async (_e, o, d) => provider.routeMatrix(o, d));
ipcMain.handle('searchPoi', async (_e, c, k, r) => provider.searchPoi(c, k, r));
ipcMain.handle('reverseGeocode', async (_e, p) => provider.reverseGeocode(p));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
