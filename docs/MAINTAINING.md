# 演示站维护

本仓库维护 Cloudflare Worker、回放协议和演示交互。应用前端的源码在 [Peach 主仓库](https://github.com/peach-mitao/peach)，构建产物通过同步入口取得。录制包由维护者单独管理，合成数据测试不需要录制包。

工具选型与复用边界见[复用说明](REUSE.md)。

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

`scripts/prepare_showcase.ts` 在素材构建时补齐演示连接配置：本地、115 与 PikPak 媒体库，CloudDrive API／数据代理、下载渠道、浏览器添加 JAV、索引器和诊断选项。业务状态从私有录制包的 `recorded-state.json` 读取，使用已批准公开的真实任务、想要清单和文件记录；没有记录时保留空状态，个人历史不随本地预览自动公开。下载任务须属于已导入馆藏，剔除来源地址、磁链、私有路径和错误细节；资产和后续任务只有身份也在录制范围内才显示链接。资源搜索保持未启用，不生成候选。字幕搜索返回明确命名的演示文本，不连接来源。诊断和馆藏上传默认关闭。凭据输入只保留页面内的已保存标记，卸载和真实系统操作不可执行。

标签页的铅笔按钮进入管理模式。本地与在线标签均有独立库存，支持预览影响范围、改名、合并、隐藏和恢复；预览令牌绑定操作与库存版本。管理结果同步到标签浏览目录，刷新恢复录制数据，不产生服务器写入。`npm run test:tags` 在桌面与手机验证完整操作及刷新恢复。

同步弹窗显示流量与磁盘预估。演示操作不生成持久资料或媒体文件，两项预估均为零，磁盘容量不读取个人机器。

站标目录完整同步应用的 `resources/site-marks/`，包含来源说明。视频预览开关和扫描策略共享当前页面草稿；任务页按现有录制任务分页，未录制 favicon 显示通用站点标识。

`scripts/demo_pages.ts` 统一登记 59 个场景，包含浏览页、全部配置分区、登录与首次设置、各类详情，以及本地和在线标签管理模式。`node scripts/record_pages.ts` 录制桌面与 390×844 手机画面、可见分区、标签隐藏状态与改名弹层和实际请求，报告写入本地 `evidence/coverage/`；`npm run test:routes` 对同一清单执行验收，拒绝运行错误、接口或图片缺失、未结束的等待态和横向溢出。采样等待布局触发的懒加载请求结束。两者需要已导入的演示录制包，默认使用端口 8791，可用 `BASE` 指定预览地址。

`?edit` 与应用、官网共用唯一的 `frontend/src/copy-editor-core.js`；`site/_demo/copy-editor.js` 只提供浏览器草稿和工具条。普通点击切换页面控件，Alt+点击编辑控件文字；清空文字可删除，刷新后保留本浏览器的编辑草稿。核心由 `edit:sync` 从应用固定提交同步，`copy-editor-source.json` 记录完整提交及 SHA-256，`npm run check` 拒绝副本漂移。不要单独修改同步副本。

索引标题栏的回归还检查标题、收藏、管理与版式按钮、搜索栏是否同排，以及搜索栏是否保留可输入宽度；这类换行不一定造成页面横向溢出，因此需要单独检查几何。

通过 `npm run assets:import -- <录制包目录>` 导入 `_fixtures/`、`_media/` 和可选的 `_demo/follow/`。录制包必须包含 `manifest.json`、`catalog.json`、`indexes.json` 和业务状态快照 `recorded-state.json`；名册保留稳定身份 ID，馆藏目录保留完整标签与实体作品范围。未录制的接口返回 404。录制响应、媒体、数据库与凭据不进 Git。

`npm run assets:build` 从 `site/` 生成 `public/`：静态页面、内容指纹图片、384／960 像素 WebP、公开快照、回放运行时和前端包。播放器模块按应用 AST 声明预打包为按需加载的单个 ESM。原始视频、录制目录与内部清单不进入 `public/`；公开快照只按已支持的读取契约导出，凭据、来源 URI 和私人路径被清除。Worker 与浏览器共用 `src/replay.ts`，不能分别修改查询算法。

构建生成私有视频清单 `_media/index.json`，记录编号、长度和 `demo/videos/<SHA-256>.mp4` 对象键，相同内容复用对象。公开视频映射只包含已批准内容的编号、对象键与长度。浏览器直接请求 `https://media.peach.video/demo/videos/<SHA-256>.mp4`，不携带播放会话；对象具有一年不可变缓存。已缓存页面的 `/stream?id=<编号>&v=<内容指纹>` 返回 308 到受控清单中的对象，陈旧指纹返回 404；无版本参数的跳转使用 no-cache。Worker 不绑定或读取媒体桶正文。`npm run build` 先生成素材，再执行 `cf build`。前端同步来源与版本由维护者随同步更新记录，不从录制响应的历史服务版本推断当前代码。

公开视频桶需要允许无凭据的跨域 GET/HEAD，供生产页面与本地预览读取视频像素。构建期 AST 适配在设置视频地址前写入 `crossOrigin="anonymous"`，保留氛围光的 Canvas 读取能力，不修改同步的应用构建文件。桶的 CORS 策略不授予写入或凭据访问；修改后按演示视频清单刷新对应媒体 URL。`test:stream` 同时检查实际视频像素可读取。

## 预览与发布

素材齐备后，先生成静态素材：

```powershell
npm run assets:build
```

查看视频对象数量和总字节数，不写入存储：

```powershell
npm run media:plan
```

导入本地 R2，并逐个回读核对 SHA-256：

```powershell
npm run media:local
```

用 `npm run dev` 启动 `http://127.0.0.1:8791/`。视频播放读取已发布的公开媒体域名，需要网络；`media:local` 只用于本地对象上传验证，不参与播放器请求。`?edit` 提供浏览器本地改字草稿，普通页面不应用草稿；`?tour=` 选择教程。搜索记录、收藏、扫描控制与演示写操作均不产生服务器持久写入。普通 HTML 与深链直接走 Assets；API、探活、登录表单、媒体编号跳转和私有目录拦截由明确的 `runWorkerFirst` 路径处理。

预览运行时，`npm run test:browser` 检查桌面、手机、图片、播放记录撤销和扫描控制；`npm run test:search` 检查搜索推荐、作者头像与视口变化。这些检查需要录制包和本机 Chrome。

`npm run test:replay` 验证桌面与手机的首页、搜索和关注页没有动态 API 网络请求，首页静置 60 秒不新增请求。快照按场景首次需要时加载；同一内容的并发读取只产生一次网络请求。图片、快照和构建脚本均使用内容指纹与长期缓存，HTML 保持更新校验。新增读取契约时扩展 `scripts/build_replay.ts` 的公开清单，缺失数据明确返回未取得，不回退到来源服务。同步样式仍走既有前端同步入口，不在 `public/` 手工编辑。

`npm run test:stream` 验证媒体域名的视频首段、中段、末段、后缀、HEAD、越界、播放跳转、卡片悬停预览及进度条缩略图，并检查正常播放没有 `/stream` 请求。Range、HEAD 与条件请求由 R2/CDN 提供。图片、时间轴和九宫格由原有图片回放路径提供。

远程视频使用既有 `peach-public-media` 桶。以下上传会产生 R2 写入和回读请求，只处理清单中的内容指纹对象，不删除桶中内容。上传前应取得该环境的发布授权，并使用已登录的 Cloudflare 账号：

```powershell
npm run media:upload
```

回读远程对象核对长度与 SHA-256，并检查媒体域名返回的长度与一年缓存元数据：

```powershell
npm run media:verify
```

`npm run deploy` 会检查素材完整性、前端来源指纹、入口页提交，构建并核验远程视频，再用 `cf deploy --prebuilt` 发布同一份产物；缺失或内容不符会拒绝发布。本机发布直接使用 Cloudflare 认证，不依赖 GitHub Actions 或仓库推送。发布后对线上地址运行 `test:routes`，并核对私有目录返回 404、视频 Range 返回 206、图片使用 `/_demo/images/`，活动和播放上报不产生网络请求。R2 读取、静态缓存命中率与 Worker 调用数分别判断。

## Cloudflare 配置与依赖更新

本项目使用固定版本的 `cf` 与 [`cloudflare.config.ts`](https://developers.cloudflare.com/cf/projects/cloudflare-config/)，Worker 名称、域名、绑定、静态路由和可观测性在此维护。日志和 Issues 错误聚合随配置发布。`wrangler.config.ts` 维护打包器设置、素材目录和本地监听地址；Wrangler 也提供对象上传的缓存元数据参数，其他管理和部署沿用 cf。`.cloudflare/` 保存生成类型和 Build Output，不进 Git。配置由官方 `cf migrate` 转换；这套配置仍为公开测试版，升级须核对构建和本地行为。

Dependabot 分别对普通小版本更新与安全更新分组，大版本单独审阅；`@types/node` 保持 Node 24 运行基线，只自动更新同一大版本。CI 在 Windows 和 Linux 执行安装、类型与语法检查、行为测试及 cf 构建检查；没有需要随 npm 更新重算并提交的 vendored 产物。涉及 Playwright 的更新还应运行依赖真实素材的浏览器检查，涉及打包的更新应核对预览。源码和素材的许可范围见 [NOTICE](../NOTICE.md)。
