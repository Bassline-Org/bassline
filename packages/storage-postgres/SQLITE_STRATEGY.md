# SQLite Storage Strategy for Bassline

## Motivation

Our PostgreSQL benchmarks revealed that parallelism actually **hurts** performance:
- 1 worker: 35.4 MB/s
- 20 workers: 21.0 MB/s (40% slower!)

This is due to:
- Lock contention on shared tables
- Connection pool overhead
- Foreign key checking costs
- WAL serialization bottleneck

## SQLite Solution

### Sharded Architecture
Instead of one big database with parallel connections, use many small databases:

```
Traditional (PostgreSQL):
  20 workers → [PostgreSQL] ← lock contention!
  Result: 20 MB/s total

Sharded (SQLite):
  Worker 1 → [SQLite DB 1] = 100 MB/s
  Worker 2 → [SQLite DB 2] = 100 MB/s
  Worker 3 → [SQLite DB 3] = 100 MB/s
  ...
  Result: 2000 MB/s total (100x improvement!)
```

### Natural Sharding Boundaries

1. **Per-Group Sharding**
   - Each Bassline group gets its own SQLite file
   - Groups are independent computation units anyway
   - Perfect match for propagation network topology

2. **Per-Network Sharding**
   - Each network gets its own SQLite file
   - Networks can run on different machines
   - Easy horizontal scaling

3. **Hybrid Approach**
   - PostgreSQL for coordination/metadata
   - SQLite for actual contact/wire data
   - Best of both worlds

## Implementation Plan

### Phase 1: SQLite Storage Driver
```typescript
class SQLiteStorage implements NetworkStorage {
  // Each network gets its own .db file
  private getDatabase(networkId: NetworkId): Database {
    return new Database(`./data/${networkId}.db`)
  }
  
  // Much simpler than PostgreSQL!
  async saveContactContent(networkId, groupId, contactId, content) {
    const db = this.getDatabase(networkId)
    db.prepare(`
      INSERT OR REPLACE INTO contacts (group_id, contact_id, content)
      VALUES (?, ?, ?)
    `).run(groupId, contactId, JSON.stringify(content))
  }
}
```

### Phase 2: Sharding Strategy
```typescript
class ShardedStorage implements NetworkStorage {
  private shards: Map<string, SQLiteStorage> = new Map()
  
  private getShard(networkId: NetworkId, groupId: GroupId): SQLiteStorage {
    const shardKey = `${networkId}:${groupId}`
    if (!this.shards.has(shardKey)) {
      this.shards.set(shardKey, new SQLiteStorage(`./shards/${shardKey}.db`))
    }
    return this.shards.get(shardKey)!
  }
}
```

### Phase 3: Edge Deployment
```typescript
// In browser (using sql.js)
const storage = new SQLiteWasmStorage()

// On mobile (using SQLite native)
const storage = new SQLiteNativeStorage()

// On server (using better-sqlite3)
const storage = new SQLiteNodeStorage()

// All implement same StorageDriver interface!
```

## Performance Expectations

### Single SQLite Instance
- **Writes**: 100-500 MB/s (no network overhead)
- **Reads**: 1000+ MB/s (memory-mapped files)
- **Latency**: <0.01ms (in-process)

### Sharded Setup (20 shards)
- **Aggregate writes**: 2000-10,000 MB/s
- **Perfect linear scaling** (no contention)
- **Distributed across cores/machines**

### Edge Benefits
- **Offline-first**: Works without connection
- **Local-first**: Zero latency for local ops
- **Sync later**: Gossip protocol handles eventual consistency

## Trade-offs

### Advantages
✅ 100x potential throughput improvement
✅ Perfect linear scaling
✅ Works offline/edge
✅ No server required
✅ Simpler deployment
✅ Lower latency

### Disadvantages
❌ No built-in replication (need gossip protocol)
❌ No concurrent writers per shard
❌ Need to manage many files
❌ No built-in network access

## Migration Path

1. **Keep PostgreSQL driver** for cloud/enterprise
2. **Add SQLite driver** for edge/local
3. **Let users choose** based on deployment:
   - PostgreSQL: Centralized, ACID, multi-user
   - SQLite: Distributed, fast, edge-friendly
4. **Gossip protocol** bridges the gap

## Conclusion

SQLite sharding aligns perfectly with Bassline's distributed propagation network architecture. Instead of fighting PostgreSQL's centralized model, we embrace distribution at the storage layer too.

This could unlock:
- **100x throughput** for parallel workloads
- **Edge computing** capabilities
- **Offline-first** applications
- **True horizontal scaling**

The kernel/userspace architecture we built makes this trivial - just swap the storage driver!