const {Client, Pool} = require('pg');
const config = require("dotenv").config();
const path = require('path');
const getLogger = require("../logs/McpLog.js");
let _logger = getLogger();

// Change .env based on local dev or prod
const env = path.resolve(__dirname, '.env');
const options = {
	path: env
};

let client = null;

const connectionString =
	`postgres://${config.parsed.DB_USER}:${config.parsed.DB_PASSWORD}@${config.parsed.DB_SERVER}:${config.parsed.DB_PORT}/postgres`;

async function connectLocalPostgres() {
	try {
		if (!client) {
			_logger.info('Connecting to local postgres..');
			client = new Client({
				connectionString: connectionString,
				ssl: false
			});
			await client.connect();
		}

		return client;
	} catch (error) {
		_logger.error('Error connecting to local postgres: ', {error});
		throw error;
	}
}
module.exports = {connectLocalPostgres};