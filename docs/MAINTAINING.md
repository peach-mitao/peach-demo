# 演示站维护

本仓库维护 Cloudflare Worker、回放协议和演示交互。应用前端的源码在 [Peach 主仓库](https://github.com/peach-mitao/peach)，构建产物通过同步入口取得。公开数据使用固定的普通电影片目，操作状态明确标为演示，不读取真实账本。自动化测试使用隔离夹具。

所有请求先使用 Cloudflare 的 `request.cf.country` 和边缘设置的 `CF-Connecting-IP` 判断地区。Cloudflare 为 `CN`，或 DB-IP Country Lite、IPLocate Country 任一库命中大陆网段，即跳转到 `/unavailable`，提示页返回 403 并复用 404 样式。`HK`、`MO`、`TW` 不按国家码拦截，库间冲突仍以任一来源命中即拦截。页面、回放快照、图片、同源视频入口和接口执行同一判断，仅提示页的样式、字体和标识放行。跳转和提示页为 `private, no-store`，静态资源经过 Worker，资源请求均产生 Worker 调用；独立媒体域名不在两站判断范围内。浏览器已保存且没有重新请求的内容无法远程撤回。

两个辅助库仅导出 `CN` 网段，IPv4、IPv6 及 IPv4 映射 IPv6 均在 Worker 内查询，不外发访问者 IP，不使用语言、时区、`X-Forwarded-For` 或客户端地区声明。官网 Cloudflare Cron 每天 06:30 UTC（Asia/Taipei 14:30）检查数据，原子更新两站共用的 R2 `peach-region-data` 生效表；无大陆网段变化不替换，更新失败保留有效表。演示站通过 `REGION_DATA` 绑定读取，每个实例最多约五分钟重新读取，合并并发请求；读取失败保留实例中的有效表，冷启动使用 `src/region-data.ts` 的内置快照。整个流程不依赖本机或 Codex，也不需要每天重新发布网站。

内置快照保存官方归档版本、地址、SHA-256 与来源计数。手工生成可使用 Python 标准库脚本 `scripts/build_region_data.py`，提供 `--dbip`、`--dbip-month`、`--iplocate` 和 `--iplocate-revision` 参数；构建和 Worker 运行不需要 Python。文案统一按官网维护。

工具选型与复用边界见[复用说明](REUSE.md)。

## 独立 404 页

`scripts/sync_support_pages.ts` 接收官网检出目录，同步 404、语言解析器、生产样式与许可；`support-source.json` 记录来源和摘要。浏览器构建允许来源草稿预览，发布产物检查要求已提交来源，且所有副本摘要一致。

文档导航找不到页面时，Worker 返回独立 HTML 与 404 状态，禁止缓存；API 与私有资源保持自身的 404 响应。支持页资源使用 `/assets/support-ui/`，避免与 `/assets/:id` 页面路由重叠。`?edit` 复用演示站原位编辑器，草稿只保存在本浏览器。

## 环境与检查

使用 Node.js 24.12 或更新的受支持 LTS。以下命令均在本仓库根目录执行。

按锁文件安装依赖：

```powershell
npm ci
```

生成浏览器脚本与 Cloudflare 运行时类型，检查 TypeScript、构建产物语法和工程入口：

```powershell
npm run check
```

运行合成数据回放、静态图片构建和前端同步测试：

```powershell
npm test
```

检查 cf 配置与构建，不上传资源：

```powershell
npm run check:deploy
```

站点维护的 JavaScript 源码统一使用 TypeScript：`src/` 提供回放与媒体协议，`browser/` 提供交互、导览和编辑适配，`scripts/` 与 `tests/` 分别提供维护入口和回归。Node 直接运行可擦除类型的 TS；`tsconfig.json` 与 `tsconfig.browser.json` 分别严格检查 Node／Worker 和浏览器代码。检查入口拒绝在这些源码目录新增 `.js` 或 `.mjs`。

`npm run browser:build` 通过 esbuild 将浏览器源码编译到 `site/_demo/*.js`，不提交编译副本。素材构建和检查入口自动执行此步骤。应用同步包、第三方库及按来源锁定的共享编辑核心保持 JS 产物，通过指纹校验来源，不在本仓库维护副本实现。依赖版本只在 `package.json` 与锁文件维护。

## 前端与录制包

通过 `npm run sync -- <Peach 检出目录>` 同步已构建的 `web/`，包含 React 包、样式、字体、用户脚本集成文件与第三方许可。`app.css` 按应用的样式分区顺序拼接。不要在演示仓库修改应用构建产物。

当前同步的应用提交和版本以 `site/_demo/frontend-source.json` 为准，该文件同时记录每个同步文件的 SHA-256；发布检查拒绝产物漂移。目录树、文件夹筛选及用途规则由演示馆藏生成，操作只保留在当前页面内存中，刷新恢复。`npm run test:folders` 验证模拟目录、筛选、封面与滚动边界；`test:browser` 包含编辑模式的切换与保存恢复。

同步前端后，使用应用的 Python 环境执行 `scripts/record_entry_pages.py <应用检出目录>`。它直接调用同一检出的登录页、首次设置页、题目定义和用户脚本检测页，将占位配置写入私有录制包的 `entry-pages.json`，不读取实际配置、账本或服务。检测页保留应用的同源和 CSP 限制；脚本版本、最低连接版本和安装地址读取同步的发布清单。入口页提交必须与前端指纹一致，否则素材构建拒绝继续。演示入口为 `/login` 和 `/setup`，提交只返回演示结果。

`scripts/prepare_showcase.ts` 在素材构建时补齐演示连接配置：本地、115 与 PikPak 媒体库，CloudDrive API／数据代理、下载渠道、浏览器添加、索引器和诊断选项。业务状态来自普通电影生成器提供的 `recorded-state.json`，任务、想要清单和文件记录均为演示。资产和后续任务只有身份也在演示范围内才显示链接。资源搜索不连接来源、不生成真实候选。字幕搜索返回明确命名的演示文本。诊断和馆藏上传默认关闭。凭据输入只保留页面内的已保存标记，卸载和真实系统操作不可执行。

标签页的铅笔按钮进入管理模式。本地与在线标签均有独立库存，支持预览影响范围、改名、合并、隐藏和恢复；预览令牌绑定操作与库存版本。管理结果同步到标签浏览目录，刷新恢复录制数据，不产生服务器写入。`npm run test:tags` 在桌面与手机验证完整操作及刷新恢复。

同步弹窗显示流量与磁盘预估。演示操作不生成持久资料或媒体文件，两项预估均为零，磁盘容量不读取个人机器。

站标目录完整同步应用的 `resources/site-marks/`，包含来源说明。视频预览开关和扫描策略共享当前页面草稿；任务页按现有录制任务分页，未录制 favicon 显示通用站点标识。

`scripts/demo_pages.ts` 统一登记 59 个场景，包含浏览页、全部配置分区、登录与首次设置、各类详情，以及本地和在线标签管理模式。`node scripts/record_pages.ts` 录制桌面与 390×844 手机画面、可见分区、标签隐藏状态与改名弹层和实际请求，报告写入本地 `evidence/coverage/`；`npm run test:routes` 对同一清单执行验收，拒绝运行错误、接口或图片缺失、未结束的等待态和横向溢出。采样等待布局触发的懒加载请求结束。两者需要已导入的演示录制包，默认使用端口 8791，可用 `BASE` 指定预览地址。

`?edit` 与应用、官网共用唯一的 `frontend/src/copy-editor-core.js`；`site/_demo/copy-editor.js` 只提供浏览器草稿和工具条。普通点击切换页面控件，Alt+点击编辑控件文字；清空文字可删除，刷新后保留本浏览器的编辑草稿。核心由 `edit:sync` 从应用固定提交同步，`copy-editor-source.json` 记录完整提交及 SHA-256，`npm run check` 拒绝副本漂移。不要单独修改同步副本。

索引标题栏的回归还检查标题、收藏、管理与版式按钮、搜索栏是否同排，以及搜索栏是否保留可输入宽度；这类换行不一定造成页面横向溢出，因此需要单独检查几何。

普通电影数据由 `npm run assets:movies -- <夹具结构目录> <官方电影图片目录>` 生成。结构目录只贡献响应字段，数组、字符串与旧业务记录不被继承。片目与演示状态在 `src/public-movies.ts`；图片来自 Blender 官方页面，逐片来源与许可在 `/film-sources/`。生成器记录夹具、图片和别名的来源证明，`verifyPublicMovies` 同时检查固定片目、确定性配置派生和全部图片摘要；构建及发布拒绝未经核验的包。`assets:import` 只负责文件导入，不能替代这项门槛。录制响应、媒体、数据库与凭据不进 Git。

`npm run assets:build` 从 `site/` 生成 `public/`：静态页面、内容指纹图片、384／960 像素 WebP、公开快照、回放运行时和前端包。播放器模块按应用 AST 声明预打包为按需加载的单个 ESM。原始视频、录制目录与内部清单不进入 `public/`；公开快照只按已支持的读取契约导出，凭据、来源 URI 和私人路径被清除。Worker 与浏览器共用 `src/replay.ts`，不能分别修改查询算法。

私有清单 `_media/index.json` 的 `videos` 固定为空；来源核验拒绝混入任何视频。播放器、播放墙和沉浸入口保留，详情展示电影封面，点击播放显示「仅提供演示」。`src/demo-playback.ts` 阻止媒体地址、自动加载与实际播放；CSP 的 `media-src 'none'` 禁止媒体加载，Worker 的 `/stream` 返回 403 JSON 演示提示，不跳转外链。`npm run build` 先生成素材，再执行 `cf build`。前端同步来源与版本由维护者随同步更新记录。

构建时只投影可见文字为普通电影术语，内部 API 路径、字段与应用同步产物保持来源契约。播放不会推进进度或写入真实观看记录；评分、稍后看与任务操作仍使用当前页面草稿。

## 预览与发布

素材齐备后，先生成静态素材：

```powershell
npm run assets:build
```

查看视频对象数量和总字节数，不写入存储：

```powershell
npm run media:plan
```

核对桌面、手机、封面、播放器入口与无视频请求：

```powershell
npm run test:public-movies
```

用 `npm run dev` 启动 [本地预览](http://127.0.0.1:8791/)。`?edit` 提供浏览器本地改字草稿，普通页面不应用草稿；`?tour=` 选择教程。搜索记录、收藏、扫描控制与演示写操作均不产生服务器持久写入。`runWorkerFirst: true` 使所有请求先通过 Worker 地区判断，再读取 Assets 或执行回放接口。

预览运行时，`npm run test:browser` 检查桌面、手机、图片、播放记录撤销和扫描控制；`npm run test:search` 检查搜索推荐、作者头像与视口变化。这些检查需要录制包和本机 Chrome。

`npm run test:replay` 验证桌面与手机的首页、搜索和关注页没有动态 API 网络请求，首页静置 60 秒不新增请求。快照按场景首次需要时加载；同一内容的并发读取只产生一次网络请求。图片、快照和构建脚本均使用内容指纹与长期缓存，HTML 保持更新校验。新增读取契约时扩展 `scripts/build_replay.ts` 的公开清单，缺失数据明确返回未取得，不回退到来源服务。同步样式仍走既有前端同步入口，不在 `public/` 手工编辑。

`npm run test:stream` 与 `test:public-movies` 验证桌面和手机的封面、播放器控件、演示提示及无视频请求；用 `BASE` 指定现有预览地址。Worker 对播放与 Range 请求的 403 行为由单元测试覆盖。

公开演示不需要视频上传、媒体桶绑定或视频存储。现有桶中的历史对象不会由构建或预览删除。`npm run deploy` 检查素材来源、前端指纹、入口页提交和行为产物，再用 `cf deploy --prebuilt` 发布；发布需要维护者明确授权。发布后运行 `test:routes` 与 `test:stream`，核对私有目录 404、视频入口 403、图片内容指纹及浏览器操作不外发写入。

远程视频回读的临时网络错误按 2／4／6／8 秒退避，最多重试四次；权限、内容哈希及元数据不符直接拒绝。媒体域名 HEAD 请求在三十秒后取消；重试不会跳过任何对象或降低完整性门槛。

## Cloudflare 配置与依赖更新

本项目使用固定版本的 `cf` 与 [`cloudflare.config.ts`](https://developers.cloudflare.com/cf/projects/cloudflare-config/)，Worker 名称、域名、绑定、静态路由和可观测性在此维护。日志和 Issues 错误聚合随配置发布。`wrangler.config.ts` 维护打包器设置、素材目录和本地监听地址；Wrangler 也提供对象上传的缓存元数据参数，其他管理和部署沿用 cf。`.cloudflare/` 保存生成类型和 Build Output，不进 Git。配置由官方 `cf migrate` 转换；这套配置仍为公开测试版，升级须核对构建和本地行为。

Dependabot 分别对普通小版本更新与安全更新分组，大版本单独审阅；`@types/node` 保持 Node 24 运行基线，只自动更新同一大版本。CI 在 Windows 和 Linux 执行安装、类型与语法检查、行为测试及 cf 构建检查；没有需要随 npm 更新重算并提交的 vendored 产物。涉及 Playwright 的更新还应运行依赖真实素材的浏览器检查，涉及打包的更新应核对预览。源码和素材的许可范围见 [NOTICE](../NOTICE.md)。
