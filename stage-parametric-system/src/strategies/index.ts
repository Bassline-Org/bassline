export { evaluateStrategy } from './evaluate';
export { debugStrategy } from './debug';
export { compileStrategy } from './compile';
export { evaluatorStrategy } from './evaluator';
export { wiringStrategy } from './wiring';
export { baseSemanticsStrategy } from './base-semantics';
export { expressionBuilderStrategy } from './expression-builder';
export { maybeLiftStrategy } from './maybe-lift';

// Combined strategies for common use cases
export const debugWiringStrategy = {
  ...debugStrategy,
  ...wiringStrategy
};

export const compileEvaluatorStrategy = {
  ...compileStrategy,
  ...evaluatorStrategy
};

export const expressionBuildingStrategy = {
  ...expressionBuilderStrategy,
  ...evaluatorStrategy
};

export const fullStrategy = {
  ...baseSemanticsStrategy,
  ...debugStrategy,
  ...compileStrategy,
  ...evaluatorStrategy,
  ...wiringStrategy,
  ...expressionBuilderStrategy
};
