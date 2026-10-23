import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {demoPages} from './demo_pages.ts';
import {contentReady} from './browser_state.ts';
import {verifyBehavior} from './sync_behavior.ts';

const [source,base]=process.argv.slice(2);if(!source||!base)throw Error('请提供已同步的官网仓库目录和演示站本地预览地址');
await verifyBehavior(true);
const provenance=JSON.parse(await readFile(new URL('../behavior-source.json',import.meta.url),'utf8'));
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
if(commit!==provenance.commit||execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim())throw Error('截图工具须来自已同步且干净的官网提交');
const {captureBehavior,registerPreview}=await import(pathToFileURL(path.resolve(source,'scripts/capture_behavior.ts')).href);
const directory=process.env.PEACH_BEHAVIOR_ARTIFACTS||fileURLToPath(new URL('../evidence/',import.meta.url));
await registerPreview(await captureBehavior(base,await demoPages(),directory,{ready:contentReady}),directory);
