# Peach 演示站

Peach 的在线体验入口，复用应用前端，通过录制数据展示馆藏浏览、搜索、资料页、播放和配置。演示包含云盘、下载渠道及任务示例；操作只在当前页面生效，刷新后恢复，不连接真实账本。

固定读取、搜索、筛选和分页在浏览器回放，页面与图片使用静态资源，视频通过 R2 的范围读取提供。站点维护代码使用 TypeScript，应用同步包保持来源指纹；构建和验证方式见[维护说明](docs/MAINTAINING.md)。

点击与匿名访问动线接入官网共用的 Cloudflare 分析链路。UI 改版时的标识、截图与发布检查见[行为统计维护](docs/ANALYTICS.md)。

[打开演示站](https://demo.peach.video/) · [访问官网](https://peach.video/)

## 关联项目

| 仓库 | 用途 |
| --- | --- |
| [peach](https://github.com/peach-mitao/peach) | 主仓库：自托管应用、安装包与使用文档 |
| [peach-site](https://github.com/peach-mitao/peach-site) | 官网：产品介绍、功能导览与下载入口 |
| [peach-demo](https://github.com/peach-mitao/peach-demo) | 本仓库：演示回放、交互与部署配置 |

使用 Peach 请前往[主仓库](https://github.com/peach-mitao/peach)；维护演示站请参阅[维护说明](docs/MAINTAINING.md)。录制响应与媒体不随源码分发。

自有代码采用 [AGPL-3.0-only](LICENSE)。素材及第三方内容的许可范围见 [NOTICE](NOTICE.md)。
