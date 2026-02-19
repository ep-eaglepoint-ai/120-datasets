import { NextResponse } from 'next/server';
import { db } from '@/lib/store'; // Ensure 'lib' is aliased or use relative path
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const pages = db.getPages();
  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title } = body;

  const newPage = {
    id: uuidv4(),
    title,
    createdAt: Date.now(),
  };

  db.createPage(newPage);
  return NextResponse.json(newPage);
}
