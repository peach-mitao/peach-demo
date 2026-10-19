// 录制器与 Worker 共用的夹具键：方法 + 路径 + 去掉易变参数后按名排序的查询串。
// 两边必须算出同一个键，所以只放在这一处。

// 每次打开页面都会变、却不改变响应内容的参数：首页随机排序的种子、多库切换时前端自动补的库名、
// 详情页每次新开的播放会话号（播放计划把它原样带回片段地址，Worker 的 /stream 不看它）。
export const VOLATILE = new Set(['seed', '_', 'library', 'followDiscoverySeed', 'session']);

export function fixtureKey(method: string, url: URL): string {
  const params = [...url.searchParams].filter(([name]) => !VOLATILE.has(name));
  params.sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
  const query = new URLSearchParams(params).toString();
  return `${method.toUpperCase()} ${url.pathname}${query ? `?${query}` : ''}`;
}

export async function fixtureHash(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 夹具文件扩展名与响应类型的对照；静态资源按扩展名给 Content-Type。
export const EXT = {
  'application/json': 'json', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
  'text/vtt': 'vtt', 'text/plain': 'txt', 'application/vnd.apple.mpegurl': 'm3u8',
};
