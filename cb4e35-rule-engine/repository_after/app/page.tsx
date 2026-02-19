'use client'

import { useState, useEffect } from 'react'
import { Rule, ScenarioInput, EvaluationResult } from '@/lib/ruleEngine'

export default function Home() {
  const [rules, setRules] = useState<Rule[]>([])
  const [newRule, setNewRule] = useState({
    name: '',
    conditions: '',
    consequence: ''
  })
  const [scenario, setScenario] = useState('')
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(false)

  // Load rules on mount
  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/rules')
      const data = await res.json()
      setRules(data.rules || [])
    } catch (error) {
      console.error('Error fetching rules:', error)
    }
  }

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Parse conditions (format: "key1:value1,key2:value2")
      const conditionPairs = newRule.conditions.split(',').map(p => p.trim())
      const condition: any = {}
      
      conditionPairs.forEach(pair => {
        const [key, value] = pair.split(':').map(s => s.trim())
        // Try to parse as boolean or keep as string
        if (value === 'true') condition[key] = true
        else if (value === 'false') condition[key] = false
        else condition[key] = value
      })

      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRule.name,
          condition,
          consequence: newRule.consequence
        })
      })

      if (res.ok) {
        setNewRule({ name: '', conditions: '', consequence: '' })
        fetchRules()
      }
    } catch (error) {
      console.error('Error creating rule:', error)
    }
  }

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Parse scenario (format: "key1:value1,key2:value2")
      const scenarioPairs = scenario.split(',').map(p => p.trim())
      const scenarioInput: ScenarioInput = {}
      
      scenarioPairs.forEach(pair => {
        const [key, value] = pair.split(':').map(s => s.trim())
        if (value === 'true') scenarioInput[key] = true
        else if (value === 'false') scenarioInput[key] = false
        else scenarioInput[key] = value
      })

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioInput })
      })

      const data = await res.json()
      setEvaluation(data.result)
    } catch (error) {
      console.error('Error evaluating:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRule = async (id: string) => {
    try {
      await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
      fetchRules()
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">Rule Engine - Personal Laws</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Create Rule Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Create New Law</h2>
          <form onSubmit={handleCreateRule} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Law Name</label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Law A"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Conditions (key:value, separated by commas)
              </label>
              <input
                type="text"
                value={newRule.conditions}
                onChange={(e) => setNewRule({ ...newRule, conditions: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="raining:true, windy:true"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Consequence (THEN)</label>
              <input
                type="text"
                value={newRule.consequence}
                onChange={(e) => setNewRule({ ...newRule, consequence: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="carry an umbrella"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Create Law
            </button>
          </form>
        </div>

        {/* Evaluate Scenario Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Evaluate Scenario</h2>
          <form onSubmit={handleEvaluate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Scenario (key:value, separated by commas)
              </label>
              <input
                type="text"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="raining:true, windy:true, weekend:true"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Evaluating...' : 'Evaluate'}
            </button>
          </form>

          {/* Evaluation Result */}
          {evaluation && (
            <div className="mt-6 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Result:</h3>
              
              {evaluation.conflicts.length > 0 && (
                <div className="mb-3">
                  <p className="font-medium text-orange-600">Conflicts Detected:</p>
                  {evaluation.conflicts.map((conflict, i) => (
                    <p key={i} className="text-sm ml-2">
                      • {conflict.overridingRule} overrides {conflict.overriddenRule}
                    </p>
                  ))}
                </div>
              )}
              
              <div className="mb-3">
                <p className="font-medium text-green-600">Outcomes:</p>
                {evaluation.outcomes.map((outcome, i) => (
                  <p key={i} className="text-sm ml-2">• {outcome}</p>
                ))}
              </div>
              
              <div>
                <p className="font-medium">Reasoning Path:</p>
                {evaluation.reasoningPath.map((step, i) => (
                  <p key={i} className="text-sm ml-2 whitespace-pre-wrap">{step}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rules List */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4">Current Laws</h2>
        {rules.length === 0 ? (
          <p className="text-gray-500">No laws defined yet. Create your first law above!</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-gray-600">
                    IF {Object.entries(rule.condition).map(([k, v]) => `${k}: ${v}`).join(' AND ')}
                    {' → THEN '}{rule.consequence}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-red-600 hover:text-red-800 px-3 py-1"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
