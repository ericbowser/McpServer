# PostgreSQL MCP Server

MCP server for managing PostgreSQL databases with tools for backups, restores, and database information.

## Features

- **Backup Management**: Create and list database backups
- **Restore Operations**: Restore databases from backup files
- **Database Information**: List databases, tables, and get detailed information
- **Size Monitoring**: Check database and table sizes
- **Connection Info**: View PostgreSQL server information

## Installation

```bash
cd postgres_mcp
npm install
```

## Configuration

Set environment variables or use defaults:

```bash
DB_USER=postgres
DB_HOST=localhost
DB_NAME=postgres
DB_PASSWORD=your_password
DB_PORT=5432
BACKUP_DIR=./backups  # Optional, defaults to ./backups
```

## MCP Server Usage

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["C:\\Projects\\McpServer\\postgres_mcp\\index.js"],
      "env": {
        "DB_USER": "postgres",
        "DB_HOST": "localhost",
        "DB_NAME": "postgres",
        "DB_PASSWORD": "your_password",
        "DB_PORT": "5432"
      }
    }
  }
}
```

## Available MCP Tools

### Backup Operations

- **create_backup**: Create a database backup
  - `database` (optional): Database name (default: DB_NAME)
  - `filename` (optional): Custom filename
  - `format` (optional): `custom` (recommended), `plain`, `tar`, or `inserts` (INSERT statements)
  - `schema` (optional): Schema name to backup (backs up all schemas if not specified)

- **list_backups**: List all available backups
  - `database` (optional): Filter by database name

- **restore_backup**: Restore a database from backup
  - `filename` (required): Backup filename
  - `database` (optional): Target database name
  - `create_database` (optional): Create database if it doesn't exist

### Database Information

- **list_databases**: List all PostgreSQL databases
- **get_database_info**: Get detailed information about a database
- **list_tables**: List tables in a database/schema
- **get_table_info**: Get detailed information about a table
- **get_database_size**: Get database and table sizes
- **get_connection_info**: Get PostgreSQL server connection info

## Standalone Scripts

### Backup Script

```bash
# Backup default database
node backup.js

# Backup specific database
node backup.js mydatabase

# Backup with custom filename
node backup.js mydatabase my_backup

# Backup specific schema
node backup.js mydatabase my_backup public

# Backup with INSERT format (set BACKUP_FORMAT=inserts)
BACKUP_FORMAT=inserts node backup.js mydatabase my_backup public
```

### Restore Script

```bash
# Restore backup to default database
node restore.js backup_file.dump

# Restore to specific database
node restore.js backup_file.dump mydatabase

# Restore and create database if needed
node restore.js backup_file.dump mydatabase --create-db
```

## Backup Formats

- **custom** (recommended): PostgreSQL custom format, compressed, supports selective restore
- **plain**: SQL text format, human-readable, uncompressed
- **tar**: TAR archive format, compressed, supports selective restore
- **inserts**: SQL INSERT statements format, human-readable, portable across PostgreSQL versions

## Schema Filtering

You can backup a specific schema by providing the `schema` parameter:

```bash
# Via MCP tool
Create a backup of the postgres database in the public schema using INSERT format
```

```bash
# Via standalone script
node backup.js postgres my_backup public
```

This is useful for:
- Backing up specific application schemas
- Creating portable INSERT scripts for data migration
- Generating SQL scripts that can be easily edited

## Backup Directory

Backups are stored in the `backups/` directory by default. The directory is created automatically if it doesn't exist.

## Examples

### Create a backup via MCP
```
Create a backup of the postgres database
```

### List all backups
```
List all available backups
```

### Restore a backup
```
Restore the backup file postgres_2024-01-01.dump to the postgres database
```

### Get database information
```
Get information about the postgres database
```

### List tables
```
List all tables in the public schema of the postgres database
```

## Requirements

- PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`) must be in PATH
- Node.js 18+ with ES modules support
- PostgreSQL database access

## Troubleshooting

### "pg_dump: command not found"
Ensure PostgreSQL client tools are installed and in your PATH.

### "Password authentication failed"
Check your `DB_PASSWORD` environment variable.

### "Database does not exist"
Use `create_database: true` when restoring, or create the database manually first.

