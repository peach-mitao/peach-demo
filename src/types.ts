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
