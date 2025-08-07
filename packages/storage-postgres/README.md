# @bassline/storage-postgres

PostgreSQL storage backend for Bassline propagation networks.

## Overview

This package provides a PostgreSQL-based storage implementation for Bassline networks, offering enterprise-grade features including connection pooling, transaction support, full-text search, and comprehensive analytics.

## Features

### 🚀 Performance
- **Connection Pooling**: Efficient connection management with configurable pool sizes
- **JSONB Storage**: Leverages PostgreSQL's native JSON capabilities for flexible document storage
- **Optimized Indexing**: GIN indexes for fast JSONB queries and full-text search
- **Query Optimization**: Efficient queries for common operations like network traversal

### 🛡️ Reliability
- **Transaction Support**: ACID compliance for data integrity
- **Result-Based Error Handling**: No exceptions thrown, all errors returned as Result types
- **Connection Management**: Automatic reconnection and graceful degradation
- **Schema Migrations**: Automated database schema setup and maintenance

### 🔍 Analytics & Search
- **Network Statistics**: Real-time metrics on groups, contacts, and storage usage
- **Full-Text Search**: Search across group names, descriptions, and attributes
- **Query System**: Flexible filtering by attributes, authors, types, and tags
- **Snapshot Management**: Version control with metadata and efficient storage

### 🎯 Type Safety
- **Branded Types**: Strong typing with NetworkId, GroupId, ContactId, SnapshotId
- **Storage Interface**: Implements standard NetworkStorage interface
- **Error Taxonomy**: Comprehensive error codes for different failure scenarios

## Installation

```bash
pnpm install @bassline/storage-postgres
```

## Quick Start

```typescript
import { PostgresStorage, createPostgresStorage } from '@bassline/storage-postgres'
import { brand } from '@bassline/core'

// Create storage instance
const storage = createPostgresStorage({
  type: 'postgres',
  options: {
    host: 'localhost',
    port: 5432,
    database: 'bassline',
    user: 'your-user',
    password: 'your-password'
  }
})

// Initialize the database schema
const initResult = await storage.initialize()
if (!initResult.ok) {
  console.error('Failed to initialize storage:', initResult.error)
  process.exit(1)
}

// Save a network
const networkId = brand.networkId('my-network')
const saveResult = await storage.saveNetworkState(networkId, {
  groups: new Map(),
  currentGroupId: 'root',
  rootGroupId: 'root'
})

// Load it back
const loadResult = await storage.loadNetworkState(networkId)
if (loadResult.ok && loadResult.value) {
  console.log('Network loaded successfully')
}

// Clean up when done
await storage.close()
```

## Configuration

```typescript
interface PostgresStorageConfig {
  type: 'postgres'
  options?: {
    // Connection settings
    connectionString?: string    // Alternative to individual settings
    host?: string               // Default: 'localhost'
    port?: number              // Default: 5432
    database?: string          // Default: 'bassline'
    user?: string             // Default: process.env.USER
    password?: string         // Default: undefined
    ssl?: boolean | object    // SSL configuration
    
    // Pool settings
    poolSize?: number              // Default: 10
    connectionTimeout?: number     // Default: 30000ms
    idleTimeout?: number          // Default: 300000ms (5 minutes)
    statementTimeout?: number     // Default: 60000ms
  }
}
```

## Database Schema

The storage automatically creates the following tables:

```sql
-- Networks table
CREATE TABLE bassline_networks (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Groups table with full-text search
CREATE TABLE bassline_groups (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  state JSONB NOT NULL,
  search_vector TSVECTOR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id)
);

-- Contacts table
CREATE TABLE bassline_contacts (
  network_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, group_id, contact_id)
);

-- Snapshots table
CREATE TABLE bassline_snapshots (
  network_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  label TEXT,
  state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (network_id, snapshot_id)
);
```

### Indexes

Optimized indexes are created for common query patterns:

- **JSONB GIN indexes** for fast attribute queries
- **Full-text search indexes** on group names and descriptions
- **Composite indexes** for efficient network/group/contact lookups
- **Timestamp indexes** for chronological queries

## API Reference

### Core Operations

```typescript
// Network operations
await storage.saveNetworkState(networkId, state)
await storage.loadNetworkState(networkId)
await storage.deleteNetwork(networkId)
await storage.exists(networkId)
await storage.listNetworks()

// Group operations
await storage.saveGroupState(networkId, groupId, state)
await storage.loadGroupState(networkId, groupId)
await storage.deleteGroup(networkId, groupId)

// Contact operations
await storage.saveContactContent(networkId, groupId, contactId, content)
await storage.loadContactContent(networkId, groupId, contactId)

// Query operations
await storage.queryGroups(networkId, {
  attributes: { 'bassline.type': 'gadget' },
  author: 'john-doe',
  tags: ['math', 'computation'],
  type: 'primitive'
})

// Snapshot operations
await storage.saveSnapshot(networkId, 'Checkpoint 1')
await storage.loadSnapshot(networkId, snapshotId)
await storage.listSnapshots(networkId)
await storage.deleteSnapshot(networkId, snapshotId)
```

### Advanced Features

```typescript
// Get network statistics
const statsResult = await storage.getNetworkStats(networkId)
if (statsResult.ok) {
  const { groupCount, contactCount, totalSize, lastUpdated } = statsResult.value
  console.log(`Network has ${groupCount} groups, ${contactCount} contacts`)
}

// Full-text search
const searchResult = await storage.searchGroups(networkId, 'neural network')
if (searchResult.ok) {
  console.log(`Found ${searchResult.value.length} matching groups`)
}

// Lifecycle management
await storage.initialize()  // Set up database schema
await storage.close()       // Clean up connections
```

## Error Handling

All operations return `Result<T, StorageError>` types:

```typescript
const result = await storage.loadNetworkState(networkId)
if (result.ok) {
  // Success case
  const networkState = result.value
} else {
  // Error case
  const error = result.error
  console.error(`${error.code}: ${error.message}`)
  
  // Handle specific error types
  switch (error.code) {
    case 'NETWORK_NOT_FOUND':
      // Handle missing network
      break
    case 'STORAGE_CONNECTION_ERROR':
      // Handle connection issues
      break
    // ... other error types
  }
}
```

### Error Codes

- `NETWORK_NOT_FOUND` - Requested network doesn't exist
- `GROUP_NOT_FOUND` - Requested group doesn't exist  
- `CONTACT_NOT_FOUND` - Requested contact doesn't exist
- `SNAPSHOT_NOT_FOUND` - Requested snapshot doesn't exist
- `STORAGE_CONNECTION_ERROR` - Database connection issues
- `STORAGE_PERMISSION_ERROR` - Access permission problems
- `STORAGE_SERIALIZATION_ERROR` - Data serialization failures
- `STORAGE_CORRUPTION_ERROR` - Data integrity issues

## Testing

The package includes comprehensive tests covering all functionality:

```bash
# Run tests (requires PostgreSQL)
pnpm test

# The tests will automatically skip if PostgreSQL is not available
```

### Test Database Setup

For running tests, create a test database:

```sql
CREATE DATABASE bassline_test;
```

Set environment variables if needed:
```bash
export POSTGRES_USER=your-user
export POSTGRES_PASSWORD=your-password
```

## Development

### Building

```bash
pnpm build
```

### Type Checking

```bash
pnpm typecheck
```

## Integration Examples

### CLI Integration

```typescript
import { createPostgresStorage } from '@bassline/storage-postgres'

const storage = createPostgresStorage({
  type: 'postgres',
  options: {
    connectionString: process.env.DATABASE_URL
  }
})
```

### Server Integration

```typescript
// In your Bassline server
import { PostgresStorage } from '@bassline/storage-postgres'

const storage = new PostgresStorage({
  type: 'postgres',
  options: {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    poolSize: 20,
    connectionTimeout: 30000
  }
})

await storage.initialize()
```

## Performance Considerations

### Connection Pooling
- Default pool size: 10 connections
- Increase for high-concurrency applications
- Monitor connection usage in production

### Query Optimization
- Group queries benefit from proper attribute indexing
- Use specific filters to reduce result sets
- Consider pagination for large result sets

### Storage Efficiency
- JSONB compression reduces storage overhead
- Regular VACUUM operations maintain performance
- Monitor table sizes and plan for growth

## Security

### Connection Security
- Always use SSL in production environments
- Store credentials in environment variables
- Use connection string format for complex configurations

### Data Protection
- All data is stored in PostgreSQL with standard security features
- No sensitive data is logged
- Prepared statements prevent SQL injection

## Troubleshooting

### Common Issues

**Connection Timeouts**
```typescript
// Increase timeout values
const storage = createPostgresStorage({
  type: 'postgres',
  options: {
    connectionTimeout: 60000,  // 60 seconds
    statementTimeout: 120000   // 2 minutes
  }
})
```

**Pool Exhaustion**
```typescript
// Increase pool size
const storage = createPostgresStorage({
  type: 'postgres',
  options: {
    poolSize: 25
  }
})
```

**Schema Issues**
```typescript
// Re-initialize schema
await storage.initialize()
```

## Related Packages

- `@bassline/storage-memory` - In-memory storage for development/testing
- `@bassline/storage-filesystem` - File-based storage for single-user scenarios
- `@bassline/core` - Core types and interfaces

## License

MIT - See LICENSE file for details