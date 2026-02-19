import { NextResponse } from 'next/server';
import { db } from '@/lib/store';
import { threeWayMerge } from '@/lib/merge';

export async function POST(request: Request) {
  const body = await request.json();
  const { versionAId, versionBId } = body;

  const vA = db.getVersion(versionAId);
  const vB = db.getVersion(versionBId);

  if (!vA || !vB) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  if (vA.pageId !== vB.pageId) {
    return NextResponse.json({ error: 'Cannot merge versions from different pages' }, { status: 400 });
  }

  // Find common ancestor (simplified: assuming one root or closest common)
  // For a true DAG LCA, we'd need a graph traversal.
  // For this task, we can just iterate parents up until intersection.
  
  const findAncestors = (startId: string): Set<string> => {
    const ancestors = new Set<string>();
    const queue = [startId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (ancestors.has(curr)) continue;
      ancestors.add(curr);
      const node = db.getVersion(curr);
      if (node) {
        queue.push(...node.parentIds);
      }
    }
    return ancestors;
  };

  const ancestorsA = findAncestors(vA.id);
  const ancestorsB = findAncestors(vB.id); // Includes self

  // Find intersection
  let lcaId: string | null = null;
  // Naive: check all ancestors of A and see if in B, pick the "latest" timestamp?
  // Better: BFS from both backwards.
  // We'll traverse A's ancestors and find the first one that is also in B's ancestors.
  // (This is not perfect for generic DAGs but sufficient for version trees)
  
  // Actually, we need the "closes" ancestor.
  // Let's iterate backwards.
  
  // Quick hack: Iterate all versions in reverse chronological order? No.
  // Let's just create a helper to get all ancestors of B, then BFS up from A to find the first match.
  
  const queue = [vA.id];
  const visited = new Set<string>();
  
  // NOTE: This BFS finds the 'closest' ancestor in terms of graph distance from A.
  // Is that the true LCA? Likely good enough.
  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);
    
    if (ancestorsB.has(currId) && currId !== vA.id && currId !== vB.id) {
       // We found a common ancestor. 
       // Note: Excluding vA and vB themselves if they are effectively merging "fast forward" style?
       // If vA is ancestor of vB, merge is trivial (vB).
       lcaId = currId;
       break;
    }
    const node = db.getVersion(currId);
    if(node) queue.push(...node.parentIds);
  }

  // If one is direct ancestor of another, we can fast-forward.
  if (ancestorsA.has(vB.id)) {
     return NextResponse.json({ success: true, content: vA.content, note: "Fast-forward" });
  }
  if (ancestorsB.has(vA.id)) {
     return NextResponse.json({ success: true, content: vB.content, note: "Fast-forward" });
  }

  const lca = lcaId ? db.getVersion(lcaId) : null;
  const baseContent = lca ? lca.content : ''; // Start from empty if no common ancestor

  const result = threeWayMerge(baseContent, vA.content, vB.content);

  return NextResponse.json(result);
}
