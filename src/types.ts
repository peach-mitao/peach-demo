// 录制资料保留来源字段；回放逻辑只约束实际参与查询的字段。
export interface DirectoryRow {
  k?: string;
  cat?: string;
  identity_categories?: string[];
}

export interface DirectorySnapshot {
  items?: DirectoryRow[];
  categories?: Record<string, number>;
}

export type Directory = Record<string, DirectorySnapshot | undefined>;

export interface DiscoveryRow {
  taste_score?: number | null;
  score?: number | null;
  release_date?: string | null;
  source_score?: number | null;
  duration?: number | null;
  code?: string | null;
}

export interface FollowGroup {
  primary: {id: number};
}

export type ImageMap = Readonly<Record<string, string>>;
export type JSONValue = string | number | boolean | null | JSONValue[] | {[key: string]: JSONValue};

export interface Assets {
  fetch(input: Request | URL | string): Promise<Response> | Response;
}
export interface ReplayEnv { ASSETS: Assets }
export interface FixtureManifest { fixtures: Record<string,string>; alias?: Record<string,string>; paths: string[] }
export interface CatalogItem {
  id: number;
  location?: string; medium?: string; is_jav?: boolean;
  name?: string; catalog_title?: string; code?: string; studio?: string; creator?: string; agency?: string; series?: string;
  performers?: string[]; tags: string[]; filter_tags?: string[];
  ctx_length?: string; ctx_orient?: string; effective_region?: string;
  play_count?: number; watch_later?: boolean; feedback?: string; rating?: number; o_count?: number;
  duration: number; size: number; release_date?: string; first_seen?: string; last_played?: string;
}
export interface Catalog {
  items: CatalogItem[];
  tag_categories?: Record<string,string>;
  entity_filters?: Record<string,Record<string,number[]>>;
}
export interface SuggestAsset {
  id: number; code?: string; title?: string; original?: string; name?: string; plays: number;
  item: Record<string,JSONValue>;
}
export interface Suggestions {
  entities: {kind: string; name: string; terms: string[]; item: {n: number; [key: string]: JSONValue}}[];
  assets: SuggestAsset[];
}
