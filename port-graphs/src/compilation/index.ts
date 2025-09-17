/**
 * Choreographic Compilation System
 *
 * Gadget-based compilation pipeline for transforming choreography
 * specifications into deployable artifacts
 */

// Core types and infrastructure
export * from './types';
export * from './base';

// Compilation gadgets (functional implementations)
export { createChoreographyParser } from './gadgets/parser';
export { createSemanticValidator } from './gadgets/validator';
export { createFileMaterializer } from './gadgets/materializer';
export { createSelfModifyingGadget } from './gadgets/self-modifying';

// Target compilers
export { createFilesystemCompiler } from './targets/filesystem';
export { createContainerCompiler } from './targets/container';