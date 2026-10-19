# 复用与实现边界

依赖版本以 `package.json` 和 `package-lock.json` 为准；新增工具均为开发依赖，不作为浏览器全局运行库。

| 能力 | 实现与许可 | 验证与边界 |
| --- | --- | --- |
| TS 类型检查 | TypeScript 7.0.2，Apache-2.0 | 严格检查回放模块与 Cloudflare 配置；Node 24.12 起直接运行可擦除类型语法，无需 `tsx` 运行器 |
| Cloudflare 配置与发布 | cf 1.0.0-beta.18，MIT OR Apache-2.0；Wrangler 4.151.2，MIT OR Apache-2.0 | 使用官方 `cf migrate`；构建结果核对名称、域名、Assets 绑定及静态路由，本地验证回放与媒体；固定 beta 版本，由 Dependabot 跟踪更新 |
| 静态资源转换 | 既有 Acorn、esbuild 与 `@noble/hashes` | 保留录制键与内容指纹差异；合成夹具验证图片映射、前端包和私有视频长度清单 |
| 视频范围回退 | Web Streams 与 Fetch 原生 API | Assets 绑定的本地实证中，携带 Range 仍返回 200 与完整正文；适配层流式跳过和截取，并传递取消，不使用整段缓冲 |

视频适配只负责回放 URL、私有目录和单范围响应。已有通用静态资源层负责文件分发；上游原生返回 206 时直接传递正文。HEAD 不读取视频正文。尾段仍需要消费到目标位置，不能把内存改进视为上游原生范围读取；更换视频存储需要单独核对发布入口与素材迁移。

验证入口为 `npm run check`、`npm test`、`npm run check:deploy`，真实素材下补充 `test:browser`、`test:search` 与 `test:stream`。本仓库不写入真实账本；代码合并不代表生产已部署。
