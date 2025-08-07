# Bassline CLI Architecture - User Installation Approach

## Overview

The Bassline CLI uses a user installation approach where each user has their own TypeScript-based configuration directory (`~/.bassline`). This directory contains all the storage backends, transport layers, custom plugins, and basslines that the user wants to use. The global CLI is just a thin wrapper that loads and executes the user's personalized installation.

## Core Concepts

### BasslineInstallation

The central configuration object that defines a user's complete Bassline environment:

```typescript
// ~/.bassline/index.ts
import { BasslineInstallation } from '@bassline/installation'

export default new BasslineInstallation({
  storage: { /* storage backends */ },
  transports: { /* transport layers */ },
  basslines: { /* pre-installed basslines */ },
  defaults: { /* default configurations */ },
  hooks: { /* lifecycle hooks */ }
})
```

### User Directory Structure

```
~/.bassline/
├── package.json           # User's dependencies
├── tsconfig.json         # TypeScript configuration
├── index.ts              # Main BasslineInstallation configuration
├── bin/
│   └── bassline         # Generated CLI wrapper
├── plugins/              # Custom user plugins
│   ├── storage/         # Custom storage backends
│   ├── transport/       # Custom transport layers
│   └── gadgets/         # Custom primitive gadgets
├── basslines/            # User's bassline library
│   ├── math-toolkit.ts
│   └── ui-components.ts
├── networks/             # Network configurations and state
│   ├── dev/
│   └── production/
├── daemon/               # Daemon runtime state
│   ├── daemon.pid
│   └── daemon.log
└── node_modules/         # Installed dependencies
```

## Installation Flow

### 1. Initial Setup

```bash
# Install minimal global CLI
npm install -g @bassline/cli

# Initialize user directory
bassline init

# Interactive setup wizard:
# ? Installation directory: (~/.bassline)
# ? TypeScript configuration: (recommended)
# ? Include example plugins: (Y/n)
# ? Storage backends: (◯ PostgreSQL ◯ Filesystem ◉ Memory)
```

### 2. Generated Files

The `init` command creates a complete TypeScript project:

```typescript
// ~/.bassline/index.ts
import { BasslineInstallation } from '@bassline/installation'
import type { StorageFactory, TransportFactory } from '@bassline/core'

export default new BasslineInstallation({
  // Storage backends
  storage: {
    memory: async () => {
      const { createMemoryStorage } = await import('@bassline/storage-memory')
      return createMemoryStorage
    }
  },
  
  // Transport layers
  transports: {
    local: async () => {
      const { LocalTransport } = await import('@bassline/core')
      return LocalTransport
    }
  },
  
  // Pre-installed basslines
  basslines: {},
  
  // Default configurations
  defaults: {
    storage: 'memory',
    transport: 'local',
    scheduler: 'immediate'
  }
})
```

```json
// ~/.bassline/package.json
{
  "name": "bassline-user-installation",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch index.ts",
    "build": "tsc",
    "test": "vitest",
    "upgrade": "npm update @bassline/core @bassline/cli"
  },
  "dependencies": {
    "@bassline/core": "^0.1.0",
    "@bassline/installation": "^0.1.0",
    "@bassline/storage-memory": "^0.1.0",
    "tsx": "^4.7.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "typescript": "^5.3.3",
    "vitest": "^1.2.1"
  }
}
```

```json
// ~/.bassline/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3. PATH Configuration

The CLI adds itself to the user's PATH:

```bash
# Added to ~/.bashrc or ~/.zshrc
export PATH="$HOME/.bassline/bin:$PATH"

# Or manually:
echo 'export PATH="$HOME/.bassline/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## Adding Capabilities

### Installing Storage Backends

```bash
cd ~/.bassline
npm install @bassline/storage-postgres pg
```

```typescript
// Update ~/.bassline/index.ts
storage: {
  memory: /* ... */,
  postgres: async (config) => {
    const { createPostgresStorage } = await import('@bassline/storage-postgres')
    return createPostgresStorage(config)
  }
}
```

### Creating Custom Plugins

```typescript
// ~/.bassline/plugins/storage/s3-storage.ts
import { NetworkStorage } from '@bassline/core'
import AWS from 'aws-sdk'

export class S3Storage implements NetworkStorage {
  private s3: AWS.S3
  
  constructor(config: { bucket: string; region: string }) {
    this.s3 = new AWS.S3({ region: config.region })
  }
  
  async saveContactContent(networkId: string, groupId: string, contactId: string, content: any) {
    const key = `${networkId}/${groupId}/${contactId}`
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(content)
    }).promise()
  }
  
  // ... implement other methods
}

export function createS3Storage(config: any): NetworkStorage {
  return new S3Storage(config)
}
```

```typescript
// Register in ~/.bassline/index.ts
import { createS3Storage } from './plugins/storage/s3-storage'

storage: {
  s3: createS3Storage
}
```

### Adding Custom Basslines

```typescript
// ~/.bassline/basslines/math-toolkit.ts
export const mathToolkit = {
  name: 'math-toolkit',
  version: '1.0.0',
  attributes: {
    'bassline.type': 'gadget-library',
    'bassline.author': '@username'
  },
  gadgets: [
    {
      name: 'fibonacci',
      primitive: async ({ n }) => {
        // Implementation
      }
    }
  ]
}
```

```typescript
// Register in ~/.bassline/index.ts
import { mathToolkit } from './basslines/math-toolkit'

basslines: {
  'math-toolkit': mathToolkit,
  'async-utils': () => import('./basslines/async-utils')  // Lazy loading
}
```

## CLI Commands

### Daemon Management

```bash
# Start daemon with user's installation
bassline daemon start

# Stop daemon
bassline daemon stop

# View daemon status
bassline daemon status

# View logs
bassline daemon logs
```

### Network Management

```bash
# Create network with user's configured backends
bassline network create mynet --storage postgres --transport websocket

# List networks
bassline network list

# Start/stop networks
bassline network start mynet
bassline network stop mynet

# Configure network
bassline network config mynet --set storage.connectionString="..."
```

### Installation Management

```bash
# Add new storage backend
bassline install storage postgres

# List installed backends
bassline list storage
bassline list transports
bassline list basslines

# Validate installation
bassline validate

# Upgrade core packages
bassline upgrade
```

## Advanced Features

### Multiple Installations

```bash
# Create specialized installation
BASSLINE_HOME=/opt/bassline-prod bassline init

# Use alternative installation
BASSLINE_HOME=/opt/bassline-prod bassline network create

# Or configure in environment
export BASSLINE_HOME=/opt/bassline-prod
```

### Shareable Installations

```typescript
// Publish your installation as an npm package
// package.json
{
  "name": "@mycompany/bassline-config",
  "version": "1.0.0",
  "main": "index.js",
  "files": ["index.js", "plugins/", "basslines/"],
  "dependencies": {
    "@bassline/core": "^0.1.0",
    "@mycompany/proprietary-storage": "^1.0.0"
  }
}
```

Others can use:
```bash
# Install from npm
bassline init --from @mycompany/bassline-config

# Or from GitHub
bassline init --from github:mycompany/bassline-config

# Or from local directory
bassline init --from ./company-bassline-template
```

### Development Mode

```bash
# Watch for changes to your installation
cd ~/.bassline
npm run dev

# In another terminal, changes are immediately available
bassline network create test --storage custom
```

### Hooks and Middleware

```typescript
// ~/.bassline/index.ts
export default new BasslineInstallation({
  hooks: {
    // Lifecycle hooks
    beforeNetworkStart: async (network) => {
      console.log(`Starting network: ${network.id}`)
      await validatePermissions(network)
    },
    
    afterStorageInit: async (storage, config) => {
      if (config.type === 'postgres') {
        await runMigrations(storage)
      }
    },
    
    // Middleware for all operations
    beforeOperation: async (op) => {
      await auditLog(op)
    }
  }
})
```

## TypeScript Benefits

### Full Type Safety

```typescript
// ~/.bassline/index.ts
import { BasslineInstallation, Config } from '@bassline/installation'
import { PostgresConfig } from '@bassline/storage-postgres'

// Type-safe configuration
export default new BasslineInstallation<{
  storage: {
    postgres: PostgresConfig
    memory: never
  }
}>({
  storage: {
    postgres: createPostgresStorage  // Type-checked
  }
})
```

### IDE Support

- Full IntelliSense in VS Code
- Go-to-definition for plugins
- Refactoring support
- Type checking with `tsc --noEmit`

### Testing

```typescript
// ~/.bassline/test/storage.test.ts
import { describe, it, expect } from 'vitest'
import installation from '../index'

describe('Storage Backends', () => {
  it('should create postgres storage', async () => {
    const storage = await installation.createStorage('postgres', {
      connectionString: 'postgresql://test'
    })
    expect(storage).toBeDefined()
  })
})
```

## Migration Path

### From Global Installation

```bash
# Export existing networks
bassline export-all > networks.json

# Initialize user installation
bassline init

# Import networks
bassline import networks.json
```

### Version Updates

```bash
# Update core packages
cd ~/.bassline
npm update @bassline/core @bassline/installation

# Run migrations if needed
bassline migrate
```

## Benefits

1. **Full Control** - Users own their entire Bassline environment
2. **Type Safety** - Real TypeScript with full IDE support
3. **Modularity** - Install only what you need
4. **Extensibility** - Easy to add custom plugins and basslines
5. **Shareability** - Installations can be versioned, shared, and distributed
6. **Developer Experience** - Just edit TypeScript files, no complex builds
7. **Corporate Friendly** - Companies can maintain standard installations
8. **No Hidden Magic** - Everything is explicit and debuggable

## Comparison with Other Approaches

### vs. Global Plugins
- ✅ No version conflicts between users
- ✅ Full TypeScript support
- ✅ User controls dependencies
- ❌ Requires initial setup

### vs. Dynamic Loading
- ✅ No runtime resolution issues
- ✅ Type-safe configuration
- ✅ Better performance (no dynamic imports)
- ❌ Not zero-config

### vs. Monolithic CLI
- ✅ Lighter initial download
- ✅ Extensible without forking
- ✅ Custom backends possible
- ❌ More complex than single binary

## Security Considerations

- User installations run with user permissions
- No global system modifications required
- Plugins are explicitly installed via npm
- TypeScript compilation provides some validation
- Hooks enable custom security policies

## Future Enhancements

1. **Plugin Registry** - Central registry for discovering plugins
2. **Installation Templates** - More sophisticated project templates
3. **Cloud Sync** - Sync installations across machines
4. **GUI Configuration** - Visual installation manager
5. **Plugin Marketplace** - Share and discover custom plugins