import { FILMS, PEOPLE, STUDIOS, DEMO_DATA_NOTICE } from '../src/public-movies.ts';
import type { CatalogNames } from '../src/catalog-language.ts';

// 片目中既有短标签也有类型片标签。保留各自的筛选归属和实体 ID。
const genres = {
    中世纪主题电影: 'Medieval film', 伙伴片: 'Buddy film', 传记电影: 'Biographical film', 俠盜片: 'Swashbuckler',
    冒险: 'Adventure', 冒险电影: 'Adventure film', 前卫电影: 'Avant-garde film', 剑与凉鞋: 'Sword and sandal',
    剧情喜剧片: 'Comedy-drama', 剧情片: 'Drama', 动作片: 'Action film', 动画: 'Animation', 動作喜劇: 'Action comedy',
    历史片: 'Historical film', 反乌托邦电影: 'Dystopian film', 史诗片: 'Epic film', 同志片: 'LGBTQ+ film',
    吸血鬼電影: 'Vampire film', 喜剧: 'Comedy', 喜剧电影: 'Comedy film', 嘲讽电影: 'Satire', 多段式电影: 'Anthology film',
    奇幻: 'Fantasy', 奇幻电影: 'Fantasy film', 审判电影: 'Courtroom film', 宣传片: 'Propaganda film', 怪兽电影: 'Monster film',
    恐怖喜剧: 'Horror comedy', 恐怖电影: 'Horror film', 悲喜剧: 'Tragicomedy', 惊悚电影: 'Thriller', 战争片: 'War film',
    无声电影: 'Silent film', 時代劇: 'Period drama', 歌舞片: 'Musical', 浪漫喜劇: 'Romantic comedy',
    浪漫片: 'Romance film', 爱情片: 'Love story', 犯罪片: 'Crime film', 独立电影: 'Independent film', 短片: 'Short film',
    神秘片: 'Mystery film', 神话片: 'Mythological film', 科幻: 'Science fiction', 科幻电影: 'Science fiction film',
    纪录影片: 'Documentary', 艺术电影: 'Art film', 西部片: 'Western', 间谍片: 'Spy film', 开放电影: 'Open films',
};

const studioNames = Object.fromEntries(STUDIOS.filter(studio => /\p{Script=Han}/u.test(studio.name))
    .map(studio => [studio.name, studio.original_name]));
Object.assign(studioNames, {
    二十世纪福克斯: '20th Century Fox',
    华纳兄弟: 'Warner Bros.',
    '名角－拉斯基公司': 'Famous Players-Lasky Corporation',
    '哈尔·罗奇工作室': 'Hal Roach Studios',
    基斯通工作室: 'Keystone Studios',
    '塞缪尔·戈尔德温制片公司': 'Samuel Goldwyn Productions',
    派拉蒙电影公司: 'Paramount Pictures',
    派拉蒙著名制作: 'Paramount Famous Lasky Corporation',
    百代电影公司: 'Pathé',
    罗斯电影工作室: 'Rus Film Studio',
    美国百代: 'Pathé Exchange',
    英国联合影片公司: 'British International Pictures',
    莫斯科电影制片厂: 'Mosfilm',
    国家影视委员会: 'State Committee for Cinematography',
    敖德萨电影制片厂: 'Odesa Film Studio',
    高尔基电影制片厂: 'Gorky Film Studio',
});
for (const studio of new Set(FILMS.map(film => film.studio))) {
    if (studio.includes('、')) studioNames[studio] = studio.split('、').map(part => studioNames[part] || part).join(' / ');
}

const demoCopy = {
    '演员 / 配音': 'Actor / voice actor',
    导演: 'Director',
    官方资料: 'Official source',
    名称: 'Names',
    公开电影片目: 'Public film catalog',
    演示数据: 'Sample data',
    数据说明: 'About the data',
    电影演示馆藏: 'Demo film library',
    演示馆藏: 'Demo library',
    演示馆藏扫描: 'Demo library scan',
    '电影精选（演示）': 'Film highlights',
    '115 收藏': '115 Favorites',
    'PikPak 收藏': 'PikPak Favorites',
    '115 收藏 · 115': '115 Favorites · 115',
    'PikPak 收藏 · PikPak': 'PikPak Favorites · PikPak',
    网盘下载中: 'Downloading in the cloud',
    已入库: 'Added to the library',
    失败: 'Failed',
    整理完成: 'Organized',
    整理未开始: 'Waiting to organize',
    网盘拒绝下载该资源: 'The cloud provider declined this download',
    演示失败状态: 'Sample failure',
    媒体挂载: 'Media mounts',
    来源可读取: 'Sources are readable',
    扫描文件: 'Scanning files',
    演示馆藏扫描快照: 'Sample library scan',
    未署名: 'Uncredited',
    仅提供演示: 'Available in the demo interface',
    [DEMO_DATA_NOTICE]: 'See the footer for film and image credits. Catalog codes, file details, ratings, viewing, follows and tasks are sample data. Initials are shown when a portrait is unavailable.',
};

export const englishCatalog: CatalogNames = {
    ...genres, ...studioNames, ...demoCopy,
    ...Object.fromEntries(PEOPLE.map(person => [person.name, person.original_name])),
    ...Object.fromEntries(FILMS.map(film => [film.title, film.original_title === 'Q1024861' ? 'Cabiria' : film.original_title || film.title])),
};
const entityNames = [...new Set([
    ...FILMS.flatMap(film => [...film.directors, ...film.cast, film.studio, ...film.tags]),
    ...PEOPLE.map(person => person.name), '开放电影',
])].filter(name => Object.hasOwn(englishCatalog, name) && englishCatalog[name] !== name);

export const englishEntityNames: CatalogNames = Object.fromEntries(entityNames.map(name => [name, englishCatalog[name]!]));
export const originalEntityNames: CatalogNames = Object.fromEntries(entityNames.map(name => [englishCatalog[name]!, name]));
if (Object.keys(originalEntityNames).length !== entityNames.length) throw Error('演示片目存在重复的英文实体名称');

for (const field of [...entityNames, ...FILMS.flatMap(film => [film.title, film.studio, ...film.tags])]) {
    if (/\p{Script=Han}/u.test(englishCatalog[field] || field)) throw Error(`演示片目缺少英文写法：${field}`);
}
