# MCP Servers - Unified Configuration

This parent solution houses three MCP (Model Context Protocol) servers that can be used together with Claude Desktop.

## Available MCP Servers

### 1. CloudPrepper MCP (`cloudprepper-mcp/`)
- **Purpose**: Certification exam question generation and quality analysis
- **Tools**: Question generation, quality analysis, domain coverage checking
- **Type**: TypeScript (requires build)
- **Entry Point**: `cloudprepper_mcp/dist/index.js`

### 2. LaserTags MCP (`lasertg_mcp/`)
- **Purpose**: LaserTags business management - contact and order tracking
- **Tools**: Contact management, order tracking, revenue statistics, progress tracking
- **Type**: JavaScript (ES modules)
- **Entry Point**: `lasertg_mcp/index.js`

### 3. Postgres MCP (`postgres_mcp/`)
- **Purpose**: PostgreSQL database management and backups
- **Tools**: Database backups, restores, schema inspection, database information
- **Type**: JavaScript (ES modules)
- **Entry Point**: `postgres_mcp/index.js`

## Quick Setup

### 1. Install All Dependencies

```bash
npm run mcp:install:all
```

Or use the management script:
```bash
start-all-mcp.bat
```

### 2. Build CloudPrepper MCP

```bash
npm run mcp:build:cloudprepper
```

### 3. Complete Setup (Install + Build)

```bash
npm run mcp:setup
```

## Claude Desktop Configuration

### Unified Configuration File

A unified configuration file is available at:
```
claude_desktop_config_unified.json
```

This file includes all three MCP servers with their proper configurations.

### How to Use

1. **Copy the unified config** to your Claude Desktop config location:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Or merge** the `mcpServers` section into your existing Claude Desktop config

3. **Restart Claude Desktop** to load the new configuration

### Configuration Details

The unified config includes:

- **cloudprepper_mcp**: CloudPrepper certification exam tools
  - No environment variables required
  - Requires built TypeScript files (`dist/index.js`)

- **lasertg_mcp**: LaserTags business management
  - Database connection settings
  - Project paths
  - Backend URLs

- **postgres_mcp**: PostgreSQL database management
  - Database connection settings
  - Backup directory path

- **filesystem**: File system access (optional)
  - Provides file system tools to Claude

## Management Scripts

### NPM Scripts

All available in the parent `package.json`:

```bash
# Install dependencies
npm run mcp:install:all              # Install all servers
npm run mcp:install:cloudprepper     # Install CloudPrepper only
npm run mcp:install:lasertags        # Install LaserTags only
npm run mcp:install:postgres         # Install Postgres only

# Build
npm run mcp:build                    # Build CloudPrepper
npm run mcp:build:cloudprepper       # Build CloudPrepper (explicit)

# Setup
npm run mcp:setup                    # Install all + build CloudPrepper

# Testing
npm run mcp:test:cloudprepper        # Test CloudPrepper with inspector
npm run mcp:test:lasertags           # Test LaserTags server
npm run mcp:test:postgres            # Test Postgres server
```

### Windows Batch Script

Use `start-all-mcp.bat` for an interactive menu:

```bash
start-all-mcp.bat
```

This provides a menu-driven interface for:
- Installing dependencies
- Building servers
- Testing servers
- Viewing configuration information

## Environment Variables

### LaserTags MCP
- `DB_USER`: PostgreSQL username (default: postgres)
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_NAME`: Database name (default: postgres)
- `DB_PASSWORD`: PostgreSQL password
- `DB_PORT`: PostgreSQL port (default: 5432)
- `LASERTAGS_PROJECT_PATH`: Path to LaserTags project
- `BACKEND_LASER_PROJECT_PATH`: Path to backend project
- `LASER_BACKEND_URL`: Backend API URL
- `PROJECT_MANAGER_URL`: Project manager URL

### Postgres MCP
- `DB_USER`: PostgreSQL username (default: postgres)
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_NAME`: Database name (default: postgres)
- `DB_PASSWORD`: PostgreSQL password
- `DB_PORT`: PostgreSQL port (default: 5432)
- `BACKUP_DIR`: Backup directory path

### CloudPrepper MCP
- No environment variables required

## Testing Individual Servers

### CloudPrepper MCP
```bash
cd cloudprepper-mcp
npm run inspect
```
Opens MCP Inspector in browser for interactive testing.

### LaserTags MCP
```bash
cd lasertg_mcp
node index.js
```
Runs server on stdio (for Claude Desktop integration).

### Postgres MCP
```bash
cd postgres_mcp
node index.js
```
Runs server on stdio (for Claude Desktop integration).

## Troubleshooting

### CloudPrepper MCP Not Working
1. Ensure TypeScript is built: `npm run mcp:build:cloudprepper`
2. Check that `dist/index.js` exists
3. Verify path in Claude Desktop config matches actual location

### Database Connection Issues
1. Verify PostgreSQL is running
2. Check environment variables in Claude Desktop config
3. Test connection manually with `psql`

### Module Not Found Errors
1. Run `npm run mcp:install:all` to install all dependencies
2. Ensure you're in the correct directory
3. Check that `node_modules` exists in each MCP server directory

## Project Structure

```
McpServer/
├── cloudprepper-mcp/          # CloudPrepper MCP server
│   ├── src/                   # TypeScript source
│   ├── dist/                  # Compiled JavaScript
│   └── package.json
├── lasertg_mcp/               # LaserTags MCP server
│   ├── index.js
│   └── package.json
├── postgres_mcp/              # Postgres MCP server
│   ├── index.js
│   ├── backups/               # Backup files
│   └── package.json
├── claude_desktop_config_unified.json  # Unified config
├── start-all-mcp.bat          # Management script
├── package.json               # Parent package.json with MCP scripts
└── MCP_SERVERS_README.md      # This file
```

## Next Steps

1. Run `npm run mcp:setup` to install and build everything
2. Copy `claude_desktop_config_unified.json` to your Claude Desktop config
3. Restart Claude Desktop
4. Start using all three MCP servers in Claude Desktop!

