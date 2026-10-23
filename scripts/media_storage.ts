// 仅处理构建清单中的演示视频；不删除桶内对象，不读取凭据文件。
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {VIDEO_CACHE,videoURL} from '../src/video.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const bucket = 'peach-public-media';
type ObjectFile = {key: string; size: number; file: string; hash: string};

export async function mediaFiles(site = path.join(root, 'site')): Promise<ObjectFile[]> {
  const index = JSON.parse(await readFile(path.join(site, '_media/index.json'), 'utf8'));
  if (index.version !== 1 || !index.videos || typeof index.videos !== 'object' || Array.isArray(index.videos)) throw Error('视频清单无效，请运行 assets:build');
  const files = new Map<string, ObjectFile>();
  const rows = Object.entries(index.videos);
  if (!rows.length || rows.length > 10000) throw Error('视频清单数量无效');
  for (const [id, value] of rows) {
    const video = value as {key: string; size: number};
    if (!/^\d+$/.test(id) || !video || !/^demo\/videos\/[a-f0-9]{64}\.mp4$/.test(video.key) || !Number.isSafeInteger(video.size) || video.size <= 0 || video.size > 25 * 1024 * 1024) throw Error('视频清单条目无效');
    const file = path.join(site, '_media', `${id}.mp4`);
    const body = await readFile(file);
    const hash = createHash('sha256').update(body).digest('hex');
    if (body.length !== video.size || video.key !== `demo/videos/${hash}.mp4`) throw Error(`视频素材与清单不一致：${id}`);
    files.set(video.key, {...video, file, hash});
  }
  return [...files.values()];
}

function run(cli:string,args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root,cli), ...args], {cwd: root, windowsHide: true});
    const chunks: Buffer[] = [], errors: Buffer[] = [];
    let size = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 26 * 1024 * 1024) child.kill();
      else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', code => code === 0 && size <= 26 * 1024 * 1024 ? resolve(Buffer.concat(chunks)) : reject(Error(`cf 失败（${code}）：${Buffer.concat(errors).toString('utf8')}`)));
  });
}

const cf=(args:string[])=>run('node_modules/cf/bin/cf',args);
export async function main(args = process.argv.slice(2)): Promise<void> {
  const [operation = 'plan', scope, ...extra] = args;
  if (!['plan', 'upload', 'verify'].includes(operation) || extra.length || (operation === 'plan' ? scope !== undefined : !['--local', '--remote'].includes(scope ?? ''))) throw Error('用法：media_storage.ts plan | upload --local/--remote | verify --local/--remote');
  const files = await mediaFiles();
  console.log(`演示视频：${files.length} 个内容对象，${files.reduce((n, file) => n + file.size, 0)} 字节；桶 ${bucket}。`);
  if (operation === 'plan') return;
  // cf dev 使用 Wrangler 构建器的项目本地状态目录。
  const local = scope === '--local' ? ['--local', '--persist-to', path.join(root, '.wrangler/state')] : [];
  let completed = 0;
  for (const file of files) {
    if (operation === 'upload') {
      // cf 对象上传入口未提供 HTTP 缓存元数据选项，复用已固定的 Wrangler R2 CLI。
      await run('node_modules/wrangler/bin/wrangler.js',['r2','object','put',bucket+'/'+file.key,'--file',file.file,'--content-type','video/mp4','--cache-control',VIDEO_CACHE,'--force',...(scope==='--local'?local:['--remote'])]);
    }
    const body = await cf(['r2', 'objects', 'get', file.key, '--bucket-name', bucket, ...local]);
    if (body.length !== file.size || createHash('sha256').update(body).digest('hex') !== file.hash) throw Error(`R2 内容校验失败：${file.key}`);
    if(scope==='--remote'){
      const response=await fetch(videoURL(file.key)!,{method:'HEAD'});
      if(!response.ok||response.headers.get('cache-control')!==VIDEO_CACHE||Number(response.headers.get('content-length'))!==file.size)throw Error(`媒体域名元数据校验失败：${file.key}`);
    }
    completed++;
    if (completed % 10 === 0 || completed === files.length) console.log(`已校验 ${completed}/${files.length}。`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
