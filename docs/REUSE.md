# 复用与实现边界

依赖版本以 `package.json` 和 `package-lock.json` 为准；新增工具均为开发依赖，不作为浏览器全局运行库。

| 能力 | 实现与许可 | 验证与边界 |
| --- | --- | --- |
| TS 类型检查 | TypeScript 7.0.2，Apache-2.0 | 严格检查回放、浏览器、维护脚本、测试与 Cloudflare 配置；Node 24.12 起直接运行可擦除类型，esbuild 生成浏览器 JS，无需额外运行器 |
| Cloudflare 配置与发布 | cf 1.0.0-beta.18，MIT OR Apache-2.0；Wrangler 4.151.2，MIT OR Apache-2.0 | 使用官方 `cf migrate`；构建结果核对名称、域名、Assets 绑定及静态路由，本地验证回放与媒体；固定 beta 版本，由 Dependabot 跟踪更新 |
| 静态资源转换 | 既有 Acorn、esbuild 与 `@noble/hashes` | 保留录制键与内容指纹差异；合成夹具验证图片映射、前端包和私有视频对象清单 |
| 浏览器回放 | 既有回放算法、原生 fetch、Response 和 Map | `createReplay` 同时供浏览器与 Worker 使用；构建器按读取契约导出公开快照，按内容指纹加载并合并并发，不引入 Service Worker 或持久数据库 |
| 图片缩略图 | Sharp 0.35.5，Apache-2.0 | 仅在构建阶段按内容生成 384、960 像素 WebP，保留动画与较小原图；复用项目既有图片处理技术，不使用在线付费图片转换；浏览器与 Linux/Windows 构建验证兼容性 |
| 播放器预打包 | 既有 esbuild 与同步的 Video.js | 从应用 AST 取得按需模块组，构建单个内容指纹 ESM；保持按需加载与模块顺序，不手改 vendored 产物 |
| 原位文字编辑 | Peach 主仓库 `frontend/src/copy-editor-core.js`，AGPL-3.0-only | 与应用、官网共享点击、输入、删除、草稿串联和错误处理；演示适配器只保存浏览器草稿。固定来源提交与 SHA-256，检查入口拒绝单独修改副本 |
| 视频原生范围读取 | Cloudflare R2 Workers API 与 cf R2 对象命令 | 复用既有桶；`head` 取得元数据，`get` 的 offset/length 直接读取目标字节；测试核对大对象尾段、取消和 ETag 条件 |
| 登录与首次设置 | 同步来源提交中的 `peach.routes_auth`、`peach.routes_pages` 与 `onboarding`，AGPL-3.0-only | 直接导出应用页面壳和题目定义；使用占位配置，来源提交与前端指纹绑定，未复制页面实现 |
| 配置与任务示例 | 既有录制键、馆藏目录和浏览器草稿 | 原生 JSON、Map 与 WebVTT 提供演示数据；沿用应用字段、组件和控件，不增加依赖或外部请求 |
| 标签管理 | 应用标签管理 API 契约、既有标签名册和页面草稿 | 本地与在线库存分别回放；预览令牌校验版本与操作，改名、合并、隐藏和恢复只改变页面草稿；刷新恢复，`test:tags` 检查完整操作 |
| 页面覆盖 | 既有 Playwright 1.64.1，Apache-2.0 | 录制和验收共用路由清单；桌面、手机、分区与详情留存截图和请求结果，证据不进 Git |
| 点击与动线 | 官网共用 TypeScript 协议、观察器与产物检查器，AGPL-3.0-only | `behavior-source.json` 固定来源提交和哈希；不增加前端依赖。规则在本仓库维护，批量事件发送到官网 Worker；D1、私有 R2 和 Access 由官网管理。发布拒绝来源草稿、未映射控件与截图指纹漂移 |

视频适配负责稳定的 `/stream` URL、私有编号清单和单范围响应。原生范围语义采用 [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)，正文直接传递给客户端，取消传给 R2。HEAD 不读取视频正文；范围不需要消费前面的字节。视频按 SHA-256 生成不可变对象键，上传与发布前逐个回读核对内容。原始 MP4 不作为 Assets 发布，图片、时间轴和九宫格继续使用静态图片与回放接口。

公开构建目录为 `public/`，素材输入为 `site/`。原始 `_fixtures/`、`_media/` 不进入公开资源；Worker 通过公开映射读取同一批已筛选快照，私有路径返回 404。图片直接使用 Static Assets；视频使用含内容指纹参数的 `/stream`，由 Worker 原生读取 R2 范围并复用对象元数据，版本匹配时允许长期缓存。选择同源视频路径以保留播放器跨域与缓存契约，不依赖媒体域名的未配置响应头。页面注入在构建阶段完成，前端同步的来源文件保持原字节。

回放数据需要 Peach 的请求参数、录制键、身份目录与模拟状态语义，采用现有纯函数。未采用 MSW 或 Service Worker：当前已有 fetch 适配且无需拦截整个浏览器网络，额外运行时、注册与版本生命周期不能减少必要的数据导出。未采用新数据库或后端服务。公开 DTO 清除凭据、来源 URI 和私人路径，保留已保存标记与页面内模拟状态。

验证入口为 `npm run check`、`npm test`、`npm run check:deploy`，真实素材下补充 `test:browser`、`test:search`、`test:tags`、`test:routes`、`test:stream` 与 `test:replay`。`test:replay` 核对固定轮询、搜索和关注页无动态 API 网络请求、60 秒静置请求及私有目录隔离。本仓库不写入真实账本；代码合并不代表生产已部署。
