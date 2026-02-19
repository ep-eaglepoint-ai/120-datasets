import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Rule } from '@/lib/ruleEngine';

// GET all rules
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('rule-engine');
    const rules = await db.collection<Rule>('rules').find({}).toArray();
    
    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}

// POST create new rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, condition, consequence } = body;
    
    if (!name || !condition || !consequence) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db('rule-engine');
    
    const rule: Rule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      condition,
      consequence,
      createdAt: new Date()
    };
    
    await db.collection('rules').insertOne(rule);
    
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}

// DELETE rule
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db('rule-engine');
    
    await db.collection('rules').deleteOne({ id });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
