#!/bin/bash

# DM Channel Migration Script for Production
# This script applies the DM channel migration to the production database

set -e  # Exit on any error

echo "🚀 Starting DM Channel Migration for Production..."

# Check if we're in the right directory
if [ ! -f "docker-compose.yaml" ]; then
    echo "❌ Error: docker-compose.yaml not found. Please run this script from the project root."
    exit 1
fi

# Check if migration file exists
if [ ! -f "migrations/dm_channel_migration.sql" ]; then
    echo "❌ Error: Migration file not found at migrations/dm_channel_migration.sql"
    exit 1
fi

echo "📋 Migration file found: migrations/dm_channel_migration.sql"

# Backup database before migration (optional but recommended)
echo "💾 Creating database backup..."
docker compose exec db pg_dump -U postgres lazychill > "backup_before_dm_migration_$(date +%Y%m%d_%H%M%S).sql"
echo "✅ Backup created successfully"

# Apply migration
echo "🔄 Applying DM channel migration..."
docker compose exec -T db psql -U postgres -d lazychill < migrations/dm_channel_migration.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 Verifying migration..."
    
    # Verify the changes
    echo "Checking channels table structure..."
    docker compose exec db psql -U postgres -d lazychill -c "\d channels"
    
    echo ""
    echo "Checking dm_participants table..."
    docker compose exec db psql -U postgres -d lazychill -c "\d dm_participants"
    
    echo ""
    echo "🎉 DM Channel Migration completed successfully!"
    echo "   - guild_id column now allows NULL values"
    echo "   - name column now allows NULL values"
    echo "   - dm_participants table created"
    echo "   - Appropriate indexes added"
else
    echo "❌ Migration failed!"
    echo "Please check the error messages above and fix any issues."
    exit 1
fi
