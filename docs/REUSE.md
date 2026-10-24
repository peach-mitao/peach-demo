# 复用与实现边界

文案工具条由官网 `browser/assets/edit-toolbar.ts` 维护，使用真实 BoardUI 按钮与应用 SelectionDock 的浮动栏几何；两站加载同一份构建产物。`npm run edit:ui:sync -- <官网检出目录>` 同步该产物并记录 `editor-ui-source.json`，浏览器构建校验字节摘要。演示站的 `browser/copy-editor.ts` 只适配浏览器草稿、导出和退出。工具条样式隔离在 Shadow DOM 内，帮助提示支持悬停、焦点和点击。底部说明允许点击编辑与选择文字；控件文字可用 Alt + 点击。

依赖版本以 `package.json` 和 `package-lock.json` 为准；新增工具均为开发依赖，不作为浏览器全局运行库。

| 能力 | 实现与许可 | 验证与边界 |
| --- | --- | --- |
| IP 服务地区 | Cloudflare 原生地区、ipaddr.js 2.5.0（MIT）、DB-IP Country Lite（CC BY 4.0）与 IPLocate Country（CC BY-SA 4.0） | 任一来源判断为大陆即跳转；IPv4／IPv6 并集离线查询，原始归档哈希及版本保存在生成文件，页面保留两库署名。CSV、压缩包与区间导出复用 Python 标准库，不增加运行时 Python 依赖；不外发访问者 IP。GeoLite 与 IPinfo 需要账号凭据，本任务使用可公开下载的官方独立库。IP 地区判断不能保证零误判 |
| TS 类型检查 | TypeScript 7.0.2，Apache-2.0 | 严格检查回放、浏览器、维护脚本、测试与 Cloudflare 配置；Node 24.12 起直接运行可擦除类型，esbuild 生成浏览器 JS，无需额外运行器 |
| Cloudflare 配置与发布 | cf 1.0.0-beta.18，MIT OR Apache-2.0；Wrangler 4.151.2，MIT OR Apache-2.0 | 使用官方 `cf migrate`；构建结果核对名称、域名、Assets 绑定及静态路由，本地验证回放与媒体；固定 beta 版本，由 Dependabot 跟踪更新 |
| 静态资源转换 | 既有 Acorn、esbuild 与 `@noble/hashes` | 保留录制键与内容指纹差异；合成夹具验证图片映射、前端包和私有视频对象清单 |
| 浏览器回放 | 既有回放算法、原生 fetch、Response 和 Map | `createReplay` 同时供浏览器与 Worker 使用；构建器按读取契约导出公开快照，按内容指纹加载并合并并发，不引入 Service Worker 或持久数据库 |
| 图片缩略图 | Sharp 0.35.5，Apache-2.0 | 仅在构建阶段按内容生成 384、960 像素 WebP，保留动画与较小原图；复用项目既有图片处理技术，不使用在线付费图片转换；浏览器与 Linux/Windows 构建验证兼容性 |
| 播放器预打包 | 既有 esbuild 与同步的 Video.js | 从应用 AST 取得按需模块组，构建单个内容指纹 ESM；保持按需加载与模块顺序，不手改 vendored 产物 |
| 原位文字编辑 | Peach 主仓库 `frontend/src/copy-editor-core.js`，AGPL-3.0-only | 与应用、官网共享点击、输入、删除、草稿串联和错误处理；演示适配器只保存浏览器草稿。固定来源提交与 SHA-256，检查入口拒绝单独修改副本 |
| 播放交互演示 | 原生 HTMLMediaElement、现有 Video.js 和浏览器事件 | 保留播放器控件；阻止媒体地址赋值、自动加载与播放，点击提示「仅提供演示」。CSP 禁止媒体加载，Worker 的 `/stream` 返回 403 JSON；没有新增依赖、媒体服务或视频流量 |
| 普通电影资料 | Blender 官方片目、Wikidata CC0 结构化资料、Commons 逐图许可、既有 fixtureKey 与 SHA-256 | 片目和人物来源固定在 `src/public-film-catalog.json`；操作状态明确为演示。生成器只复用旧响应的字段结构，来源证书与发布门槛拒绝混入旧数据和图片，不访问真实账本 |
| 登录与首次设置 | 同步来源提交中的 `peach.routes_auth`、`peach.routes_pages` 与 `onboarding`，AGPL-3.0-only | 直接导出应用页面壳和题目定义；使用占位配置，来源提交与前端指纹绑定，未复制页面实现 |
| 配置与任务示例 | 既有录制键、馆藏目录和浏览器草稿 | 原生 JSON、Map 与 WebVTT 提供演示数据；沿用应用字段、组件和控件，不增加依赖或外部请求 |
| 标签管理 | 应用标签管理 API 契约、既有标签名册和页面草稿 | 本地与在线库存分别回放；预览令牌校验版本与操作，改名、合并、隐藏和恢复只改变页面草稿；刷新恢复，`test:tags` 检查完整操作 |
| 页面覆盖 | 既有 Playwright 1.64.1，Apache-2.0 | 录制和验收共用路由清单；桌面、手机、分区与详情留存截图和请求结果，证据不进 Git |
| 点击与动线 | 官网共用 TypeScript 协议、观察器与产物检查器，AGPL-3.0-only | `behavior-source.json` 固定来源提交和哈希；不增加前端依赖。规则在本仓库维护，批量事件发送到官网 Worker；D1、私有 R2 和 Access 由官网管理。发布拒绝来源草稿、未映射控件与截图指纹漂移 |
| 独立 404 页 | 官网的支持页模板、TypeScript 语言解析器与 Peach 应用样式，AGPL-3.0-only | `support-source.json` 固定官网提交及逐文件摘要，发布检查拒绝来源草稿和资源漂移。页面按语言偏好显示一种语言；API 与私有资源的 404 保持各自响应格式 |

公开演示的媒体清单固定为空，不上传或读取视频。封面、影片代表图和关注图片由已有 Sharp 构建为内容指纹资源。`test:public-movies` 在桌面和手机验证封面、播放器控件、提示、素材来源和编辑工具条，并核对没有视频请求。

公开构建目录为 `public/`，素材输入为 `site/`。原始 `_fixtures/`、`_media/` 不进入公开资源；Worker 通过公开映射读取同一批已筛选快照，私有路径返回 404。图片直接使用 Static Assets；`/stream` 编号入口只返回演示提示。页面注入与普通电影术语投影在构建阶段完成，前端同步的来源文件保持原字节。

回放数据需要 Peach 的请求参数、录制键、身份目录与模拟状态语义，采用现有纯函数。未采用 MSW 或 Service Worker：当前已有 fetch 适配且无需拦截整个浏览器网络，额外运行时、注册与版本生命周期不能减少必要的数据导出。未采用新数据库或后端服务。公开 DTO 清除凭据、来源 URI 和私人路径，保留已保存标记与页面内模拟状态。

验证入口为 `npm run check`、`npm test`、`npm run check:deploy`，真实素材下补充 `test:browser`、`test:search`、`test:tags`、`test:routes`、`test:stream` 与 `test:replay`。`test:replay` 核对固定轮询、搜索和关注页无动态 API 网络请求、60 秒静置请求及私有目录隔离。本仓库不写入真实账本；代码合并不代表生产已部署。
