// 作者：肖沐樑　QQ：3387432690
// 完成时间：2026，09，18
// 渲染进程安全桥：当前无需暴露 Node 能力，保留隔离结构

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {});
