# How to Send Requests to the MCP Server

There are several ways to interact with your PostgreSQL MCP server:

## Method 1: Using Claude Desktop (Recommended)

This is the easiest way - Claude Desktop automatically manages the MCP server connection.

### Step 1: Configure Claude Desktop

Add the MCP server to your Claude Desktop configuration file:

**Windows Location:** `%APPDATA%\Claude\claude_desktop_config.json`

**macOS Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Linux Location:** `~/.config/Claude/claude_desktop_config.json`

### Step 2: Add Server Configuration

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": [
        "C:\\Projects\\McpServer\\postgres_mcp\\index.js"
      ],
      "env": {
        "DB_USER": "postgres",
        "DB_HOST": "localhost",
        "DB_NAME": "postgres",
        "DB_PASSWORD": "your_password",
        "DB_PORT": "5432",
        "BACKUP_DIR": "C:\\Projects\\McpServer\\postgres_mcp\\backups"
      }
    }
  }
}
```

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop completely for the changes to take effect.

### Step 4: Use in Claude Chat

Once configured, you can ask Claude to use the MCP tools:

```
Create a backup of my postgres database
```

```
List all my postgres databases
```

```
Show me information about the postgres database
```

```
List all tables in the postgres public schema
```

Claude will automatically call the appropriate MCP tools.

---

## Method 2: Manual Testing via stdio

You can test the MCP server directly by sending JSON-RPC messages via stdin:

### Start the Server

```bash
cd postgres_mcp
node index.js
```

The server will wait for JSON-RPC messages on stdin.

### Send a Request

The MCP protocol uses JSON-RPC 2.0. Example request format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**List available tools:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Call a tool:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_databases",
    "arguments": {}
  }
}
```

**Example: Get database info:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_database_info",
    "arguments": {
      "database": "postgres"
    }
  }
}
```

**Example: Create backup:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "create_backup",
    "arguments": {
      "database": "postgres",
      "format": "custom"
    }
  }
}
```

**Example: Create INSERT script backup for specific schema:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "create_backup",
    "arguments": {
      "database": "postgres",
      "format": "inserts",
      "schema": "public"
    }
  }
}
```

### Testing with echo (Windows PowerShell)

```powershell
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node index.js
```

### Testing with echo (Linux/macOS)

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node index.js
```

---

## Method 3: Programmatic Access (Node.js)

You can create a client script to interact with the MCP server:

### Create a Test Client

```javascript
// test-mcp-client.js
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Start the MCP server
const server = spawn('node', [join(__dirname, 'index.js')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send a request
const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
};

server.stdin.write(JSON.stringify(request) + '\n');

// Handle responses
let buffer = '';
server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Cleanup
setTimeout(() => {
  server.kill();
  process.exit(0);
}, 5000);
```

Run it:
```bash
node test-mcp-client.js
```

---

## Method 4: Using the Standalone Scripts

For backup and restore operations, you can use the standalone scripts directly:

### Create Backup
```bash
cd postgres_mcp
node backup.js [database_name] [filename] [schema]
```

Examples:
```bash
# Backup entire database
node backup.js postgres my_backup

# Backup specific schema
node backup.js postgres my_backup public

# Backup with INSERT format (set BACKUP_FORMAT=inserts)
BACKUP_FORMAT=inserts node backup.js postgres my_backup public
```

### Restore Backup
```bash
cd postgres_mcp
node restore.js backup_file.dump [target_database] [--create-db]
```

Example:
```bash
node restore.js postgres_2024-01-01.dump postgres --create-db
```

---

## Available Tools

Your PostgreSQL MCP server provides these tools:

### Backup Operations
- `create_backup` - Create a database backup
  - Supports formats: `custom`, `plain`, `tar`, `inserts` (INSERT statements)
  - Optional `schema` parameter to backup specific schema only
- `restore_backup` - Restore from a backup
- `list_backups` - List available backups

### Database Information
- `list_databases` - List all databases
- `get_database_info` - Get database details
- `get_database_size` - Get database and table sizes
- `list_tables` - List tables in a schema
- `get_table_info` - Get detailed table information
- `get_connection_info` - Get PostgreSQL server info

---

## Troubleshooting

### Server won't start
- Check Node.js is installed: `node --version`
- Check dependencies: `cd postgres_mcp && npm install`
- Verify database credentials in environment variables

### No response from server
- Check server is running: Look for "PostgreSQL MCP Server running on stdio" message
- Verify JSON-RPC format is correct
- Check stderr for error messages

### Connection errors
- Verify PostgreSQL is running
- Check database credentials
- Test connection: `psql -U postgres -d postgres -c "SELECT 1"`

---

## Example Workflow

1. **Start Claude Desktop** (with MCP server configured)
2. **Ask Claude**: "List all my PostgreSQL databases"
3. **Claude calls**: `list_databases` tool
4. **You see**: List of all databases with sizes

Or manually:
```bash
# Start server
node index.js

# In another terminal, send request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_databases","arguments":{}}}' | node index.js
```

