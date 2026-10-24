// 目录只由演示馆藏生成，路径不读取录制机器的真实目录。
export interface FolderItem {id:number; location?:string;is_jav?:boolean;studio?:string;creator?:string;medium?:string}
export interface FolderNode {id:string; location:string;path:string;name:string;parent:string|null;root:string;videos:number;files:number;has_children:boolean}
export interface FolderIndex {nodes:Map<string,FolderNode>;memberships:Map<number,string[]>}
export function folderIndex(items: readonly FolderItem[]): FolderIndex {
    const nodes = new Map<string,FolderNode>(), memberships = new Map<number,string[]>();
    for (const item of items) {
        const location = item.location || 'local';
        const parts = [location === 'local' ? '本地演示库' : `${location} 演示库`,
            item.is_jav ? '编号影片' : '创作者作品',
            item.is_jav ? item.studio || '其他厂牌' : item.creator || '其他视频'];
        let parent: string|null = null, root: string|null = null;
        const chain = [];
        for (let i = 0; i < parts.length; i++) {
            const path = `R:\\Peach 演示\\${parts.slice(0, i + 1).join('\\')}`;
            const id = `demo:${location}:${encodeURIComponent(path)}`;
            root ??= id;
            if (!nodes.has(id))
                nodes.set(id, { id, location, path, name: parts[i], parent, root,
                    videos: 0, files: 0, has_children: false });
            const node = nodes.get(id)!;
            node.files++;
            node.videos += item.medium !== 'image' ? 1 : 0;
            if (parent)
                nodes.get(parent)!.has_children = true;
            chain.push(id);
            parent = id;
        }
        memberships.set(item.id, chain);
    }
    return { nodes, memberships };
}
export function folderItems<T extends FolderItem>(index: FolderIndex, items: T[], params: URLSearchParams): T[] {
    const selected = params.get('folder');
    if (!selected)
        return items;
    const recursive = params.get('folder_recursive') !== '0';
    return items.filter((item) => {
        const chain = index.memberships.get(item.id) || [];
        return recursive ? chain.includes(selected) : chain.at(-1) === selected;
    });
}
export function folderPage(index: FolderIndex, params: URLSearchParams) {
    const locations = (params.get('loc') || '').split(',').filter(Boolean);
    const allowed = (node: FolderNode) => !locations.length || locations.includes(node.location);
    const selected = index.nodes.get(params.get('folder')||'') || null;
    if (params.get('folder') && (!selected || !allowed(selected)))
        return null;
    const rows = [...index.nodes.values()].filter(allowed).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id));
    const ancestors: FolderNode[] = [];
    for (let node:FolderNode|null|undefined = selected; node; node = index.nodes.get(node.parent||''))
        ancestors.unshift(node);
    const q = (params.get('q') || '').trim().toLocaleLowerCase();
    return { roots: rows.filter(node => !node.parent),
        children: rows.filter(node => node.parent === (selected?.id || null)),
        selected, ancestors, matches: q ? rows.filter(node => node.name.toLocaleLowerCase().includes(q)).slice(0, 100) : [],
        rule: null, rules: [], rules_revision: 0, conflicts: [] };
}
