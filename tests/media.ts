export const videoKey = 'demo/videos/' + 'a'.repeat(64) + '.mp4';
export function media(size = 8) {
    type GetOptions={onlyIf?:{etagMatches?:string};range?:{offset?:number;length?:number}};
    const stats = { heads: 0, gets: [] as ({key:string}&GetOptions)[], bytes: 0, cancels: 0, indexes: 0 };
    const metadata = { key: videoKey, size, etag: 'video', httpEtag: '"video"', uploaded: new Date('2026-10-19T00:00:00Z') };
    const env = {
        ASSETS: { async fetch() { stats.indexes++; return Response.json({ version: 1, videos: { '1': { key: videoKey, size } } }); } },
        MEDIA: {
            async head(key: string) { stats.heads++; return key === videoKey ? metadata : null; },
            async get(key: string, options:GetOptions = {}) {
                stats.gets.push({ key, ...options });
                if (key !== videoKey)
                    return null;
                if (options.onlyIf?.etagMatches !== metadata.etag)
                    return metadata;
                const { offset = 0, length = size } = options.range ?? {};
                return { ...metadata, body: new ReadableStream({
                        pull(controller) {
                            stats.bytes += length;
                            controller.enqueue(Uint8Array.from({ length }, (_, i) => (offset + i) % 256));
                            controller.close();
                        },
                        cancel() { stats.cancels++; },
                    }, { highWaterMark: 0 }) };
            },
        },
    };
    return { env:env as unknown as Parameters<typeof import('../src/stream.ts').stream>[1], stats, metadata };
}
