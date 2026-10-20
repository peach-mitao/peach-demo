# 演示站维护

本仓库维护 Cloudflare Worker、回放协议和演示交互。应用前端的源码在 [Peach 主仓库](https://github.com/peach-mitao/peach)，构建产物通过同步入口取得。录制包由维护者单独管理，合成数据测试不需要录制包。

工具选型与复用边界见[复用说明](REUSE.md)。

## 环境与检查

使用 Node.js 24.12 或更新的受支持 LTS。以下命令均在本仓库根目录执行。

按锁文件安装依赖：

```powershell
npm ci
```

生成 Cloudflare 运行时类型，检查 TypeScript、JS 语法和工程入口：

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

`src/*.ts` 为录制键、媒体地址、名册、发现、关注分页和视频流提供类型契约。Node 直接运行可擦除类型的 TS，`tsc --noEmit` 独立检查类型；Cloudflare 配置和 TS 维护脚本也纳入类型检查。浏览器直接加载的交互保持 JS；Node 测试使用原生 ESM。依赖版本只在 `package.json` 与锁文件维护，构建输出不进 Git。

## 前端与录制包

通过 `npm run sync -- <Peach 检出目录>` 同步已构建的 `web/`，包含 React 包、样式、字体与第三方许可。`app.css` 按应用的样式分区顺序拼接。不要在演示仓库修改应用构建产物。

2026-10-20 同步 Peach 0.46.1（应用提交 `9d3cebf79`）。`site/_demo/frontend-source.json` 记录完整提交、版本和每个同步文件的 SHA-256；发布检查拒绝产物漂移。目录树、文件夹筛选及用途规则由演示馆藏生成，操作只保留在当前页面内存中，刷新恢复。`npm run test:folders` 验证模拟目录、筛选、封面与滚动边界；`test:browser` 包含编辑模式的切换与保存恢复。

同步前端后，使用应用的 Python 环境执行 `scripts/record_entry_pages.py <应用检出目录>`。它直接调用同一检出的登录页、首次设置页和题目定义，将占位配置写入私有录制包的 `entry-pages.json`，不读取实际配置、账本或服务。入口页提交必须与前端指纹一致，否则素材构建拒绝继续。演示入口为 `/login` 和 `/setup`，提交只返回演示结果。

`scripts/prepare_showcase.mjs` 在素材构建时补齐演示配置：本地、115 与 PikPak 媒体库，CloudDrive API／数据代理、下载渠道、浏览器添加 JAV、索引器、诊断选项，以及云下载、想要清单和文件记录示例。字段与应用契约一致；资源查询只从已导入作品生成示例，字幕搜索返回演示文本，不连接来源。诊断和馆藏上传默认关闭。凭据输入只保留页面内的已保存标记，卸载和真实系统操作不可执行。

站标目录完整同步应用的 `resources/site-marks/`，包含来源说明。视频预览开关和扫描策略共享当前页面草稿；任务页按现有录制任务分页，未录制 favicon 显示通用站点标识。

`scripts/demo_pages.mjs` 统一登记浏览页、全部配置分区、登录与首次设置，以及资产、作品、帖子和各类实体详情。`node scripts/record_pages.mjs` 录制桌面与 390×844 手机画面、可见分区和实际请求，报告写入本地 `evidence/coverage/`；`npm run test:routes` 对同一清单执行验收，拒绝运行错误、接口或图片缺失、未结束的等待态和横向溢出。两者需要已导入的演示录制包，默认使用端口 8791，可用 `BASE` 指定预览地址。

`?edit` 与应用、官网共用唯一的 `frontend/src/copy-editor-core.js`；`site/_demo/copy-editor.js` 只提供浏览器草稿和工具条。普通点击切换页面控件，Alt+点击编辑控件文字；清空文字可删除，刷新后保留本浏览器的编辑草稿。核心由 `edit:sync` 从应用固定提交同步，`copy-editor-source.json` 记录完整提交及 SHA-256，`npm run check` 拒绝副本漂移。不要单独修改同步副本。

通过 `npm run assets:import -- <录制包目录>` 导入 `_fixtures/`、`_media/` 和可选的 `_demo/follow/`。录制包必须包含 `manifest.json`、`catalog.json` 和 `indexes.json`；名册保留稳定身份 ID，馆藏目录保留完整标签与实体作品范围。未录制的接口返回 404。录制响应、媒体、数据库与凭据不进 Git。

`npm run assets:build` 从录制图片生成内容指纹静态副本和演示前端包，并生成私有视频清单 `_media/index.json`。清单记录编号、长度和 `demo/videos/<SHA-256>.mp4` 对象键，相同内容复用对象。原始视频留在本地录制目录，由 `site/.assetsignore` 排除在 Assets 发布范围外。`npm run build` 先生成这些素材，再执行 `cf build`。前端同步来源与版本应由维护者随同步更新记录，不从录制响应的历史服务版本推断当前代码。

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

用 `npm run dev` 启动 `http://127.0.0.1:8791/`。本地 R2 状态位于 `.wrangler/state`，与 cf 的 Wrangler 构建器共用，不访问远程桶。`?edit` 提供浏览器本地改字草稿，普通页面不应用草稿；`?tour=` 选择教程。搜索记录、收藏、扫描控制与演示写操作均不产生服务器持久写入。

预览运行时，`npm run test:browser` 检查桌面、手机、图片、播放记录撤销和扫描控制；`npm run test:search` 检查搜索推荐、作者头像与视口变化。这些检查需要录制包和本机 Chrome。

`npm run test:stream` 验证视频首段、中段、末段、后缀、HEAD、越界、播放跳转、卡片悬停预览及进度条缩略图。`/stream` 使用 `MEDIA` R2 绑定原生读取单个范围；HEAD 只读取对象元数据。If-Range 按 ETag 或修改时间判断，元数据与正文用 ETag 条件保持一致。图片、时间轴和九宫格由原有图片回放路径提供。

远程视频使用既有 `peach-public-media` 桶。以下上传会产生 R2 写入和回读请求，只处理清单中的内容指纹对象，不删除桶中内容。上传前应取得该环境的发布授权，并使用已登录的 Cloudflare 账号：

```powershell
npm run media:upload
```

仅回读远程对象并核对长度和 SHA-256：

```powershell
npm run media:verify
```

`npm run deploy` 会检查素材完整性、前端来源指纹、入口页提交，构建并核验远程视频，再用 `cf deploy --prebuilt` 发布同一份产物；缺失或内容不符会拒绝发布。本机发布直接使用 Cloudflare 认证，不依赖 GitHub Actions 或仓库推送。发布后对线上地址运行 `test:routes`，并核对私有目录返回 404、视频 Range 返回 206、图片使用 `/_demo/images/`，活动和播放上报不产生网络请求。R2 读取、静态缓存命中率与 Worker 调用数分别判断。

## Cloudflare 配置与依赖更新

本项目使用固定版本的 `cf` 与 [`cloudflare.config.ts`](https://developers.cloudflare.com/cf/projects/cloudflare-config/)，Worker 名称、域名、绑定、静态路由和可观测性在此维护。`wrangler.config.ts` 仅维护打包器设置、素材目录和本地监听地址；Wrangler 是 cf 调用的打包依赖。`.cloudflare/` 保存生成类型和 Build Output，不进 Git。配置由官方 `cf migrate` 转换；这套配置仍为公开测试版，升级须核对构建和本地行为。

Dependabot 分别对普通小版本更新与安全更新分组，大版本单独审阅；`@types/node` 保持 Node 24 运行基线，只自动更新同一大版本。CI 在 Windows 和 Linux 执行安装、类型与语法检查、行为测试及 cf 构建检查；没有需要随 npm 更新重算并提交的 vendored 产物。涉及 Playwright 的更新还应运行依赖真实素材的浏览器检查，涉及打包的更新应核对预览。源码和素材的许可范围见 [NOTICE](../NOTICE.md)。
