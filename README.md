# Peach 演示站

[在线演示](https://demo.peach.video/) · [官网](https://peach.video/) · [Peach 应用](https://github.com/peach-mitao/peach)

复用 Peach 前端，由 Cloudflare Worker 回放录制响应。交互状态只在当前页面演示，刷新恢复录制状态；不连接真实账本。

## 工程准备

使用 Node.js 24 LTS 或更新的 LTS，在本仓库目录安装依赖：

```powershell
npm ci
```

从已经构建前端的 Peach 检出同步静态代码，保留第三方许可证。`web/css/` 中的样式分区按应用的文件名规则和层叠顺序拼成 `app.css`：

```powershell
npm run sync -- ../peach
```

从本地录制包导入 `_fixtures/`、`_media/` 和可选的 `_demo/follow/`。这些数据不进入 Git：

```powershell
npm run assets:import -- <录制包目录>
```

录制包应包含 `_fixtures/manifest.json` 与 `_fixtures/catalog.json`。录制包由维护者单独管理，公开源码不附带媒体或真实响应。纯代码检查和合成数据测试不需要录制包。

## 预览与验证

启动只监听回环地址的预览，地址为 `http://127.0.0.1:8791/`：

```powershell
npm run dev
```

检查语法、工程入口和合成数据回放行为：

```powershell
npm run check
npm test
```

`/?edit` 提供原位改字，草稿只保存在当前浏览器，可导出；普通页面不应用草稿。自动教程由 `?tour=` 选择。提示条位于页面底部中间，并让开教程与 Toast。

## 发布

使用已登录的 Cloudflare 账号发布；入口先检查前端与录制清单是否完整：

```powershell
npm run deploy
```

`wrangler.jsonc` 沿用 `peach-demo` 与 `demo.peach.video`。脚本、样式、字体和演示交互直接通过静态资源层返回；页面、接口和私有回放文件经过 Worker。`/_fixtures/` 与 `/_media/` 对公网返回 404，视频经 `/stream` 提供 Range 响应。

## 项目边界

本仓库管理回放协议、Worker、演示交互与部署配置。应用和前端源码在 `peach-mitao/peach`，官网在 `peach-mitao/peach-site`。编译产物、录制响应、媒体、数据库、凭据、缓存与本地证据不进入 Git。源码及素材的许可范围见 [NOTICE](NOTICE.md)。
