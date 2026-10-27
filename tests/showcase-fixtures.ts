import { providers } from '../src/showcase.ts';
// 隔离测试专用任务，不进入录制包或演示站。
export function downloadTasks(items: any[]) {
    return items.slice(0, 3).map((item: { name: any; code: any; id: any; }, index: number) => ({ id: 30 - index, provider: providers[index].key,
        provider_label: providers[index].label, source_uri: `magnet:?xt=urn:btih:${String(index + 1).repeat(40)}`,
        display_name: item.name, code: item.code || '', state: ['remote_running', 'ingested', 'failed'][index],
        progress: index === 0 ? 0.64 : index === 1 ? 1 : 0, asset_id: index === 1 ? item.id : null,
        cancellable: index === 0, resubmittable: index === 2 }));
}
