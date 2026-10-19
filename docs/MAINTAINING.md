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

`src/*.ts` 为录制键、媒体地址、名册、发现、关注分页和视频流提供类型契约。Node 直接运行可擦除类型的 TS，`tsc --noEmit` 独立检查类型；Cloudflare 配置也纳入类型检查。浏览器直接加载的交互保持 JS；维护脚本与 Node 测试使用原生 ESM。依赖版本只在 `package.json` 与锁文件维护，构建输出不进 Git。

## 前端与录制包

通过 `npm run sync -- <Peach 检出目录>` 同步已构建的 `web/`，包含 React 包、样式、字体与第三方许可。`app.css` 按应用的样式分区顺序拼接。不要在演示仓库修改应用构建产物。

通过 `npm run assets:import -- <录制包目录>` 导入 `_fixtures/`、`_media/` 和可选的 `_demo/follow/`。录制包必须包含 `manifest.json`、`catalog.json` 和 `indexes.json`；名册保留稳定身份 ID，馆藏目录保留完整标签与实体作品范围。未录制的接口返回 404。录制响应、媒体、数据库与凭据不进 Git。

`npm run assets:build` 从录制图片生成内容指纹静态副本和演示前端包，并生成私有视频长度清单 `_media/index.json`。JSON、原始清单和视频留在私有回放目录。`npm run build` 先生成这些素材，再执行 `cf build`。前端同步来源与版本应由维护者随同步更新记录，不从录制响应的历史服务版本推断当前代码。

## 预览与发布

素材齐备后用 `npm run dev` 启动 `http://127.0.0.1:8791/`。`?edit` 提供浏览器本地改字草稿，普通页面不应用草稿；`?tour=` 选择教程。搜索记录、收藏、扫描控制与演示写操作均不产生服务器持久写入。

预览运行时，`npm run test:browser` 检查桌面、手机、图片、播放记录撤销和扫描控制；`npm run test:search` 检查搜索推荐、作者头像与视口变化。这些检查需要录制包和本机 Chrome。

`npm run test:stream` 验证视频首段、中段、末段、后缀、HEAD、越界、播放跳转及进度条缩略图。视频流传递 HEAD、Range 与 If-Range；上游忽略范围时，使用私有长度清单流式截取，到达末端后取消读取。HEAD 不读取视频正文。Assets 绑定仍可能忽略 Range，因此尾段请求仍需跳过前面的字节，不能据此声称上游只读取所需范围。

使用已登录的 Cloudflare 账号执行 `npm run deploy`，入口会检查素材完整性并构建，再用 `cf deploy --prebuilt` 发布同一份产物。发布核对私有目录返回 404、视频 Range 返回 206、图片使用 `/_demo/images/`，并确认活动和播放上报不产生网络请求。静态缓存命中率与 Worker 调用数分别判断。

## Cloudflare 配置与依赖更新

本项目使用固定版本的 `cf` 与 [`cloudflare.config.ts`](https://developers.cloudflare.com/cf/projects/cloudflare-config/)，Worker 名称、域名、绑定、静态路由和可观测性在此维护。`wrangler.config.ts` 仅维护打包器设置、素材目录和本地监听地址；Wrangler 是 cf 调用的打包依赖。`.cloudflare/` 保存生成类型和 Build Output，不进 Git。配置由官方 `cf migrate` 转换；这套配置仍为公开测试版，升级须核对构建和本地行为。

Dependabot 分别对普通小版本更新与安全更新分组，大版本单独审阅；`@types/node` 保持 Node 24 运行基线，只自动更新同一大版本。CI 在 Windows 和 Linux 执行安装、类型与语法检查、行为测试及 cf 构建检查；没有需要随 npm 更新重算并提交的 vendored 产物。涉及 Playwright 的更新还应运行依赖真实素材的浏览器检查，涉及打包的更新应核对预览。源码和素材的许可范围见 [NOTICE](../NOTICE.md)。
