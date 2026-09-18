# 15 分钟生活圈智能体检助手

> 基于百度地图开放能力，输入一个社区中心点，自动计算真实步行 15 分钟可达范围（等时圈），
> 盘点圈内菜市场 / 药店 / 小学 / 社区医院等民生设施覆盖情况，标注「服务盲区」，并输出可视化体检报告。

作者：肖沐樑　QQ：3387432690
完成时间：2026，09，18

---

## 一、项目简介

「15 分钟生活圈」是城市社区治理的核心指标。本项目把「配套够不够」从主观判断变成可量化、
可可视化、可复盘的硬指标：以任意社区中心点为起点，沿真实步行路网测算可达范围，
统计圈内各类民生设施，找出设施匮乏的灰色区域，最后给出一份带评分的体检报告。

应用同时提供 **Web 版** 与 **桌面版（Electron 安装包 / 绿色版）**，两种形态共用同一套后端代码。

## 二、功能特性

| 功能 | 说明 |
| --- | --- |
| 15 分钟等时圈 | 扇形采样 + 批量距离矩阵测时 + 空间插值，推导近似连通可达区域，而非直线圆 |
| 设施覆盖盘点 | 菜市场 / 药店 / 小学 / 社区医院 / 公园 / 银行等，统计圈内数量与最近可达时长 |
| 服务盲区识别 | 在等时圈内网格化判定「1km 内是否缺失某类设施」，高亮灰色盲区并输出清单 |
| 可视化体检报告 | 等时圈热力图 + 设施柱状图 + 各维度评分星级 / 进度条 + 盲区清单 |
| 自定义中心点 | 地图点选 / 地址搜索 / 直接输入经纬度 |
| 容错降级 | 未配置 AK 时自动用直线距离估算，无密钥也能完整演示 |

## 三、技术栈

- **后端**：Python 3.13 + FastAPI + uvicorn + httpx + pydantic + SQLite
- **前端**：原生 HTML / CSS / JavaScript + 百度地图 JS API + ECharts
- **桌面壳**：Electron + electron-builder
- **打包**：PyInstaller（后端 → `server.exe`）、electron-builder（nsis 安装包 + zip 绿色版）
- **开放能力**：百度地图地理编码 / POI 周边检索 / 批量距离矩阵（步行）

## 四、目录结构

```text
15-minute-living-circle/
├─ server.py              后端入口：FastAPI + 静态托管 + 体检接口
├─ app/
│  ├─ config.py           AK 读取（用户配置 > 环境变量 > .env）+ 日志脱敏
│  ├─ cache.py            SQLite 缓存，相同条件命中即秒出
│  ├─ map_api.py          百度地图封装：地理编码 / POI / 批量距离矩阵
│  ├─ isochrone.py        等时圈：扇形采样 + 批量测时 + 空间插值
│  ├─ blindspot.py        服务盲区识别
│  └─ score.py            覆盖度评分（星级）
├─ web/                   纯静态前端（由后端托管）
│  ├─ index.html  css/  js/  vendor/
├─ main.js  preload.js    Electron 壳
├─ scripts/
│  ├─ build.bat           一键打包脚本
│  └─ make-icon.ps1       图标生成
├─ Dockerfile  docker-compose.yml       容器化部署
├─ .gitee/workflows/build.yml           CI 门禁
├─ .env.example           密钥样例（复制为 .env 使用）
└─ requirements.txt / package.json
```

## 五、快速开始

### 方式一：浏览器直接运行（推荐给评审）

```bash
git clone https://gitee.com/zhang-san-zhanshan/15-minute-living-circle.git
cd 15-minute-living-circle
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
python server.py
```

然后打开浏览器访问 <http://127.0.0.1:8765> 。

### 方式二：Docker 一键启动

```bash
docker compose up -d
```

同样访问 <http://127.0.0.1:8765> 。（需在 `.env` 里配置 AK，见第六节）

### 方式三：桌面安装包 / 绿色版

```bash
npm install
scripts\build.bat
```

产物在 `release\` 目录：安装版 `*.exe` 与绿色版 `*.zip`。
桌面版**不需要**目标机器安装 Python / Node，但需要联网（要访问百度地图开放平台）。

> 桌面版用户配置与缓存位于 `%APPDATA%\shenghuoquan\`，卸载不删除，重装直接可用。

## 六、API Key 配置与脱敏

本项目需要百度地图两类 AK：

| 变量 | 类型 | 用途 |
| --- | --- | --- |
| `BAIDU_AK` | 服务端 AK | 地理编码 / POI 检索 / 批量距离矩阵 |
| `WEB_AK` | 浏览器端 AK | 前端百度地图 JS API 底图渲染 |

配置方式（按优先级）：

1. 打包版：界面里填写，存入 `%APPDATA%\shenghuoquan\peizhi.json`；
2. 开发版：环境变量；
3. 开发版：项目根目录 `.env` 文件（从 `.env.example` 复制）。

**脱敏约定（对应评审「开源工程规范」）**：

- `.env` / `peizhi.json` 已在 `.gitignore` 中排除，**绝不入库**；
- `electron-builder` 打包时显式排除 `**/.env`；
- 日志中 AK 经 `yinshen()` 处理，仅保留头尾各 3 位。

## 七、一键构建

`scripts\build.bat` 把三步串起来：

1. 生成图标 `logo.ico`（需 `assets/logo.png`）；
2. `PyInstaller` 编译后端为 `server.exe`（含 `uvicorn` hidden-import 与 `web` 资源）；
3. `electron-builder` 输出安装包与绿色版到 `release\`。

## 八、CI/CD

`.gitee/workflows/build.yml`，每次 push / PR 自动执行：

- `flake8` 代码规范门禁；
- `pytest` 算法单测；
- 通过后在 Windows 环境自动 `electron-builder` 打包并上传产物。

## 九、许可证

本项目基于 [MIT License](LICENSE) 开源。

## 十、作者

肖沐樑　QQ：3387432690
