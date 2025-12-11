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

httpServer.listen(httpPort, () => {
    console.log(`✅ LaserTags API running at http://localhost:${httpPort}`);
    console.log(`📚 API Documentation at http://localhost:${httpPort}/api-docs`);
    console.log(`🏥 Health check at http://localhost:${httpPort}/api/health`);
});
