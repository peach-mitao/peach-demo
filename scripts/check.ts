import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyCopyEditor } from './sync_copy_editor.ts';
// 按源码目录发现文件，语法检查不维护第二份文件清单或依赖版本。
async function check(directory: URL,sourceOnly=false) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
        if (entry.isDirectory())
            await check(file,sourceOnly);
        else if (/\.(mjs|js)$/.test(entry.name)) {
            if(sourceOnly)throw Error('维护源码必须使用 TypeScript：'+fileURLToPath(file));
            const result = spawnSync(process.execPath, ['--check', fileURLToPath(file)], { stdio: 'inherit' });
            if (result.error)
                throw result.error;
            if (result.status !== 0)
                process.exit(result.status ?? 1);
        }
    }
}
for (const directory of ['src/', 'scripts/', 'tests/', 'browser/'] as const)
    await check(new URL('../' + directory, import.meta.url),true);
await check(new URL('../site/_demo/',import.meta.url));
await import('./check_package.ts');
await verifyCopyEditor();
