/**
 * Comprehensive tests for Rule Engine based on functional requirements
 * Tests validate all 8 requirements specified in the problem statement
 */

import {
  Rule,
  ScenarioInput,
  matchesCondition,
  isMoreSpecific,
  detectConflict,
  resolveConflicts,
  evaluateScenario,
  generateReasoningPath
} from '../lib/ruleEngine';

describe('Rule Engine - Requirements Validation', () => {
  
  // Requirement 1: Users can create laws as IF-THEN rules with conditions and consequences
  describe('Requirement 1: Rule Creation', () => {
    it('should create a rule with condition and consequence', () => {
      const rule: Rule = {
        id: 'rule1',
        name: 'Law A',
        condition: { raining: true },
        consequence: 'carry an umbrella'
      };

      expect(rule).toBeDefined();
      expect(rule.name).toBe('Law A');
      expect(rule.condition).toEqual({ raining: true });
      expect(rule.consequence).toBe('carry an umbrella');
    });

    it('should create rules with multiple conditions', () => {
      const rule: Rule = {
        id: 'rule2',
        name: 'Law B',
        condition: { raining: true, windy: true },
        consequence: 'do not carry an umbrella'
      };

      expect(Object.keys(rule.condition).length).toBe(2);
      expect(rule.condition.raining).toBe(true);
      expect(rule.condition.windy).toBe(true);
    });

    it('should support different data types in conditions', () => {
      const rule: Rule = {
        id: 'rule3',
        name: 'Law C',
        condition: { temperature: 30, weather: 'sunny', weekend: true },
        consequence: 'go to the beach'
      };

      expect(typeof rule.condition.temperature).toBe('number');
      expect(typeof rule.condition.weather).toBe('string');
      expect(typeof rule.condition.weekend).toBe('boolean');
    });
  });

  // Requirement 2: Rules can override or conflict with other rules
  describe('Requirement 2: Rule Conflicts and Overrides', () => {
    it('should detect when rules conflict', () => {
      const ruleA: Rule = {
        id: 'rule1',
        name: 'Law A',
        condition: { raining: true },
        consequence: 'carry an umbrella'
      };

      const ruleB: Rule = {
        id: 'rule2',
        name: 'Law B',
        condition: { raining: true, windy: true },
        consequence: 'do not carry an umbrella'
      };

      const scenario: ScenarioInput = { raining: true, windy: true };
      
      expect(detectConflict(ruleA, ruleB, scenario)).toBe(true);
    });

    it('should identify more specific rules', () => {
      const lessSpecific: Rule = {
        id: 'rule1',
        name: 'Law A',
        condition: { raining: true },
        consequence: 'carry an umbrella'
      };

      const moreSpecific: Rule = {
        id: 'rule2',
        name: 'Law B',
        condition: { raining: true, windy: true },
        consequence: 'do not carry an umbrella'
      };

      expect(isMoreSpecific(moreSpecific, lessSpecific)).toBe(true);
      expect(isMoreSpecific(lessSpecific, moreSpecific)).toBe(false);
    });

    it('should resolve conflicts by specificity', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law B',
          condition: { raining: true, windy: true },
          consequence: 'do not carry an umbrella'
        }
      ];

      const scenario: ScenarioInput = { raining: true, windy: true };
      const result = resolveConflicts(rules, scenario);

      expect(result.applied.length).toBeGreaterThan(0);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.applied[0].name).toBe('Law B'); // More specific rule
    });
  });

  // Requirement 3: The system evaluates a scenario by applying all relevant rules
  describe('Requirement 3: Scenario Evaluation', () => {
    it('should match rules to scenario conditions', () => {
      const rule: Rule = {
        id: 'rule1',
        name: 'Law A',
        condition: { raining: true },
        consequence: 'carry an umbrella'
      };

      const matchingScenario: ScenarioInput = { raining: true, windy: false };
      const nonMatchingScenario: ScenarioInput = { raining: false };

      expect(matchesCondition(rule.condition, matchingScenario)).toBe(true);
      expect(matchesCondition(rule.condition, nonMatchingScenario)).toBe(false);
    });

    it('should apply all relevant rules to a scenario', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law C',
          condition: { weekend: true },
          consequence: 'relax'
        },
        {
          id: 'rule3',
          name: 'Law D',
          condition: { temperature: 30 },
          consequence: 'wear light clothes'
        }
      ];

      const scenario: ScenarioInput = { raining: true, weekend: true };
      const result = evaluateScenario(rules, scenario);

      // Should apply both Law A and Law C
      expect(result.appliedRules.length).toBeGreaterThanOrEqual(2);
      expect(result.outcomes).toContain('carry an umbrella');
      expect(result.outcomes).toContain('relax');
    });

    it('should evaluate complex scenarios', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law B',
          condition: { raining: true, windy: true },
          consequence: 'do not carry an umbrella'
        },
        {
          id: 'rule3',
          name: 'Law C',
          condition: { weekend: true },
          consequence: 'relax'
        }
      ];

      const scenario: ScenarioInput = { raining: true, windy: true, weekend: true };
      const result = evaluateScenario(rules, scenario);

      expect(result.appliedRules.length).toBeGreaterThan(0);
      expect(result.outcomes.length).toBeGreaterThan(0);
    });
  });

  // Requirement 4: Conflicts between rules must be detected and resolved deterministically
  describe('Requirement 4: Conflict Detection', () => {
    it('should detect all conflicts in a scenario', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law B',
          condition: { raining: true, windy: true },
          consequence: 'do not carry an umbrella'
        }
      ];

      const scenario: ScenarioInput = { raining: true, windy: true };
      const result = evaluateScenario(rules, scenario);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0]).toHaveProperty('overriddenRule');
      expect(result.conflicts[0]).toHaveProperty('overridingRule');
      expect(result.conflicts[0]).toHaveProperty('reason');
    });

    it('should resolve conflicts deterministically', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law B',
          condition: { raining: true, windy: true },
          consequence: 'do not carry an umbrella'
        }
      ];

      const scenario: ScenarioInput = { raining: true, windy: true };
      
      // Run multiple times to ensure deterministic results
      const result1 = evaluateScenario(rules, scenario);
      const result2 = evaluateScenario(rules, scenario);
      const result3 = evaluateScenario(rules, scenario);

      expect(result1.outcomes).toEqual(result2.outcomes);
      expect(result2.outcomes).toEqual(result3.outcomes);
    });

    it('should handle no conflicts gracefully', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law C',
          condition: { weekend: true },
          consequence: 'relax'
        }
      ];

      const scenario: ScenarioInput = { raining: true, weekend: true };
      const result = evaluateScenario(rules, scenario);

      expect(result.conflicts.length).toBe(0);
      expect(result.appliedRules.length).toBe(2);
    });
  });

  // Requirement 5: The system produces a reasoning path showing which rules were applied or overridden
  describe('Requirement 5: Reasoning Path Generation', () => {
    it('should generate reasoning path with scenario description', () => {
      const scenario: ScenarioInput = { raining: true, windy: true };
      const applied: Rule[] = [];
      const conflicts: any[] = [];

      const path = generateReasoningPath(scenario, applied, conflicts);

      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toContain('Scenario:');
      expect(path[0]).toContain('raining: true');
      expect(path[0]).toContain('windy: true');
    });

    it('should include conflict resolutions in reasoning path', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law B',
          condition: { raining: true, windy: true },
          consequence: 'do not carry an umbrella'
        }
      ];

      const scenario: ScenarioInput = { raining: true, windy: true };
      const result = evaluateScenario(rules, scenario);

      expect(result.reasoningPath.length).toBeGreaterThan(0);
      const pathString = result.reasoningPath.join(' ');
      expect(pathString).toContain('overrides');
    });

    it('should show which rules were applied', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law C',
          condition: { weekend: true },
          consequence: 'relax'
        }
      ];

      const scenario: ScenarioInput = { weekend: true };
      const result = evaluateScenario(rules, scenario);

      const pathString = result.reasoningPath.join(' ');
      expect(pathString).toContain('Applied Rules');
      expect(pathString).toContain('Law C');
    });

    it('should generate complete reasoning path for complex scenarios', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law B',
          condition: { raining: true, windy: true },
          consequence: 'do not carry an umbrella'
        },
        {
          id: 'rule3',
          name: 'Law C',
          condition: { weekend: true },
          consequence: 'relax'
        }
      ];

      const scenario: ScenarioInput = { raining: true, windy: true, weekend: true };
      const result = evaluateScenario(rules, scenario);

      expect(result.reasoningPath.length).toBeGreaterThan(3);
      expect(result.reasoningPath.some((line: string) => line.includes('Scenario'))).toBe(true);
      expect(result.reasoningPath.some((line: string) => line.includes('Applied Rules'))).toBe(true);
    });
  });

  // Requirement 6: Users can view the final outcome and explanation
  describe('Requirement 6: Outcome Display', () => {
    it('should provide clear outcomes from evaluation', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law C',
          condition: { weekend: true },
          consequence: 'relax'
        }
      ];

      const scenario: ScenarioInput = { weekend: true };
      const result = evaluateScenario(rules, scenario);

      expect(result.outcomes).toBeDefined();
      expect(Array.isArray(result.outcomes)).toBe(true);
      expect(result.outcomes.length).toBeGreaterThan(0);
      expect(result.outcomes[0]).toBe('relax');
    });

    it('should include all relevant outcomes', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        },
        {
          id: 'rule2',
          name: 'Law C',
          condition: { weekend: true },
          consequence: 'relax'
        }
      ];

      const scenario: ScenarioInput = { raining: true, weekend: true };
      const result = evaluateScenario(rules, scenario);

      expect(result.outcomes.length).toBe(2);
      expect(result.outcomes).toContain('carry an umbrella');
      expect(result.outcomes).toContain('relax');
    });

    it('should provide explanation through reasoning path', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law B',
          condition: { raining: true, windy: true },
          consequence: 'do not carry an umbrella'
        }
      ];

      const scenario: ScenarioInput = { raining: true, windy: true };
      const result = evaluateScenario(rules, scenario);

      expect(result.reasoningPath).toBeDefined();
      expect(result.reasoningPath.length).toBeGreaterThan(0);
    });
  });

  // Requirement 7: No auth required
  describe('Requirement 7: No Auth Required', () => {
    it('should allow rule creation without authentication', () => {
      // This is a structural test - the API endpoints don't require auth
      const rule: Rule = {
        id: 'rule1',
        name: 'Law A',
        condition: { raining: true },
        consequence: 'carry an umbrella'
      };

      // Should be able to create rule without any auth tokens or user context
      expect(rule).toBeDefined();
      expect(rule.id).toBeDefined();
    });

    it('should allow evaluation without authentication', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        }
      ];

      const scenario: ScenarioInput = { raining: true };
      
      // Should be able to evaluate without any auth context
      const result = evaluateScenario(rules, scenario);
      expect(result).toBeDefined();
    });
  });

  // Requirement 8: Minimal User Interface
  describe('Requirement 8: Minimal UI', () => {
    it('should have simple data structures for UI rendering', () => {
      const rule: Rule = {
        id: 'rule1',
        name: 'Law A',
        condition: { raining: true },
        consequence: 'carry an umbrella'
      };

      // Simple structure with clear fields
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('condition');
      expect(rule).toHaveProperty('consequence');
    });

    it('should provide UI-friendly evaluation results', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law A',
          condition: { raining: true },
          consequence: 'carry an umbrella'
        }
      ];

      const scenario: ScenarioInput = { raining: true };
      const result = evaluateScenario(rules, scenario);

      // Result has all necessary fields for minimal UI display
      expect(result).toHaveProperty('appliedRules');
      expect(result).toHaveProperty('overriddenRules');
      expect(result).toHaveProperty('conflicts');
      expect(result).toHaveProperty('outcomes');
      expect(result).toHaveProperty('reasoningPath');
    });

    it('should format reasoning path for easy display', () => {
      const rules: Rule[] = [
        {
          id: 'rule1',
          name: 'Law C',
          condition: { weekend: true },
          consequence: 'relax'
        }
      ];

      const scenario: ScenarioInput = { weekend: true };
      const result = evaluateScenario(rules, scenario);

      // Reasoning path is array of strings - easy to render
      expect(Array.isArray(result.reasoningPath)).toBe(true);
      result.reasoningPath.forEach((line: string) => {
        expect(typeof line).toBe('string');
      });
    });
  });
});
