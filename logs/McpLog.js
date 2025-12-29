const log4js = require('log4js');

let _logger = null;

function initialize() {
  log4js.configure({
    appenders: {
      // File appender for McpServer logs
      mcpServer: {
        type: "file",
        filename: "logs/mcpServer.log",
        maxLogSize: 10485760, // 10 MB
        backups: 3,
        layout: {
          type: 'pattern',
          pattern: '%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %m',
        }
      },
      // Console appender for stdout
      console: {
        type: "stdout",
        layout: {
          type: 'pattern',
          pattern: '%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %m',
        }
      }
    },
    categories: {
      default: {
        appenders: ['mcpServer', 'console'],
        level: 'debug'
      }
    },
  });
  _logger = log4js;
}

function logger() {
  if (!_logger) {
    initialize();
    return _logger.getLogger();
  }

  return _logger.getLogger();
}

module.exports = logger;
