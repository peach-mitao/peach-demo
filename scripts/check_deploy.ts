import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// 无录制包的 CI 只校验 Worker 构建与配置，不发布空资源目录。
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'public'), { recursive: true });
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/cf/bin/cf'), 'deploy', '--dry-run'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error)
    throw result.error;
process.exitCode = result.status ?? 1;
