#!/usr/bin/env tsx
/**
 * Simple migration runner for PostgreSQL
 */

import { Pool } from 'pg'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost/bassline'
  
  console.log(`Running migrations on: ${databaseUrl}`)
  
  const pool = new Pool({
    connectionString: databaseUrl,
  })
  
  try {
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bassline_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    
    // Get applied migrations
    const appliedResult = await pool.query(
      'SELECT version FROM bassline_migrations ORDER BY version'
    )
    const applied = new Set(appliedResult.rows.map(r => r.version))
    
    // Read migration files
    const migrationsDir = join(__dirname, 'migrations')
    const files = await readdir(migrationsDir)
    const migrations = []
    
    for (const file of files.filter(f => f.endsWith('.sql'))) {
      const match = file.match(/^(\d+)_(.+)\.sql$/)
      if (!match) continue
      
      const version = parseInt(match[1], 10)
      const name = match[2]
      
      if (applied.has(version)) {
        console.log(`✓ Migration ${version}: ${name} (already applied)`)
        continue
      }
      
      const sql = await readFile(join(migrationsDir, file), 'utf-8')
      migrations.push({ version, name, sql })
    }
    
    // Sort and apply migrations
    migrations.sort((a, b) => a.version - b.version)
    
    for (const migration of migrations) {
      console.log(`→ Applying migration ${migration.version}: ${migration.name}`)
      
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        
        // Execute migration SQL
        await client.query(migration.sql)
        
        // Record migration
        await client.query(
          'INSERT INTO bassline_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        )
        
        await client.query('COMMIT')
        console.log(`✓ Migration ${migration.version}: ${migration.name} applied`)
      } catch (error) {
        await client.query('ROLLBACK')
        console.error(`✗ Failed to apply migration ${migration.version}:`, error)
        throw error
      } finally {
        client.release()
      }
    }
    
    if (migrations.length === 0) {
      console.log('✓ All migrations are up to date')
    } else {
      console.log(`✓ Applied ${migrations.length} migration(s)`)
    }
  } finally {
    await pool.end()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}

export { runMigrations }