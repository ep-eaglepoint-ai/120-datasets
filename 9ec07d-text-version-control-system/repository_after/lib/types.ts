export interface Page {
  id: string;
  title: string;
  createdAt: number;
}

export interface VersionNode {
  id: string;      // Unique UUID
  pageId: string;  // The page this version belongs to
  content: string; // The content of this version
  parentIds: string[]; // IDs of parent versions. Empty for root.
  author: string;
  timestamp: number;
  message: string;
}

export interface DagGraph {
  nodes: VersionNode[];
  edges: { source: string; target: string }[];
}

export interface MergeResult {
  success: boolean;
  content: string;
  conflict?: boolean;
}
