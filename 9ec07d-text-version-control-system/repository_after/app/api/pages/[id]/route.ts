import { NextResponse } from 'next/server';
import { db } from '@/lib/store';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const page = db.getPage(params.id);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const versions = db.getVersions(params.id);
  
  // Construct DAG edges
  const edges: { source: string; target: string }[] = [];
  versions.forEach(v => {
    v.parentIds.forEach(parentId => {
      edges.push({ source: parentId, target: v.id });
    });
  });

  return NextResponse.json({
    page,
    graph: {
      nodes: versions,
      edges
    }
  });
}
