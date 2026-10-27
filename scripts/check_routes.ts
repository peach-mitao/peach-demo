"use strict";
// 路由验收与录制共用入口清单，覆盖配置分区和各类详情。
if (!process.argv.includes('--verify'))
    process.argv.push('--verify');
await import('./record_pages.ts');
