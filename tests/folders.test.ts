import test from 'node:test';
import assert from 'node:assert/strict';
import { folderIndex, folderItems, folderPage } from '../src/folders.ts';
const items = [
    { id: 1, location: 'local', is_jav: true, studio: '示例厂牌', medium: 'video' },
    { id: 2, location: 'local', is_jav: false, creator: '示例创作者', medium: 'video' },
    { id: 3, location: '115', is_jav: true, studio: '示例厂牌', medium: 'video' },
];
const index = folderIndex(items), params = (value?: string|URLSearchParams|string[][]|Record<string,string>|undefined) => new URLSearchParams(value);
test('模拟目录可展开、搜索并按来源隔离，同名目录独立', () => {
    const page = folderPage(index, params('loc=local'));
    assert.equal(page!.roots.length, 1);
    assert.equal(page!.roots[0].files, 2);
    const root = page!.roots[0], branch = folderPage(index, params({ folder: root.id }));
    assert.equal(branch!.children.length, 2);
    assert.ok(branch!.children.every(node => node.has_children));
    const match = folderPage(index, params({ q: '示例厂牌' }));
    assert.equal(match!.matches.length, 2);
    assert.notEqual(match!.matches[0].id, match!.matches[1].id);
    assert.equal(folderPage(index, params({ folder: root.id, loc: '115' })), null);
    assert.equal(folderPage(index, params({ folder: 'missing' })), null);
    const leaf = folderPage(index, params({ folder: match!.matches[0].id }));
    assert.equal(leaf!.ancestors.length, 3);
    assert.equal(leaf!.children.length, 0);
});
test('目录范围与包含子文件夹开关使用同一套作品归属', () => {
    const root = folderPage(index, params('loc=local'))!.roots[0];
    assert.deepEqual(folderItems(index, items, params({ folder: root.id })).map((row) => row.id), [1, 2]);
    assert.equal(folderItems(index, items, params({ folder: root.id, folder_recursive: '0' })).length, 0);
    const leaf = index.memberships.get(1)!.at(-1)!;
    assert.deepEqual(folderItems(index, items, params({ folder: leaf, folder_recursive: '0' })).map((row) => row.id), [1]);
    assert.equal(folderItems(index, items, params({ folder: 'missing' })).length, 0);
    assert.deepEqual([...folderIndex([...items].reverse()).nodes.keys()].sort(), [...index.nodes.keys()].sort());
});
