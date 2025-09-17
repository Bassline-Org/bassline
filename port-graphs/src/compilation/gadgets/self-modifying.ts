/**
 * Self-Modifying Compilation Gadget
 *
 * A gadget that can modify its own compilation network based on
 * compilation results, creating reflexive compilation systems
 */

import { CompilationGadget, CompilationGadgetState } from '../base';
import { CompilationEffect, CompilationAST } from '../types';
import { changed, noop } from '../../effects';

export interface SelfModificationRule {
  id: string;
  condition: (ast: CompilationAST, metrics: any) => boolean;
  modification: {
    type: 'add_gadget' | 'remove_gadget' | 'modify_network' | 'change_targets' | 'optimize_path';
    payload: any;
  };
  description: string;
}

export interface SelfModifyingState extends CompilationGadgetState {
  rules: Map<string, SelfModificationRule>;
  modifications: Array<{
    timestamp: number;
    rule: string;
    modification: any;
    result: 'applied' | 'failed' | 'skipped';
  }>;
  enabledFeatures: Set<string>;
  learningData: {
    compilationPatterns: Map<string, number>;
    optimizationEffectiveness: Map<string, number>;
    errorPatterns: Map<string, Array<{ pattern: string; frequency: number }>>;
  };
}

/**
 * Create self-modifying compilation gadget
 */
export function createSelfModifyingGadget(options: {
  initialRules?: SelfModificationRule[];
  enableLearning?: boolean;
  maxModifications?: number;
} = {}) {
  const {
    initialRules = [],
    enableLearning = true,
    maxModifications = 100
  } = options;

  const initialState: SelfModifyingState = {
    astVersion: 0,
    lastModified: 0,
    cacheSize: 0,
    metrics: {
      totalNodes: 0,
      parsedNodes: 0,
      validNodes: 0,
      optimizedNodes: 0,
      generatedArtifacts: 0,
      materializedFiles: 0,
      compilationTime: 0,
      errors: 0,
      warnings: 0
    },
    rules: new Map(initialRules.map(rule => [rule.id, rule])),
    modifications: [],
    enabledFeatures: new Set(['adaptive_optimization', 'error_learning', 'pattern_recognition']),
    learningData: {
      compilationPatterns: new Map(),
      optimizationEffectiveness: new Map(),
      errorPatterns: new Map()
    }
  };

  // Add default self-modification rules
  const defaultRules: SelfModificationRule[] = [
    {
      id: 'add_performance_optimizer',
      condition: (ast, metrics) =>
        metrics.compilationTime > 5000 && !ast.parseState.has('performance_optimizer'),
      modification: {
        type: 'add_gadget',
        payload: {
          gadget: 'performance_optimizer',
          config: { target: 'compilation_time', threshold: 5000 }
        }
      },
      description: 'Add performance optimizer when compilation is slow'
    },

    {
      id: 'enable_aggressive_optimization',
      condition: (ast, metrics) =>
        metrics.errors === 0 && metrics.warnings < 3 && metrics.totalNodes > 10,
      modification: {
        type: 'optimize_path',
        payload: { level: 'aggressive', preserve_semantics: true }
      },
      description: 'Enable aggressive optimization for error-free large choreographies'
    },

    {
      id: 'add_error_recovery',
      condition: (ast, metrics) =>
        metrics.errors > 5,
      modification: {
        type: 'add_gadget',
        payload: {
          gadget: 'error_recovery',
          config: { strategy: 'partial_compilation', fallback: true }
        }
      },
      description: 'Add error recovery for high-error choreographies'
    },

    {
      id: 'multi_target_optimization',
      condition: (ast, metrics) => {
        // Check if multiple targets but no cross-target optimizer
        const hasMultipleTargets = ast.roles &&
          Array.from(ast.roles.values()).some(role =>
            role.deployment && Array.isArray(role.deployment.targets) &&
            role.deployment.targets.length > 1
          );
        return hasMultipleTargets && !ast.parseState.has('cross_target_optimizer');
      },
      modification: {
        type: 'add_gadget',
        payload: {
          gadget: 'cross_target_optimizer',
          config: { strategy: 'shared_artifacts', minimize_duplication: true }
        }
      },
      description: 'Add cross-target optimizer for multi-target choreographies'
    }
  ];

  // Add default rules to initial state
  defaultRules.forEach(rule => {
    initialState.rules.set(rule.id, rule);
  });

  return new SelfModifyingGadget(initialState, {
    enableLearning,
    maxModifications
  });
}

export class SelfModifyingGadget extends CompilationGadget {
  private enableLearning: boolean;
  private maxModifications: number;

  constructor(
    initialState: SelfModifyingState,
    options: { enableLearning: boolean; maxModifications: number }
  ) {
    super(initialState);
    this.enableLearning = options.enableLearning;
    this.maxModifications = options.maxModifications;
  }

  protected consider(state: SelfModifyingState, effect: CompilationEffect): { action: string; context: any } | null {
    // React to compilation completion
    if ('compilationComplete' in effect) {
      return { action: 'evaluate_modifications', context: effect };
    }

    // React to AST updates
    if ('astUpdate' in effect) {
      return { action: 'learn_patterns', context: effect };
    }

    // React to optimization results
    if ('optimization' in effect) {
      return { action: 'track_optimization_effectiveness', context: effect };
    }

    // React to errors
    if ('error' in effect) {
      return { action: 'learn_error_patterns', context: effect };
    }

    // React to network configuration changes
    if ('networkConfiguration' in effect) {
      return { action: 'adapt_to_configuration', context: effect };
    }

    // React to performance metrics
    if ('performance' in effect) {
      return { action: 'analyze_performance', context: effect };
    }

    return null;
  }

  protected createActions(): Record<string, (gadget: any, state: SelfModifyingState, context: any) => SelfModifyingState> {
    return {
      evaluate_modifications: (gadget, state, context) => {
        const { ast, metrics } = context.compilationComplete;

        // Check all rules and apply modifications
        const applicableRules = Array.from(state.rules.values()).filter(rule =>
          rule.condition(ast, metrics)
        );

        if (applicableRules.length === 0) {
          return state;
        }

        const modifications = applicableRules.map(rule => {
          try {
            // Apply the modification
            const modification = this.applyModification(rule.modification, ast, metrics);

            gadget.emit(changed({
              networkModification: {
                rule: rule.id,
                modification: rule.modification,
                description: rule.description,
                timestamp: Date.now()
              }
            }));

            return {
              timestamp: Date.now(),
              rule: rule.id,
              modification: rule.modification,
              result: 'applied' as const
            };

          } catch (error) {
            return {
              timestamp: Date.now(),
              rule: rule.id,
              modification: rule.modification,
              result: 'failed' as const
            };
          }
        });

        const newModifications = [...state.modifications, ...modifications];

        // Keep only recent modifications
        if (newModifications.length > this.maxModifications) {
          newModifications.splice(0, newModifications.length - this.maxModifications);
        }

        return {
          ...state,
          modifications: newModifications,
          lastModified: Date.now()
        };
      },

      learn_patterns: (gadget, state, context) => {
        if (!this.enableLearning) return state;

        const { astUpdate } = context;
        const pattern = this.extractCompilationPattern(astUpdate);

        if (pattern) {
          const currentCount = state.learningData.compilationPatterns.get(pattern) || 0;
          state.learningData.compilationPatterns.set(pattern, currentCount + 1);

          // Generate new rules based on learned patterns
          if (currentCount > 10) { // Threshold for pattern recognition
            const newRule = this.generateRuleFromPattern(pattern, currentCount);
            if (newRule && !state.rules.has(newRule.id)) {
              state.rules.set(newRule.id, newRule);

              gadget.emit(changed({
                ruleGeneration: {
                  rule: newRule,
                  basedOnPattern: pattern,
                  frequency: currentCount
                }
              }));
            }
          }
        }

        return state;
      },

      track_optimization_effectiveness: (gadget, state, context) => {
        if (!this.enableLearning) return state;

        const { optimization } = context;
        const { technique, timeSaved, errorReduction } = optimization;

        const effectiveness = (timeSaved || 0) + (errorReduction || 0);
        const currentEffectiveness = state.learningData.optimizationEffectiveness.get(technique) || 0;

        // Exponentially weighted average
        const newEffectiveness = 0.7 * currentEffectiveness + 0.3 * effectiveness;
        state.learningData.optimizationEffectiveness.set(technique, newEffectiveness);

        return state;
      },

      learn_error_patterns: (gadget, state, context) => {
        if (!this.enableLearning) return state;

        const { error } = context;
        const errorType = this.categorizeError(error);
        const errorPattern = this.extractErrorPattern(error);

        if (errorType && errorPattern) {
          let patterns = state.learningData.errorPatterns.get(errorType) || [];
          const existing = patterns.find(p => p.pattern === errorPattern);

          if (existing) {
            existing.frequency++;
          } else {
            patterns.push({ pattern: errorPattern, frequency: 1 });
          }

          state.learningData.errorPatterns.set(errorType, patterns);

          // Generate error prevention rules
          if (existing && existing.frequency > 5) {
            const preventionRule = this.generateErrorPreventionRule(errorType, errorPattern);
            if (preventionRule && !state.rules.has(preventionRule.id)) {
              state.rules.set(preventionRule.id, preventionRule);

              gadget.emit(changed({
                errorPreventionRule: {
                  rule: preventionRule,
                  errorType,
                  pattern: errorPattern,
                  frequency: existing.frequency
                }
              }));
            }
          }
        }

        return state;
      },

      adapt_to_configuration: (gadget, state, context) => {
        const { networkConfiguration } = context;

        // Adapt rules based on network configuration
        const adaptedRules = this.adaptRulesToConfiguration(
          Array.from(state.rules.values()),
          networkConfiguration
        );

        const newRules = new Map(adaptedRules.map(rule => [rule.id, rule]));

        if (newRules.size !== state.rules.size ||
            !this.rulesEqual(state.rules, newRules)) {

          gadget.emit(changed({
            ruleAdaptation: {
              previousRules: state.rules.size,
              newRules: newRules.size,
              configuration: networkConfiguration
            }
          }));

          return { ...state, rules: newRules };
        }

        return state;
      },

      analyze_performance: (gadget, state, context) => {
        const { performance } = context;

        // Analyze performance metrics and suggest modifications
        const suggestions = this.analyzePerformance(performance, state.learningData);

        suggestions.forEach(suggestion => {
          gadget.emit(changed({
            performanceSuggestion: suggestion
          }));
        });

        return state;
      }
    };
  }

  private applyModification(modification: any, ast: CompilationAST, metrics: any): any {
    switch (modification.type) {
      case 'add_gadget':
        return {
          type: 'gadget_addition',
          gadget: modification.payload.gadget,
          config: modification.payload.config
        };

      case 'modify_network':
        return {
          type: 'network_modification',
          changes: modification.payload
        };

      case 'change_targets':
        return {
          type: 'target_modification',
          targets: modification.payload.targets
        };

      case 'optimize_path':
        return {
          type: 'optimization_path',
          level: modification.payload.level,
          preserve: modification.payload.preserve_semantics
        };

      default:
        throw new Error(`Unknown modification type: ${modification.type}`);
    }
  }

  private extractCompilationPattern(astUpdate: any): string | null {
    // Extract patterns from AST updates
    const roleCount = astUpdate.roles?.size || 0;
    const relationshipCount = astUpdate.relationships?.size || 0;
    const complexity = this.calculateComplexity(astUpdate);

    return `roles:${roleCount},relationships:${relationshipCount},complexity:${complexity}`;
  }

  private calculateComplexity(astUpdate: any): string {
    const roles = astUpdate.roles?.size || 0;
    const relationships = astUpdate.relationships?.size || 0;

    if (roles <= 3 && relationships <= 5) return 'simple';
    if (roles <= 10 && relationships <= 20) return 'medium';
    return 'complex';
  }

  private generateRuleFromPattern(pattern: string, frequency: number): SelfModificationRule | null {
    const [rolesPart, relationshipsPart, complexityPart] = pattern.split(',');
    const roleCount = parseInt(rolesPart.split(':')[1]);
    const relationshipCount = parseInt(relationshipsPart.split(':')[1]);
    const complexity = complexityPart.split(':')[1];

    if (complexity === 'complex' && frequency > 15) {
      return {
        id: `learned_complex_choreography_${Date.now()}`,
        condition: (ast, metrics) =>
          ast.roles.size >= roleCount && ast.relationships.size >= relationshipCount,
        modification: {
          type: 'add_gadget',
          payload: {
            gadget: 'complexity_manager',
            config: {
              strategy: 'hierarchical_decomposition',
              maxRolesPerLayer: Math.ceil(roleCount / 3)
            }
          }
        },
        description: `Add complexity manager for choreographies with ${roleCount}+ roles (learned pattern)`
      };
    }

    return null;
  }

  private categorizeError(error: any): string | null {
    if (error.type === 'validation') return 'validation';
    if (error.type === 'parsing') return 'parsing';
    if (error.type === 'optimization') return 'optimization';
    if (error.type === 'materialization') return 'materialization';
    return 'unknown';
  }

  private extractErrorPattern(error: any): string {
    return `${error.phase || 'unknown'}:${error.code || 'unknown'}`;
  }

  private generateErrorPreventionRule(errorType: string, pattern: string): SelfModificationRule | null {
    const [phase, code] = pattern.split(':');

    if (errorType === 'validation' && phase === 'relationship_validation') {
      return {
        id: `prevent_${errorType}_${phase}_${Date.now()}`,
        condition: (ast, metrics) => true, // Apply early in pipeline
        modification: {
          type: 'add_gadget',
          payload: {
            gadget: 'relationship_validator',
            config: { strict: true, preventCode: code }
          }
        },
        description: `Prevent ${errorType} errors in ${phase} (learned from pattern)`
      };
    }

    return null;
  }

  private adaptRulesToConfiguration(rules: SelfModificationRule[], config: any): SelfModificationRule[] {
    return rules.map(rule => {
      // Adapt rules based on configuration
      if (config.targets?.includes('container') && rule.id.includes('filesystem')) {
        return {
          ...rule,
          condition: (ast, metrics) => rule.condition(ast, metrics) && config.targets?.includes('filesystem')
        };
      }
      return rule;
    });
  }

  private rulesEqual(rules1: Map<string, SelfModificationRule>, rules2: Map<string, SelfModificationRule>): boolean {
    if (rules1.size !== rules2.size) return false;

    for (const [key, rule1] of rules1) {
      const rule2 = rules2.get(key);
      if (!rule2 || rule1.description !== rule2.description) return false;
    }

    return true;
  }

  private analyzePerformance(performance: any, learningData: any): any[] {
    const suggestions = [];

    if (performance.compilationTime > 10000) {
      suggestions.push({
        type: 'performance_improvement',
        suggestion: 'Consider adding parallel compilation gadgets',
        impact: 'high',
        effort: 'medium'
      });
    }

    if (performance.memoryUsage > 100 * 1024 * 1024) { // 100MB
      suggestions.push({
        type: 'memory_optimization',
        suggestion: 'Add memory-efficient caching gadget',
        impact: 'medium',
        effort: 'low'
      });
    }

    return suggestions;
  }
}