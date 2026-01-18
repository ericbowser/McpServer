/**
 * Coverage API Endpoint for CloudPrepper
 * 
 * This endpoint queries the database to get actual question counts by domain
 * for a given certification type.
 * 
 * Endpoint: POST /api/coverage/check
 * 
 * Request body:
 * {
 *   "certification_type": "CV0-004" | "SAA-C03",
 *   "total_questions_target": 200 (optional, default: 200)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "current_question_counts": {
 *     "Cloud Architecture and Design": 35,
 *     "Cloud Security": 55,
 *     ...
 *   },
 *   "total_questions": 188
 * }
 */

const express = require('express');
const router = express.Router();
const pg = require('pg');
const { Pool } = pg;

// Database connection - use same config as cloudprepper_mcp
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Domain mappings for each certification type
// These must match exactly with the domain names stored in the database
// and the names in cloudprepper_mcp/src/constants.ts
const DOMAIN_MAPPINGS = {
  'CV0-004': [
    'Cloud Architecture and Design',
    'Cloud Deployment',
    'Cloud Security',
    'Cloud Operations and Support',
    'Troubleshooting',
    'DevOps Fundamentals'
  ],
  'SAA-C03': [
    'Design Secure Architectures',
    'Design Resilient Architectures',
    'Design High-Performing Architectures',
    'Design Cost-Optimized Architectures'
  ]
};

/**
 * POST /api/coverage/check
 * Get current question counts by domain for a certification type
 */
router.post('/check', async (req, res) => {
  try {
    const { certification_type, total_questions_target = 200 } = req.body;

    // Validate certification type
    if (!certification_type || !['CV0-004', 'SAA-C03'].includes(certification_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid certification_type. Must be "CV0-004" or "SAA-C03"'
      });
    }

    // Get domain names for this certification type
    const domains = DOMAIN_MAPPINGS[certification_type];
    if (!domains || domains.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No domains configured for certification type: ${certification_type}`
      });
    }

    // Build query to count questions by domain
    // Note: The database stores domain names in the 'domain' column
    const domainPlaceholders = domains.map((_, index) => `$${index + 1}`).join(', ');
    
    const query = `
      SELECT 
        domain,
        COUNT(*) as question_count
      FROM prepper.comptia_cloud_plus_questions
      WHERE domain IN (${domainPlaceholders})
      GROUP BY domain
      ORDER BY domain;
    `;

    const result = await pool.query(query, domains);
    
    // Build response object with counts per domain
    const currentCounts = {};
    let totalQuestions = 0;

    // Initialize all domains with 0
    domains.forEach(domain => {
      currentCounts[domain] = 0;
    });

    // Fill in actual counts from database
    result.rows.forEach(row => {
      if (row.domain && currentCounts.hasOwnProperty(row.domain)) {
        const count = parseInt(row.question_count, 10);
        currentCounts[row.domain] = count;
        totalQuestions += count;
      }
    });

    res.json({
      success: true,
      certification_type,
      current_question_counts: currentCounts,
      total_questions: totalQuestions,
      target_questions: total_questions_target
    });

  } catch (error) {
    console.error('Error checking coverage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check coverage',
      message: error.message
    });
  }
});

/**
 * GET /api/coverage/stats
 * Get overall coverage statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { certification_type } = req.query;

    if (!certification_type || !['CV0-004', 'SAA-C03'].includes(certification_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid certification_type. Must be "CV0-004" or "SAA-C03"'
      });
    }

    const domains = DOMAIN_MAPPINGS[certification_type];
    const domainPlaceholders = domains.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      SELECT 
        domain,
        COUNT(*) as question_count,
        COUNT(CASE WHEN cognitive_level IS NOT NULL THEN 1 END) as with_cognitive_level,
        COUNT(CASE WHEN skill_level IS NOT NULL THEN 1 END) as with_skill_level
      FROM prepper.comptia_cloud_plus_questions
      WHERE domain IN (${domainPlaceholders})
      GROUP BY domain
      ORDER BY domain;
    `;

    const result = await pool.query(query, domains);

    res.json({
      success: true,
      certification_type,
      stats: result.rows
    });

  } catch (error) {
    console.error('Error getting coverage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coverage stats',
      message: error.message
    });
  }
});

module.exports = router;
