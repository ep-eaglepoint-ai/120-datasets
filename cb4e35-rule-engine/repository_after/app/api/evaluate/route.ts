import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Rule, ScenarioInput, evaluateScenario } from '@/lib/ruleEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenario } = body as { scenario: ScenarioInput };
    
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario required' }, { status: 400 });
    }
    
    // Fetch all rules from database
    const client = await clientPromise;
    const db = client.db('rule-engine');
    const rules = await db.collection<Rule>('rules').find({}).toArray();
    
    // Evaluate scenario
    const result = evaluateScenario(rules, scenario);
    
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json({ error: 'Failed to evaluate scenario' }, { status: 500 });
  }
}
