/**
 * Rule Engine Core Logic
 * Evaluates rules, detects conflicts, and generates reasoning paths
 */

export interface Condition {
  [key: string]: boolean | string | number;
}

export interface Rule {
  _id?: string;
  id: string;
  name: string;
  condition: Condition;
  consequence: string;
  priority?: number;
  createdAt?: Date;
}

export interface ScenarioInput {
  [key: string]: boolean | string | number;
}

export interface ConflictResolution {
  overriddenRule: string;
  overridingRule: string;
  reason: string;
}

export interface EvaluationResult {
  appliedRules: Rule[];
  overriddenRules: Rule[];
  conflicts: ConflictResolution[];
  outcomes: string[];
  reasoningPath: string[];
}

/**
 * Check if a rule's condition matches the given scenario
 */
export function matchesCondition(condition: Condition, scenario: ScenarioInput): boolean {
  const conditionKeys = Object.keys(condition);
  
  // All condition keys must match scenario values
  return conditionKeys.every(key => {
    if (!(key in scenario)) {
      return false;
    }
    return condition[key] === scenario[key];
  });
}

/**
 * Check if rule A is more specific than rule B (has more conditions)
 */
export function isMoreSpecific(ruleA: Rule, ruleB: Rule): boolean {
  const keysA = Object.keys(ruleA.condition);
  const keysB = Object.keys(ruleB.condition);
  
  // Rule A is more specific if it has more conditions
  if (keysA.length > keysB.length) {
    // Check if all conditions of B are contained in A
    return keysB.every(key => key in ruleA.condition && ruleA.condition[key] === ruleB.condition[key]);
  }
  
  return false;
}

/**
 * Detect if two rules conflict (same conditions lead to different consequences)
 */
export function detectConflict(ruleA: Rule, ruleB: Rule, scenario: ScenarioInput): boolean {
  // Both rules must match the scenario
  if (!matchesCondition(ruleA.condition, scenario) || !matchesCondition(ruleB.condition, scenario)) {
    return false;
  }
  
  // Rules conflict if they have different consequences
  return ruleA.consequence !== ruleB.consequence;
}

/**
 * Resolve conflicts between rules based on specificity
 * More specific rules (more conditions) override less specific ones
 */
export function resolveConflicts(rules: Rule[], scenario: ScenarioInput): {
  applied: Rule[];
  overridden: Rule[];
  conflicts: ConflictResolution[];
} {
  const matchingRules = rules.filter(rule => matchesCondition(rule.condition, scenario));
  
  if (matchingRules.length <= 1) {
    return {
      applied: matchingRules,
      overridden: [],
      conflicts: []
    };
  }
  
  const applied: Rule[] = [];
  const overridden: Rule[] = [];
  const conflicts: ConflictResolution[] = [];
  
  // Sort by specificity (more conditions = higher priority)
  const sortedRules = [...matchingRules].sort((a, b) => {
    const aKeys = Object.keys(a.condition).length;
    const bKeys = Object.keys(b.condition).length;
    return bKeys - aKeys; // Descending order
  });
  
  // Group rules by consequence to detect conflicts
  const consequenceGroups: { [key: string]: Rule[] } = {};
  
  sortedRules.forEach(rule => {
    if (!consequenceGroups[rule.consequence]) {
      consequenceGroups[rule.consequence] = [];
    }
    consequenceGroups[rule.consequence].push(rule);
  });
  
  // Apply most specific rule from each consequence group
  const processedConsequences = new Set<string>();
  
  sortedRules.forEach(rule => {
    if (processedConsequences.has(rule.consequence)) {
      return; // Already processed this consequence
    }
    
    // Check if this rule overrides any less specific rules
    sortedRules.forEach(otherRule => {
      if (rule.id === otherRule.id) return;
      
      if (isMoreSpecific(rule, otherRule) && detectConflict(rule, otherRule, scenario)) {
        if (!overridden.find(r => r.id === otherRule.id)) {
          overridden.push(otherRule);
          conflicts.push({
            overriddenRule: otherRule.name,
            overridingRule: rule.name,
            reason: `${rule.name} is more specific (has more conditions)`
          });
        }
      }
    });
    
    applied.push(rule);
    processedConsequences.add(rule.consequence);
  });
  
  return { applied, overridden, conflicts };
}

/**
 * Generate reasoning path explaining the evaluation
 */
export function generateReasoningPath(
  scenario: ScenarioInput,
  applied: Rule[],
  conflicts: ConflictResolution[]
): string[] {
  const path: string[] = [];
  
  // Add scenario description
  const scenarioDesc = Object.entries(scenario)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  path.push(`Scenario: ${scenarioDesc}`);
  
  // Add conflict resolutions
  if (conflicts.length > 0) {
    path.push('\nConflict Resolutions:');
    conflicts.forEach(conflict => {
      path.push(`- ${conflict.overridingRule} overrides ${conflict.overriddenRule}`);
      path.push(`  Reason: ${conflict.reason}`);
    });
  }
  
  // Add applied rules
  if (applied.length > 0) {
    path.push('\nApplied Rules:');
    applied.forEach(rule => {
      const conditions = Object.entries(rule.condition)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' AND ');
      path.push(`- ${rule.name}: IF ${conditions} THEN ${rule.consequence}`);
    });
  }
  
  return path;
}

/**
 * Main evaluation function
 */
export function evaluateScenario(rules: Rule[], scenario: ScenarioInput): EvaluationResult {
  const { applied, overridden, conflicts } = resolveConflicts(rules, scenario);
  
  const outcomes = applied.map(rule => rule.consequence);
  const reasoningPath = generateReasoningPath(scenario, applied, conflicts);
  
  return {
    appliedRules: applied,
    overriddenRules: overridden,
    conflicts,
    outcomes,
    reasoningPath
  };
}
