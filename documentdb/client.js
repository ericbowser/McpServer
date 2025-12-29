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
			_logger.info('Connecting to local postgres..');
			client = new Client(dbConfig);
			await client.connect();
			_logger.info('Successfully connected to PostgreSQL');
		}

		return client;
	} catch (error) {
		_logger.error('Error connecting to local postgres: ', {error});
		throw error;
	}
}

module.exports = {connectLocalPostgres};