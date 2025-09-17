/**
 * Container Compilation Target
 *
 * Compiles choreographies to Docker containers and Kubernetes manifests
 * for containerized deployment
 */

import { CompilationGadget, CompilationEffects } from '../base';
import {
  CompilationEffect,
  CompilationGadgetState,
  CodeArtifact,
  MaterializationRequest,
  RoleNode,
  RelationshipNode
} from '../types';
import { changed, noop } from '../../effects';
import * as path from 'path';

interface ContainerConfig {
  outputPath: string;
  baseImage?: string;
  registry?: string;
  namespace?: string;
  generateK8s?: boolean;
}

export class ContainerCompiler extends CompilationGadget {
  private config: ContainerConfig;

  constructor(config: ContainerConfig) {
    super({
      target: {
        id: 'container',
        name: 'Container Target',
        description: 'Compiles choreographies to Docker containers and K8s manifests',
        capabilities: ['docker_generation', 'k8s_manifest_generation'],
        configuration: {
          outputPath: config.outputPath,
          fileExtensions: {
            dockerfile: '.Dockerfile',
            compose: '.docker-compose.yml',
            k8s: '.yaml'
          }
        }
      }
    });

    this.config = {
      baseImage: 'node:18-alpine',
      registry: 'localhost:5000',
      namespace: 'choreography',
      generateK8s: true,
      ...config
    };
  }

  protected consider(
    state: CompilationGadgetState,
    effect: CompilationEffect
  ): { action: string; context: any } | null {
    if ('optimization' in effect) {
      return { action: 'generate_container', context: effect.optimization };
    }

    if ('validationResult' in effect && effect.validationResult.valid) {
      return { action: 'generate_container', context: { nodeId: effect.validationResult.nodeId } };
    }

    return null;
  }

  protected createActions() {
    return {
      'generate_container': (gadget: any, context: { nodeId: string }) => {
        const state = gadget.current() as CompilationGadgetState;
        const { nodeId } = context;

        try {
          const node = state.ast.roles.get(nodeId) || state.ast.relationships.get(nodeId);
          if (!node) {
            return noop();
          }

          const artifacts = this.generateContainerArtifacts(node, state);

          // Emit code generation effect
          gadget.emit(CompilationEffects.codeGeneration('container', artifacts));

          // Generate materialization requests
          const materializationRequests = this.createMaterializationRequests(artifacts);
          if (materializationRequests.length > 0) {
            gadget.emit(CompilationEffects.materialization(materializationRequests));
          }

          // Update metrics
          const newMetrics = { ...state.metrics };
          newMetrics.generatedArtifacts += artifacts.length;

          gadget.update({
            ...state,
            metrics: newMetrics
          });

          return changed({
            generated: true,
            nodeId,
            artifacts: artifacts.length,
            containers: artifacts.filter(a => a.type === 'dockerfile').length,
            manifests: artifacts.filter(a => a.type === 'k8s_manifest').length
          });

        } catch (error) {
          gadget.emit(CompilationEffects.compilationError(nodeId, {
            code: 'CONTAINER_CODEGEN_ERROR',
            message: error instanceof Error ? error.message : 'Unknown container generation error',
            severity: 'error'
          }));

          return changed({ generated: false, nodeId, error: error.message });
        }
      }
    };
  }

  private generateContainerArtifacts(node: any, state: CompilationGadgetState): CodeArtifact[] {
    const artifacts: CodeArtifact[] = [];

    if (node.type === 'role') {
      artifacts.push(...this.generateRoleContainerArtifacts(node as RoleNode, state));
    }

    // Generate overall orchestration files if this is the last role
    if (this.isLastRole(node, state)) {
      artifacts.push(...this.generateOrchestrationArtifacts(state));
    }

    return artifacts;
  }

  private generateRoleContainerArtifacts(role: RoleNode, state: CompilationGadgetState): CodeArtifact[] {
    const artifacts: CodeArtifact[] = [];
    const rolePath = path.join(this.config.outputPath, 'containers', role.name);

    // Generate Dockerfile
    artifacts.push({
      id: `${role.id}_dockerfile`,
      type: 'dockerfile',
      path: path.join(rolePath, 'Dockerfile'),
      content: this.generateDockerfile(role, state),
      executable: false,
      dependencies: [],
      metadata: { role: role.name, type: 'dockerfile' }
    });

    // Generate Node.js gadget implementation
    artifacts.push({
      id: `${role.id}_gadget_js`,
      type: 'source_code',
      path: path.join(rolePath, 'gadget.js'),
      content: this.generateNodeGadget(role, state),
      executable: false,
      dependencies: [],
      metadata: { role: role.name, type: 'node_gadget' }
    });

    // Generate package.json
    artifacts.push({
      id: `${role.id}_package_json`,
      type: 'config_file',
      path: path.join(rolePath, 'package.json'),
      content: this.generatePackageJson(role, state),
      executable: false,
      dependencies: [],
      metadata: { role: role.name, type: 'package_config' }
    });

    // Generate Kubernetes deployment if enabled
    if (this.config.generateK8s) {
      artifacts.push({
        id: `${role.id}_k8s_deployment`,
        type: 'k8s_manifest',
        path: path.join(this.config.outputPath, 'k8s', `${role.name}-deployment.yaml`),
        content: this.generateK8sDeployment(role, state),
        executable: false,
        dependencies: [],
        metadata: { role: role.name, type: 'k8s_deployment' }
      });

      artifacts.push({
        id: `${role.id}_k8s_service`,
        type: 'k8s_manifest',
        path: path.join(this.config.outputPath, 'k8s', `${role.name}-service.yaml`),
        content: this.generateK8sService(role, state),
        executable: false,
        dependencies: [],
        metadata: { role: role.name, type: 'k8s_service' }
      });
    }

    return artifacts;
  }

  private generateOrchestrationArtifacts(state: CompilationGadgetState): CodeArtifact[] {
    const artifacts: CodeArtifact[] = [];

    // Generate docker-compose.yml
    artifacts.push({
      id: 'docker_compose',
      type: 'config_file',
      path: path.join(this.config.outputPath, 'docker-compose.yml'),
      content: this.generateDockerCompose(state),
      executable: false,
      dependencies: [],
      metadata: { type: 'docker_compose' }
    });

    // Generate Kubernetes namespace and configmap
    if (this.config.generateK8s) {
      artifacts.push({
        id: 'k8s_namespace',
        type: 'k8s_manifest',
        path: path.join(this.config.outputPath, 'k8s', 'namespace.yaml'),
        content: this.generateK8sNamespace(),
        executable: false,
        dependencies: [],
        metadata: { type: 'k8s_namespace' }
      });

      artifacts.push({
        id: 'k8s_configmap',
        type: 'k8s_manifest',
        path: path.join(this.config.outputPath, 'k8s', 'choreography-config.yaml'),
        content: this.generateK8sConfigMap(state),
        executable: false,
        dependencies: [],
        metadata: { type: 'k8s_configmap' }
      });
    }

    return artifacts;
  }

  private generateDockerfile(role: RoleNode, state: CompilationGadgetState): string {
    return `# Generated Dockerfile for role: ${role.name}
FROM ${this.config.baseImage}

# Install dependencies
WORKDIR /app
COPY package.json ./
RUN npm install --production

# Copy application code
COPY gadget.js ./
COPY config/ ./config/

# Create gadget user
RUN addgroup -g 1001 -S gadget && \\
    adduser -u 1001 -S gadget -G gadget
USER gadget

# Set environment variables
ENV NODE_ENV=production
ENV ROLE_NAME=${role.name}
ENV ROLE_TYPE=${role.roleType}

# Expose port for communication
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the gadget
CMD ["node", "gadget.js"]
`;
  }

  private generateNodeGadget(role: RoleNode, state: CompilationGadgetState): string {
    const incomingRelationships = Array.from(state.ast.relationships.values())
      .filter(rel => rel.to === role.name);
    const outgoingRelationships = Array.from(state.ast.relationships.values())
      .filter(rel => rel.from === role.name);

    return `// Generated Node.js gadget for role: ${role.name}
const express = require('express');
const http = require('http');

class ${role.name.charAt(0).toUpperCase() + role.name.slice(1)}Gadget {
  constructor() {
    this.state = {
      role: '${role.name}',
      type: '${role.roleType}',
      capabilities: ${JSON.stringify(role.capabilities)},
      status: 'running',
      data: {},
      timestamp: new Date().toISOString()
    };

    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
    this.setupHealthCheck();
  }

  setupRoutes() {
    // Receive endpoint
    this.app.post('/receive', (req, res) => {
      try {
        const message = req.body;
        console.log(\`[\${new Date().toISOString()}] Received:\`, message);

        const result = this.consider(message);
        if (result) {
          this.act(result);
        }

        res.json({ received: true, timestamp: new Date().toISOString() });
      } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Current state endpoint
    this.app.get('/current', (req, res) => {
      res.json(this.state);
    });

    // Update state endpoint
    this.app.put('/update', (req, res) => {
      try {
        this.state = { ...this.state, ...req.body, timestamp: new Date().toISOString() };
        res.json({ updated: true, state: this.state });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupHealthCheck() {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        role: '${role.name}',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
  }

  consider(message) {
    // Handle different message types based on capabilities
${role.capabilities.map(cap => `    if (message.type === '${cap}') {
      return { action: '${cap}', context: message };
    }`).join('\n')}

    console.log('Unknown message type:', message.type);
    return null;
  }

  act(result) {
    const { action, context } = result;

    console.log(\`[\${new Date().toISOString()}] Acting on:\`, action);

    // Update state based on action
    this.state.data[\`last_\${action}\`] = {
      timestamp: new Date().toISOString(),
      context
    };

    // Emit effects to connected roles
    this.emit({
      type: \`\${action}_completed\`,
      role: '${role.name}',
      timestamp: new Date().toISOString(),
      data: context
    });
  }

  emit(effect) {
    console.log(\`[\${new Date().toISOString()}] Emitting:\`, effect);

    // Route effects to connected roles
${outgoingRelationships.map(rel => `    if (effect.type.includes('${rel.protocol}')) {
      this.sendToRole('${rel.to}', effect);
    }`).join('\n')}
  }

  async sendToRole(roleName, effect) {
    try {
      const url = \`http://\${roleName}:3000/receive\`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(effect)
      });

      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}\`);
      }

      console.log(\`Sent effect to \${roleName}\`);
    } catch (error) {
      console.error(\`Failed to send to \${roleName}:\`, error.message);
    }
  }

  start(port = 3000) {
    this.server = this.app.listen(port, '0.0.0.0', () => {
      console.log(\`[\${new Date().toISOString()}] ${role.name} gadget listening on port \${port}\`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      this.server.close(() => {
        process.exit(0);
      });
    });
  }
}

// Start the gadget
const gadget = new ${role.name.charAt(0).toUpperCase() + role.name.slice(1)}Gadget();
gadget.start();
`;
  }

  private generatePackageJson(role: RoleNode, state: CompilationGadgetState): string {
    return JSON.stringify({
      name: `choreography-${role.name}`,
      version: '1.0.0',
      description: `Generated gadget for role: ${role.name}`,
      main: 'gadget.js',
      scripts: {
        start: 'node gadget.js',
        health: 'curl -f http://localhost:3000/health || exit 1'
      },
      dependencies: {
        express: '^4.18.0'
      },
      keywords: ['choreography', 'gadget', role.name],
      author: 'Choreographic Compiler',
      license: 'ISC'
    }, null, 2);
  }

  private generateDockerCompose(state: CompilationGadgetState): string {
    const roles = Array.from(state.ast.roles.values());

    const services = roles.map(role => {
      return `  ${role.name}:
    build: ./containers/${role.name}
    image: ${this.config.registry}/choreography-${role.name}:latest
    container_name: choreography-${role.name}
    environment:
      - NODE_ENV=production
      - ROLE_NAME=${role.name}
      - ROLE_TYPE=${role.roleType}
    ports:
      - "0:3000"
    networks:
      - choreography-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "npm", "run", "health"]
      interval: 30s
      timeout: 10s
      retries: 3`;
    }).join('\n\n');

    return `# Generated docker-compose.yml for choreography
version: '3.8'

services:
${services}

networks:
  choreography-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  choreography-data:
    driver: local
`;
  }

  private generateK8sDeployment(role: RoleNode, state: CompilationGadgetState): string {
    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${role.name}
  namespace: ${this.config.namespace}
  labels:
    app: ${role.name}
    role: ${role.roleType}
    choreography: payment-processor
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${role.name}
  template:
    metadata:
      labels:
        app: ${role.name}
        role: ${role.roleType}
    spec:
      containers:
      - name: ${role.name}
        image: ${this.config.registry}/choreography-${role.name}:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: ROLE_NAME
          value: "${role.name}"
        - name: ROLE_TYPE
          value: "${role.roleType}"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
`;
  }

  private generateK8sService(role: RoleNode, state: CompilationGadgetState): string {
    return `apiVersion: v1
kind: Service
metadata:
  name: ${role.name}
  namespace: ${this.config.namespace}
  labels:
    app: ${role.name}
    role: ${role.roleType}
spec:
  selector:
    app: ${role.name}
  ports:
  - name: http
    port: 3000
    targetPort: http
    protocol: TCP
  type: ClusterIP
`;
  }

  private generateK8sNamespace(): string {
    return `apiVersion: v1
kind: Namespace
metadata:
  name: ${this.config.namespace}
  labels:
    name: ${this.config.namespace}
    type: choreography-namespace
`;
  }

  private generateK8sConfigMap(state: CompilationGadgetState): string {
    const roles = Array.from(state.ast.roles.values());
    const relationships = Array.from(state.ast.relationships.values());

    const config = {
      roles: roles.map(role => ({
        name: role.name,
        type: role.roleType,
        capabilities: role.capabilities
      })),
      relationships: relationships.map(rel => ({
        from: rel.from,
        to: rel.to,
        protocol: rel.protocol,
        transport: rel.transport || 'http'
      }))
    };

    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: choreography-config
  namespace: ${this.config.namespace}
data:
  choreography.json: |
${JSON.stringify(config, null, 4).split('\n').map(line => '    ' + line).join('\n')}
`;
  }

  private isLastRole(node: any, state: CompilationGadgetState): boolean {
    if (node.type !== 'role') return false;

    const totalRoles = state.ast.roles.size;
    const processedRoles = Array.from(state.ast.roles.values())
      .filter(role => role.status === 'optimized' || role.status === 'valid').length;

    return processedRoles === totalRoles;
  }

  private createMaterializationRequests(artifacts: CodeArtifact[]): MaterializationRequest[] {
    const requests: MaterializationRequest[] = [];

    artifacts.forEach(artifact => {
      // Create directory
      const dir = path.dirname(artifact.path);
      requests.push({
        type: 'create_directory',
        path: dir
      });

      // Write file
      requests.push({
        type: 'write_file',
        path: artifact.path,
        content: artifact.content
      });
    });

    return requests;
  }
}

/**
 * Create a container compiler gadget
 */
export function createContainerCompiler(config: ContainerConfig): ContainerCompiler {
  return new ContainerCompiler(config);
}