const server = require('./server');  // Updated to use server.js
const http = require("node:http");
const logger = require('./logs/mcpLog');
const _logger = logger();
_logger.info('Starting LaserTags API');

const swaggerJsdoc = require('swagger-jsdoc');
const express = require("express");
const {serve, setup} = require("swagger-ui-express");

const httpPort = process.env.PORT || 3003;
console.log('LaserTags API starting on port:', httpPort);

const app = express();

// IMPORTANT: Mount server routes BEFORE any body parsing middleware
// This ensures the Stripe webhook with raw body works correctly
app.use(server);

// Then add general middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Serve static files from docs directory
app.use('/docs', express.static('docs'));

// Swagger UI for LaserTags API (if LaserTagsApi.yaml exists)
const swaggerOptions = {
    definition: {
        schemes: ['http', 'https'],
        openapi: "3.0.0",
        info: {
            title: 'LaserTags API',
            version: '1.0.0',
            description: 'API for LaserTags Pet ID E-commerce Platform',
        },
        contact:{
            name: 'API Support',
            url: 'https://lasertags.com',
            email: 'support@lasertags.com'
        },
        servers: [
            {
                url: `http://localhost:${httpPort}`,
                description: 'Local development server'
            },
            {
                url: 'https://api.lasertags.com',
                description: 'Production server'
            }
        ]
    },
    apis: ['./docs/LaserTagsApi.yaml']
}

const httpServer = http.createServer(app);
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', serve, setup(swaggerDocs))

// MCP API Documentation endpoints
app.get('/mcp-docs', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>MCP Server API Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        .api-card { background: #f9f9f9; border-left: 4px solid #4CAF50; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .api-card h2 { margin-top: 0; color: #4CAF50; }
        .api-card p { color: #666; line-height: 1.6; }
        .link-btn { display: inline-block; background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 5px 5px 5px 0; }
        .link-btn:hover { background: #45a049; }
        .swagger-link { background: #87CEEB; }
        .swagger-link:hover { background: #6BB6FF; }
        .tools-list { margin: 10px 0; padding-left: 20px; }
        .tools-list li { margin: 5px 0; color: #555; }
    </style>
</head>
<body>
    <div class="container">
        <h1>MCP Server API Documentation</h1>
        <p>Comprehensive OpenAPI 3.0 documentation for all three Model Context Protocol servers.</p>
        
        <div class="api-card">
            <h2>1. CloudPrepper MCP Server</h2>
            <p><strong>Purpose:</strong> Certification exam question generation and management</p>
            <p><strong>Tools:</strong></p>
            <ul class="tools-list">
                <li>cloudprepper_generate_question - Generate exam questions</li>
                <li>cloudprepper_analyze_quality - Analyze question quality</li>
                <li>cloudprepper_check_coverage - Check domain coverage</li>
                <li>cloudprepper_insert_question - Insert questions to database</li>
                <li>cloudprepper_analyze_cognitive_level - Analyze cognitive complexity</li>
                <li>cloudprepper_check_uniqueness - Check question uniqueness</li>
            </ul>
            <a href="https://editor.swagger.io/?url=http://localhost:${httpPort}/docs/cloudprepper-mcp-api.yaml" class="link-btn swagger-link" target="_blank">View in Swagger Editor</a>
            <a href="/docs/cloudprepper-mcp-api.yaml" class="link-btn" download>Download YAML</a>
        </div>

        <div class="api-card">
            <h2>2. PostgreSQL MCP Server</h2>
            <p><strong>Purpose:</strong> PostgreSQL database management and backup operations</p>
            <p><strong>Tools:</strong></p>
            <ul class="tools-list">
                <li>create_backup - Create database backups</li>
                <li>restore_backup - Restore from backups</li>
                <li>list_backups - List available backups</li>
                <li>list_databases - List all databases</li>
                <li>get_database_info - Get database details</li>
                <li>list_tables - List tables in database</li>
                <li>get_table_info - Get table structure</li>
                <li>get_database_size - Get database sizes</li>
                <li>get_connection_info - Get connection info</li>
            </ul>
            <a href="https://editor.swagger.io/?url=http://localhost:${httpPort}/docs/postgres-mcp-api.yaml" class="link-btn swagger-link" target="_blank">View in Swagger Editor</a>
            <a href="/docs/postgres-mcp-api.yaml" class="link-btn" download>Download YAML</a>
        </div>

        <div class="api-card">
            <h2>3. LaserTags MCP Server</h2>
            <p><strong>Purpose:</strong> LaserTags pet ID tag e-commerce business management</p>
            <p><strong>Tools:</strong></p>
            <ul class="tools-list">
                <li>get_contact - Get contact by ID</li>
                <li>save_contact - Create new contact</li>
                <li>update_contact - Update contact</li>
                <li>get_all_contacts - List all contacts</li>
                <li>search_contacts - Search contacts</li>
                <li>get_revenue_stats - Get revenue statistics</li>
                <li>get_recent_orders - Get recent orders</li>
                <li>track_progress - Track business progress</li>
                <li>check_database - Verify database setup</li>
            </ul>
            <a href="https://editor.swagger.io/?url=http://localhost:${httpPort}/docs/lasertags-mcp-api.yaml" class="link-btn swagger-link" target="_blank">View in Swagger Editor</a>
            <a href="/docs/lasertags-mcp-api.yaml" class="link-btn" download>Download YAML</a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #e8f5e9; border-radius: 4px;">
            <h3>📚 Documentation</h3>
            <p>For detailed setup and usage instructions, see:</p>
            <ul>
                <li><a href="/docs/MCP_API_DOCUMENTATION.md">MCP API Documentation Guide</a></li>
                <li><a href="/MCP_SERVERS_README.md">MCP Servers README</a></li>
            </ul>
        </div>
    </div>
</body>
</html>
    `);
});

httpServer.listen(httpPort, () => {
    console.log(`✅ LaserTags API running at http://localhost:${httpPort}`);
    console.log(`📚 API Documentation at http://localhost:${httpPort}/api-docs`);
    console.log(`📖 MCP Server Docs at http://localhost:${httpPort}/mcp-docs`);
    console.log(`🏥 Health check at http://localhost:${httpPort}/api/health`);
});
