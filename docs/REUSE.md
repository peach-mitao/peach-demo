# 复用与实现边界

依赖版本以 `package.json` 和 `package-lock.json` 为准；新增工具均为开发依赖，不作为浏览器全局运行库。

| 能力 | 实现与许可 | 验证与边界 |
| --- | --- | --- |
| TS 类型检查 | TypeScript 7.0.2，Apache-2.0 | 严格检查回放模块与 Cloudflare 配置；Node 24.12 起直接运行可擦除类型语法，无需 `tsx` 运行器 |
| Cloudflare 配置与发布 | cf 1.0.0-beta.18，MIT OR Apache-2.0；Wrangler 4.151.2，MIT OR Apache-2.0 | 使用官方 `cf migrate`；构建结果核对名称、域名、Assets 绑定及静态路由，本地验证回放与媒体；固定 beta 版本，由 Dependabot 跟踪更新 |
| 静态资源转换 | 既有 Acorn、esbuild 与 `@noble/hashes` | 保留录制键与内容指纹差异；合成夹具验证图片映射、前端包和私有视频对象清单 |
| 视频原生范围读取 | Cloudflare R2 Workers API 与 cf R2 对象命令 | 复用既有桶；`head` 取得元数据，`get` 的 offset/length 直接读取目标字节；测试核对大对象尾段、取消和 ETag 条件 |

视频适配负责稳定的 `/stream` URL、私有编号清单和单范围响应。原生范围语义采用 [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)，正文直接传递给客户端，取消传给 R2。HEAD 不读取视频正文；范围不需要消费前面的字节。视频按 SHA-256 生成不可变对象键，上传与发布前逐个回读核对内容。原始 MP4 不作为 Assets 发布，图片、时间轴和九宫格继续使用静态图片与回放接口。

验证入口为 `npm run check`、`npm test`、`npm run check:deploy`，真实素材下补充 `test:browser`、`test:search` 与 `test:stream`。本仓库不写入真实账本；代码合并不代表生产已部署。
