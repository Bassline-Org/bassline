/**
 * Core types for choreographic compilation system
 */

// Compilation AST Node Types
export interface ASTNode {
  id: string;
  version: number;
  status: 'parsing' | 'parsed' | 'validating' | 'valid' | 'invalid' | 'optimizing' | 'optimized';
  dependencies: string[];
  dependents: string[];
  sourceLocation?: SourceLocation;
}

export interface SourceLocation {
  path: string;
  line: number;
  column: number;
  length?: number;
}

export interface RoleNode extends ASTNode {
  type: 'role';
  name: string;
  roleType: string;
  capabilities: string[];
  deployment?: DeploymentSpec;
}

export interface RelationshipNode extends ASTNode {
  type: 'relationship';
  from: string;
  to: string;
  protocol: string;
  transport?: string;
  direction: 'unidirectional' | 'bidirectional';
}

export interface DeploymentSpec {
  target: string;
  config: Record<string, any>;
}

// Compilation State
export interface CompilationAST {
  version: number;
  roles: Map<string, RoleNode>;
  relationships: Map<string, RelationshipNode>;
  parseState: Map<string, ParseStatus>;
  validationState: Map<string, ValidationResult>;
  typeState: Map<string, TypeInfo>;
  optimizationState: Map<string, OptimizationResult>;
  changeLog: ChangeEvent[];
  dependencies: DependencyGraph;
}

export interface ParseStatus {
  status: 'pending' | 'parsing' | 'complete' | 'error';
  errors: ParseError[];
  progress: number;
}

export interface ParseError {
  message: string;
  location: SourceLocation;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  nodeId: string;
  valid: boolean;
  errors: ValidationError[];
  warnings: Warning[];
  dependencies: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  location?: SourceLocation;
  suggestions?: string[];
}

export interface Warning {
  code: string;
  message: string;
  location?: SourceLocation;
}

export interface TypeInfo {
  nodeId: string;
  inferredType: string;
  constraints: TypeConstraint[];
  confidence: number;
}

export interface TypeConstraint {
  type: string;
  value: any;
  source: string;
}

export interface OptimizationResult {
  nodeId: string;
  transforms: OptimizationTransform[];
  metrics: OptimizationMetrics;
}

export interface OptimizationTransform {
  type: string;
  description: string;
  before: any;
  after: any;
  impact: number;
}

export interface OptimizationMetrics {
  compilationTime: number;
  codeSize: number;
  estimatedPerformance: number;
}

export interface DependencyGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>;
}

export interface ChangeEvent {
  type: 'node_added' | 'node_removed' | 'node_updated' | 'dependency_changed';
  nodeId: string;
  timestamp: number;
  details: any;
}

// Compilation Effects
export type CompilationEffect =
  | { astUpdate: { nodeId: string; update: Partial<ASTNode> } }
  | { validationResult: ValidationResult }
  | { typeInference: TypeInfo }
  | { optimization: OptimizationResult }
  | { codeGeneration: { targetId: string; artifacts: CodeArtifact[] } }
  | { materialization: { requests: MaterializationRequest[] } }
  | { dependencyChange: { from: string; to: string; type: 'added' | 'removed' } }
  | { parseProgress: { nodeId: string; progress: number; status: ParseStatus } }
  | { compilationError: { nodeId: string; error: CompilationError } };

export interface CodeArtifact {
  id: string;
  type: 'shell_script' | 'dockerfile' | 'k8s_manifest' | 'config_file' | 'source_code';
  path: string;
  content: string;
  executable?: boolean;
  dependencies: string[];
  metadata: Record<string, any>;
}

export interface MaterializationRequest {
  type: 'write_file' | 'create_directory' | 'set_permissions' | 'create_symlink';
  path: string;
  content?: string;
  permissions?: number;
  target?: string;
}

export interface CompilationError {
  code: string;
  message: string;
  location?: SourceLocation;
  severity: 'error' | 'warning' | 'info';
  suggestions?: string[];
}

// Compilation Target Types
export interface CompilationTarget {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  configuration: TargetConfiguration;
}

export interface TargetConfiguration {
  outputPath: string;
  fileExtensions: Record<string, string>;
  templatePath?: string;
  buildCommands?: string[];
  deployCommands?: string[];
}

// Choreography Specification Types
export interface ChoreographySpec {
  name: string;
  version: string;
  description?: string;
  roles: Record<string, RoleSpec>;
  relationships: RelationshipSpec[];
  metadata?: Record<string, any>;
}

export interface RoleSpec {
  type: string;
  capabilities?: string[];
  deployment?: DeploymentSpec;
  configuration?: Record<string, any>;
}

export interface RelationshipSpec {
  from: string;
  to: string;
  type: string;
  protocol: string;
  transport?: string;
  configuration?: Record<string, any>;
}

// Compilation Metrics
export interface CompilationMetrics {
  totalNodes: number;
  parsedNodes: number;
  validNodes: number;
  optimizedNodes: number;
  generatedArtifacts: number;
  materializedFiles: number;
  compilationTime: number;
  errors: number;
  warnings: number;
}

// Gadget-specific types for compilation
export interface CompilationGadgetState {
  ast: CompilationAST;
  target?: CompilationTarget;
  metrics: CompilationMetrics;
  cache: Map<string, any>;
}

export interface IncrementalUpdate {
  nodeId: string;
  changeType: 'added' | 'modified' | 'removed';
  previousVersion?: number;
  newVersion: number;
  affectedDependents: string[];
}