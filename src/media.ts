import {sha1} from '@noble/hashes/legacy.js';
import {fixtureKey} from './key.ts';
import type {ImageMap, JSONValue} from './types.ts';

export const IMAGE_PATHS = new Set(['/thumb','/poster','/cover','/timeline','/avatar','/entity-image','/logo',
  '/link-mark','/site-mark','/source-icon','/work-icon','/follow-avatar','/follow-cover','/photo','/photo-thumb',
  '/sample-thumb','/sample-image','/endcard-frame','/avatar-choice']);
export const IMAGE_EXTENSIONS = new Set(['jpg','png','webp','avif','gif','svg','ico']);
const hash = (key: string) => [...sha1(new TextEncoder().encode(key)).slice(0,10)].map(b=>b.toString(16).padStart(2,'0')).join('');

// SHA-1 只复用既有录制键；公开文件名由构建器按内容计算 SHA-256。
export function mediaURL(value: string, images: ImageMap, origin = 'https://demo.peach.video'): string {
  if(typeof value!=='string'||!value.startsWith('/'))return value;
  const url=new URL(value,origin);
  if(url.origin!==new URL(origin).origin||!IMAGE_PATHS.has(url.pathname))return value;
  // 应用的图片版本帮助函数会追加 &v=；保留查询串，确保后续参数属于查询而非文件名。
  const search=url.search||'?';
  const keys=[fixtureKey('GET',url)];
  if(url.searchParams.has('v')){
    url.searchParams.delete('v');keys.push(fixtureKey('GET',url));
  }
  if(url.search)keys.push(`GET ${url.pathname}`);
  for(const key of keys){const target=images[hash(key)];if(target)return target+search}
  return value;
}

export function mediaJSON(value: JSONValue, images: ImageMap, origin?: string): JSONValue {
  if(typeof value==='string')return value.includes('<img')?mediaHTML(value,images,origin):mediaURL(value,images,origin);
  if(Array.isArray(value))return value.map(item=>mediaJSON(item,images,origin));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,mediaJSON(item,images,origin)]));
  return value;
}

// 应用的部分卡片模板以 HTML 字符串生成图片，地址必须在交给 DOM 之前转换。
export function mediaHTML(html: string, images: ImageMap, origin?: string): string {
  return html.replace(/<(?:img|source|video)\b[^>]*>/gi,tag=>tag.replace(/\b(src|poster)=(['"])(\/[^'"]*)\2/gi,
    (_attribute: string,name: string,quote: string,value: string)=>`${name}=${quote}${mediaURL(value.replaceAll('&amp;','&'),images,origin).replaceAll('&','&amp;')}${quote}`));
}
