const express = require('express');
const app = express();
const cors = require('cors');
const router = express.Router();
const logger = require('./logs/McpLog');
const {json} = require('body-parser');
const {connectLocalPostgres} = require('./documentdb/client');

let _logger = logger();
_logger.info('Logger Initialized');

router.use(json());
router.use(cors());
router.use(express.json());
router.use(express.urlencoded({extended: true}));

router.post('/api/ping', async (req, res) => {
  try {
    
  } catch (e) {
    _logger.error('Error: ', e.message);
    res.status(500).json({error: e.message});
  }
});

module.exports = router;
