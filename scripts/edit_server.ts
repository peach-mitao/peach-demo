// 本地预览的改字落盘服务：只监听回环地址，把浏览器草稿合并写入工作目录，供维护者整理回各自的维护源。
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EDIT_PORT = 8792;
export const EDITS_FILE = fileURLToPath(new URL('../evidence/copy-edits.json', import.meta.url));
const ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;

export async function readEdits(file = EDITS_FILE): Promise<Record<string, string>> {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return {};
    throw error;
  }
}

// 只接受「原文 → 新文字」的字符串表；空字符串表示删除这段文字。
export function mergeEdits(current: Record<string, string>, incoming: unknown): Record<string, string> {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw Error('改字草稿必须是对象');
  const next = { ...current };
  for (const [original, text] of Object.entries(incoming)) {
    if (typeof text !== 'string' || !original.trim() || original.length > 2000 || text.length > 2000) throw Error('改字草稿格式无效');
    next[original] = text;
  }
  return next;
}

export async function saveEdits(incoming: unknown, file = EDITS_FILE) {
  const next = mergeEdits(await readEdits(file), incoming);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + '.tmp', JSON.stringify(next, null, 2) + '\n');
  await rename(file + '.tmp', file);
  return next;
}

export function editServer(file = EDITS_FILE) {
  let queue = Promise.resolve();
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const origin = String(request.headers.origin || '');
    if (ORIGIN.test(origin)) response.setHeader('access-control-allow-origin', origin);
    response.setHeader('access-control-allow-methods', 'GET, PUT, OPTIONS');
    response.setHeader('access-control-allow-headers', 'content-type');
    const send = (status: number, data: unknown) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); response.end(JSON.stringify(data)); };
    if (new URL(request.url || '/', 'http://127.0.0.1').pathname !== '/copy-edits') return send(404, { error: '未知地址' });
    if (request.method === 'OPTIONS') return send(204, null);
    if (origin && !ORIGIN.test(origin)) return send(403, { error: '只接受本机预览的改字' });
    if (request.method === 'GET') return send(200, await readEdits(file));
    if (request.method !== 'PUT') return send(405, { error: '不支持的方法' });
    let body = '';
    for await (const chunk of request) if ((body += chunk).length > 1_000_000) return send(413, { error: '改字草稿过大' });
    const task = queue.then(async () => send(200, { saved: Object.keys(await saveEdits(JSON.parse(body), file)).length, file: path.relative(process.cwd(), file) }));
    queue = task.catch(error => send(400, { error: error instanceof Error ? error.message : String(error) }));
    await queue;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  editServer().listen(EDIT_PORT, '127.0.0.1', () => console.log(`改字落盘服务：http://127.0.0.1:${EDIT_PORT}/copy-edits → ${EDITS_FILE}`));
}
