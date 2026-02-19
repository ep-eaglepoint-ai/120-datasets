import { NextResponse } from 'next/server';
import { db } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import { VersionNode } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json();
  const { pageId, content, parentIds, author, message } = body;

  if (!pageId || content === undefined || !parentIds) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Cycle Detection Check:
  // Since we only add new nodes pointing to existing parents (time always moves forward),
  // and we don't allow modifying parents, cycles are impossible by construction 
  // UNLESS a user manually inputs a parentId that eventually points back to the new node (which doesn't exist yet).
  // So simple acyclic property is maintained by "append-only".

  const newVersion: VersionNode = {
    id: uuidv4(),
    pageId,
    content,
    parentIds, // Array of strings
    author: author || 'Anonymous',
    timestamp: Date.now(),
    message: message || 'Update'
  };

  try {
    db.addVersion(newVersion);
    return NextResponse.json(newVersion);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
