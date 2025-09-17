/**
 * Choreographic Compilation System
 *
 * Always-on, non-linear compilation networks for transforming choreography
 * specifications into deployable artifacts through gadget collaboration
 */

// Core types and infrastructure
export * from './types';
export * from './base';

// Compilation gadgets
export { createChoreographyParser } from './gadgets/parser';
export { createSemanticValidator } from './gadgets/validator';
export { createChoreographyOptimizer } from './gadgets/optimizer';
export { createFileMaterializer } from './gadgets/materializer';
export { createSelfModifyingGadget } from './gadgets/self-modifying';

// Target compilers
export { createFilesystemCompiler } from './targets/filesystem';
export { createContainerCompiler } from './targets/container';

// Network orchestration
export { createCompilationNetwork } from './network';
export type { CompilationNetworkConfig, CompilationResult, CompilationStatus } from './network';