import { withBackend } from './backend-defaults.ts';
// 演示专用连接配置，只使用公开占位地址。根目录与媒体库身份按应用的多媒体库契约给出稳定演示值。
const source = (location: string, root: string, library: string, cost: string, library_id: string) => ({ location, root, path: root, root_id: `demo-root-${location}`,
    library_id, library, library_icon: location, library_color: '', library_policy: 'auto', library_stages: '', cost, transport: 'filesystem', online: true });
export const sources = [
    source('local', 'R:\\Media', '演示馆藏', 'free', 'demo-movies'),
    source('115', 'A:\\115', '115 收藏', 'metered', 'demo-115'),
    source('pikpak', 'B:\\PikPak', 'PikPak 收藏', 'metered', 'demo-pikpak'),
];
export const providers = [
    { key: '115', source: '115', label: '115 收藏 · 115', configured: true, target: '/115/Peach', root: 'A:\\115', can_cancel: true },
    { key: 'pikpak', source: 'pikpak', label: 'PikPak 收藏 · PikPak', configured: true, target: '/Peach', root: 'B:\\PikPak', can_cancel: true },
    { key: 'clouddrive:pikpak:demo', source: 'pikpak', label: 'PikPak · CloudDrive2', configured: true, target: '/PikPak/Peach', root: 'B:\\PikPak', can_cancel: true },
];
export const downloads = () => ({ available: true, media_sources: ['local', '115', 'pikpak'],
    config: { clouddrive_address: 'http://localhost:19798', targets: { '115': '/115/Peach', pikpak: '/Peach' }, pikpak_root: 'B:\\PikPak', wait_hours: 24 },
    token_set: true, pikpak: { logged_in: true, username: 'demo@example.com', remember: false, method: 'browser' },
    pikpak_browser: { available: true, state: 'idle', message: '' }, pikpak_roots: ['B:\\PikPak'], providers: structuredClone(providers), max_wait_hours: 168 });
export const downloadCheck = () => ({ ok: true, address: 'http://localhost:19798',
    permissions: [{ name: 'allow_add_offline_download', label: '提交离线任务', granted: true }, { name: 'allow_list_offline_downloads', label: '查看离线任务', granted: true }],
    missing: [], root: '/115', folder: { path: '/115/Peach', can_offline: true, cloud: '115' },
    quota: { total: 100, used: 12, left: 88 }, suggested_target: { path: '/115/Peach', exists: true }, suggested_pikpak_root: 'B:\\PikPak', problems: [] });
const proxy = (mode: string) => ({ mode, host: '', port: 0, username: '', password_set: false });
export const cloudProxies = () => ({ accounts: sources.slice(1).map((source, index) => ({
        id: `demo-cloud-${index + 1}`, name: source.library, cloud: source.location, path: index ? '/PikPak' : '/115', revision: 'demo-1', writable: true,
        api: proxy('system'), data: proxy('direct'), libraries: [{ name: source.library, root: source.root, location: source.location, account: `demo-cloud-${index + 1}` }],
    })), unlinked: [] });
// 同步时由 record_entry_pages.py 从应用检出读取的后端常量：存储分类与任务名称。
export interface AppConstants {
    storage_categories: { key: string; label: string; description: string; note: string; cleanable: boolean }[];
    task_labels: Record<string, string>;
}
const MIB = 1024 ** 2;
// 「存储空间」一节：分类与说明取自应用，占用为固定示例值；统计、清理与迁移在演示站不可执行。
export function storage(constants: AppConstants) {
    const sizes: Record<string, number> = { database: 186, backups: 372, playback: 2150, thumbnails: 455, previews: 3290, downloads: 828, sources: 12, records: 41, tools: 610, accounts: 1, logs: 24, other: 3 };
    const categories = constants.storage_categories.map(row => {
        const bytes = (sizes[row.key] ?? 8) * MIB;
        return { ...row, bytes, files: Math.round(bytes / (256 * 1024)), reclaimable: row.cleanable ? bytes : 0 };
    });
    const total = categories.reduce((sum, row) => sum + row.bytes, 0);
    return { data_root: 'C:\\Users\\peach\\peach-data', free_bytes: 412 * 1024 * MIB, total_bytes: 931 * 1024 * MIB, system_drive: true,
        usage: { measured_at: 1790812800, total_bytes: total, total_files: categories.reduce((sum, row) => sum + row.files, 0), categories },
        job: { state: 'idle', message: '' }, relocation: { available: false, message: '演示站不会迁移数据目录。', steps: [], last: null } };
}
// 任务中心按应用的 TaskRunPayload 契约回放已完成任务，任务名取自应用。
export function taskRuns(recorded: { finished?: { id: number; status?: string; message?: string; finished_at?: string; started_at?: string; done?: number; total?: number }[]; [key: string]: unknown }, constants?: AppConstants) {
    const finished = (recorded.finished || []).map(row => ({ id: row.id, task_key: 'library-processing', task_label: constants?.task_labels['library-processing'] || '扫描与采集',
        trigger: 'manual', status: row.status || 'succeeded', mutex_key: 'library-processing', pid: 4242, host: 'demo', started_at: row.started_at || null,
        finished_at: row.finished_at || null, heartbeat_at: row.finished_at || null, elapsed_seconds: 30,
        progress_current: row.done ?? null, progress_total: row.total ?? null, progress_label: '', result_summary: {}, error: '',
        parent_run_id: null, root_run_id: null, followup_key: '', followup_depth: 0 }));
    // 一轮跑完的媒体修复，结果摘要与应用写入 task_run 的字段一致。
    const started = Date.parse('2026-10-30T02:00:00.000Z') / 1000, id = Math.max(0, ...finished.map(row => row.id)) + 1;
    finished.push({ id, task_key: 'media-repair', task_label: constants?.task_labels['media-repair'] || '媒体修复', trigger: 'manual', status: 'succeeded',
        mutex_key: 'media-repair', pid: 4242, host: 'demo', started_at: new Date(started * 1000).toISOString(), finished_at: new Date((started + 42) * 1000).toISOString(),
        heartbeat_at: new Date((started + 42) * 1000).toISOString(), elapsed_seconds: 42, progress_current: 12, progress_total: 12, progress_label: '完成',
        result_summary: { status: 'complete', run_id: id, started_at: started, library: 'demo-movies', stage: '完成', total: 0, checked: 0, found: 0, repaired: 0,
            failed: 0, missing_tool: 0, skipped: 0, survey_checked: 12, survey_cache_version: 2, completed_at: started + 42 },
        error: '', parent_run_id: null, root_run_id: null, followup_key: '', followup_depth: 0 });
    return withBackend('/api/tasks', { ...recorded, available: true, running: [], skipped: [], finished }, ['followup_counts', 'result_versions', 'working_parents']);
}
export function configuration(recorded: {updates:Record<string,unknown>;facts:{term:string;value?:string}[];tunnel:Record<string,unknown>;push_discovery:Record<string,unknown>;[key:string]:unknown}, version: string, constants?: AppConstants) {
    const data: Record<string,any> = structuredClone(recorded);
    Object.assign(data, { editable: true, notice: '', port_editable: true, ledger_read_only: false, revision: 'demo-configuration',
        media_sources: structuredClone(sources), media_dirs: sources.map(row => row.path), library_count: sources.length, downloads: downloads(),
        remote_reporting: { usage: false, errors: false, available: true, fields: { usage: '版本与系统信息', errors: '故障类型与代码位置' }, notice: '' },
        library_sharing: { enabled: false, available: true, schema: 1, fields: ['作品', '标签', '评分', '观看汇总', '偏好维度'], notice: '每周上传作品、标签、评分、观看汇总及偏好维度明细。' },
    });
    data.updates = { ...data.updates, current_version: version, latest_version: version, state: 'current', message: '已是最新版本', release_url: 'https://github.com/peach-mitao/peach/releases' };
    data.facts = data.facts.map((row: { term: string; }) => row.term === '版本' ? { ...row, value: version } : row);
    data.access = { mode: 'password', revision: 'demo-access', password_set: true };
    data.automatic_updates = { mode: 'notify', interval_hours: 24, available: true, download_available: true };
    data.tunnel = { ...data.tunnel, available: true, named_available: true, mode: 'named', hostname: 'peach.example.com', token_set: true, state: 'stopped' };
    data.push_discovery = { ...data.push_discovery, enabled: true, available: true, watch_local: true, cloud: true, local_running: true,
        local_roots: ['R:\\Media'], media_roots: sources.map(row => row.root),
        prefixes: [{ prefix: '/115/Peach', root: 'A:\\115' }, { prefix: '/PikPak/Peach', root: 'B:\\PikPak' }] };
    if (constants)
        data.storage = storage(constants);
    // 操作系统卸载保持不可执行；演示不能创建真实系统操作。其余字段以应用的实际配置打底。
    return withBackend('/api/configuration', data);
}
// 更新提示的基础快照取自应用；运行版本、发布状态与脚本版本由页面按当前配置覆盖。
export const clientUpdates = (version: string) => withBackend('/api/client-updates', { runtime: { version, build_id: 'demo' } });
