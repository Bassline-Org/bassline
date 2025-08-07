#!/bin/bash

# Reset the PostgreSQL database for testing

echo "⚠️  This will DROP and recreate the bassline database. Continue? (y/N)"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Database connection details
DB_NAME="${DB_NAME:-bassline}"
DB_USER="${DB_USER:-$USER}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "🗑️  Dropping database $DB_NAME..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "✨ Creating database $DB_NAME..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "🚀 Running migrations..."
DATABASE_URL="postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME" pnpm tsx src/run-migrations.ts

echo "✅ Database reset complete!"