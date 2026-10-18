# Peach 演示站

[在线演示](https://demo.peach.video/) · [官网](https://peach.video/) · [Peach 应用](https://github.com/peach-mitao/peach)

复用 Peach 前端，由 Cloudflare Worker 回放录制响应。交互状态只在当前页面演示，刷新恢复录制状态；不连接真实账本。

同步入口使用 `web/dist/peach-app.js` 与 React 样式包。演示资料页使用稳定 ID，图片版本参数复用已审核素材；播放墙可直接打开，`/?favorites=1` 打开收藏示例，收藏与保存筛选的操作仅保留在当前页面。

前端同步基准为 `0.45.0`，源码提交为 `0dd4ff843ddb21fbde22bfafba8beb62ff8c013d`。录制响应与媒体独立管理，响应里的历史服务版本属于录制数据。扫描演示约 30 秒，可调整处理速度、暂停和继续；状态只保留在当前页面，刷新恢复录制值。

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

录制包应包含 `_fixtures/manifest.json`、`_fixtures/catalog.json` 与 `_fixtures/indexes.json`。名册目录保留稳定身份 ID，卖家与在线作者分别查询；资料详情按当前前端请求录制。馆藏目录包含完整筛选标签、标签类别和实体作品范围。发现视图的回放保留封面和规范标签，并支持排序；图片模式使用应用自身的设置。未录制的接口明确返回 404，未取得的网站图标使用应用的通用网站图标。录制包由维护者单独管理，公开源码不附带媒体或真实响应。纯代码检查和合成数据测试不需要录制包。

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

启动预览后，验证桌面与手机的 DPR 1 / 2 页面、可见图片、播放记录撤销、扫描控制和回放边界：

```powershell
npm run test:browser
```

`/?edit` 提供原位改字，草稿只保存在当前浏览器，可导出；普通页面不应用草稿。自动教程由 `?tour=` 选择。提示条位于页面底部中间，并让开教程与 Toast。

搜索推荐复用录制的关注来源和订阅新作，空分区不展示；搜索记录只在当前页面保留。手机提示与搜索下拉按可见视口留出间距。启动预览后可检查作者头像、推荐内容及视口缩小与恢复：

```powershell
npm run test:search
```

## 发布

使用已登录的 Cloudflare 账号发布；入口先检查前端与录制清单是否完整：

```powershell
npm run deploy
```

`wrangler.jsonc` 沿用 `peach-demo` 与 `demo.peach.video`。发布与本地预览先运行 `npm run build`，从录制图片生成 `/_demo/images/<内容 SHA-256>.<扩展名>`，再生成演示专用前端包。图片、脚本、样式、字体、图标和演示交互直接通过静态资源层返回；内容指纹图片允许浏览器长期缓存。接口响应中的图片地址也使用静态地址。未匹配的图片请求继续通过回放端点处理，页面、接口和私有回放文件经过 Worker。`/_fixtures/` 与 `/_media/` 对公网返回 404，视频经 `/stream` 提供 Range 响应。

处理状态在当前页面只读取一次，演示操作产生的临时状态也留在当前页面。播放与活动上报在浏览器内确认，不产生服务器写入。馆藏搜索、筛选、分页、资料查询和视频分段继续由 Worker 提供。静态图片构建只导出图片字节与不含业务数据的地址映射，不公开 JSON 录制文件或视频原件；生成文件不进入 Git。

发布验收同时核对功能与请求：有录制素材的图片使用 `/_demo/images/`，固定处理状态在单页只请求一次，`/api/activity` 与 `/api/play` 不产生网络请求。检查搜索、资料页和窄屏，并确认私有目录返回 404、视频 Range 返回 206。Cloudflare 的静态资源缓存命中率与 Worker 调用数分别统计；缓存命中本身不能证明请求绕过 Worker。

## 项目边界

本仓库管理回放协议、Worker、演示交互与部署配置。应用和前端源码在 `peach-mitao/peach`，官网在 `peach-mitao/peach-site`。编译产物、录制响应、媒体、数据库、凭据、缓存与本地证据不进入 Git。源码及素材的许可范围见 [NOTICE](NOTICE.md)。
