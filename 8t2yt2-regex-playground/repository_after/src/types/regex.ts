export interface GroupDef {
  index: number;
  name?: string;
  parentIndex?: number | null;
}

export interface MatchGroup {
  index: number;
  name?: string;
  text: string | null;
  start?: number | null;
  end?: number | null;
  parentIndex?: number | null;
}

export interface MatchResult {
  index: number;
  end: number;
  match: string;
  groups: MatchGroup[];
}

export interface RegexWorkerResult {
  ok: boolean;
  error?: string;
  matches: MatchResult[];
  executionTimeMs: number;
  truncated: boolean;
  groupDefs: GroupDef[];
}
