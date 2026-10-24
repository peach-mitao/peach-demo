# 许可与数据

地区访问判断使用 [ipaddr.js](https://github.com/whitequark/ipaddr.js) 2.5.0（MIT）。`src/region-data.ts` 是 [DB-IP Country Lite](https://db-ip.com/db/lite.php) 与 [IPLocate Country](https://github.com/iplocate/ip-address-databases) 的 `CN` 网段并集，派生数据按 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 分发；DB-IP 原始数据按 CC BY 4.0 分发。版本、来源地址及原始归档 SHA-256 保留在生成文件的 `sources` 中，页面保留两家数据提供者链接。此数据许可不改变项目自有代码许可。

本项目自有代码及从 Peach 派生的前端交互按 AGPL-3.0-only 发布，见 `LICENSE`。Peach 前端源码在 `https://github.com/peach-mitao/peach`。同步前端时一并保留 `web/vendor/` 中的第三方许可证。

录制响应、数据库、媒体、照片、封面和关注图不随 Git 仓库发布。部署需要独立提供本地录制包；源码许可不授予其中第三方素材的权利。投诉入口为 `https://peach.video/copyright/`。

静态图片地址解析使用 MIT 许可的 `@noble/hashes`，其许可随回放运行时构建产物保留。构建工具使用 MIT 许可的 Acorn 与 esbuild，以及 Apache-2.0 许可的 Sharp。

独立 404 页从 Peach 官网同步，来源见 `support-source.json`。页面复用 Peach 应用样式，其中 BoardUI 与 Tailwind CSS 按 MIT 许可使用，编译样式保留 Tailwind 的许可声明。Inter 5.3.0 的 SIL Open Font License 与来源说明位于 `site/assets/support-ui/inter/`。
