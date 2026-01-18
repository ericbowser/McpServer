const {Client, Pool} = require('pg');
const path = require('path');
const logger = require('../logs/mcpLog');
const _logger = logger();

let client = null;

// Database connection configuration
const dbConfig = {
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || '',
	host: process.env.DB_SERVER || 'localhost',
	port: process.env.DB_PORT || 5432,
	database: 'ericbo',
	ssl: false
};

async function connectLocalPostgres() {
	try {
		if (!client) {
			_logger.info('=== Starting PostgreSQL Connection ===');
			_logger.info('Connecting to local postgres..');
			_logger.info('Database configuration:', {
				user: dbConfig.user,
				host: dbConfig.host,
				port: dbConfig.port,
				database: dbConfig.database,
				ssl: dbConfig.ssl,
			});
			
			const connectStartTime = Date.now();
			client = new Client(dbConfig);
			_logger.info('Client instance created, attempting connection...');
			
			await client.connect();
			const connectDuration = ((Date.now() - connectStartTime) / 1000).toFixed(2);
			
			_logger.info(`Successfully connected to PostgreSQL (took ${connectDuration}s)`);
			_logger.info('Connection details:', {
				host: dbConfig.host,
				port: dbConfig.port,
				database: dbConfig.database,
			});
			_logger.info('=== PostgreSQL Connection Complete ===');
		} else {
			_logger.info('Using existing PostgreSQL connection (client already initialized)');
		}

		return client;
	} catch (error) {
		_logger.info('=== PostgreSQL Connection Error ===');
		_logger.info('Error connecting to local postgres:', {
			message: error.message,
			code: error.code,
			errno: error.errno,
			syscall: error.syscall,
			hostname: error.hostname,
			port: error.port,
		});
		_logger.info('Database configuration used:', {
			user: dbConfig.user,
			host: dbConfig.host,
			port: dbConfig.port,
			database: dbConfig.database,
		});
		if (error.stack) {
			_logger.info('Error stack:', error.stack);
		}
		_logger.info('=== PostgreSQL Connection Failed ===');
		_logger.error(`PostgreSQL connection failed: ${error.message}`);
		throw error;
	}
}

module.exports = {connectLocalPostgres};