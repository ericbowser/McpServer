# CloudPrepper API Endpoints

This directory contains API endpoint implementations for the CloudPrepper backend.

## Coverage Endpoint

### File: `coverage.js`

Provides endpoints for checking question coverage by domain for certification types.

#### Endpoints

**POST `/api/coverage/check`**
- Get current question counts by domain for a certification type
- Queries the database directly
- Returns actual counts from `prepper.comptia_cloud_plus_questions` table

**Request:**
```json
{
  "certification_type": "CV0-004",
  "total_questions_target": 200
}
```

**Response:**
```json
{
  "success": true,
  "certification_type": "CV0-004",
  "current_question_counts": {
    "Cloud Architecture and Design": 35,
    "Cloud Deployment": 42,
    "Cloud Security": 55,
    "Cloud Operations and Support": 38,
    "Troubleshooting": 18,
    "DevOps Fundamentals": 12
  },
  "total_questions": 200,
  "target_questions": 200
}
```

**GET `/api/coverage/stats`**
- Get detailed statistics including cognitive level and skill level coverage
- Query parameter: `certification_type`

**Example:**
```
GET /api/coverage/stats?certification_type=CV0-004
```

## Integration Instructions

### 1. Add to your Express app

In your `cloud_prepper_api` main server file (e.g., `server.js` or `app.js`):

```javascript
const coverageRoutes = require('./api/coverage');
app.use('/api/coverage', coverageRoutes);
```

### 2. Environment Variables

Ensure these are set in your `.env`:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=postgres
DB_PASSWORD=your_password
DB_PORT=5432
```

### 3. Dependencies

Make sure `pg` is installed:

```bash
npm install pg
```

### 4. Authentication

If you want to add authentication middleware, wrap the routes:

```javascript
const { authenticateToken } = require('./middleware/auth');
app.use('/api/coverage', authenticateToken, coverageRoutes);
```

## MCP Server Integration

The MCP server (`cloudprepper_mcp`) is already configured to call this endpoint. It will:

1. Try to call the API endpoint if `CLOUDPREPPER_API_TOKEN` is set
2. Fall back to direct database query if API is unavailable or token is missing

Set these environment variables in the MCP server:

```env
CLOUDPREPPER_API_URL=http://localhost:36236
CLOUDPREPPER_API_TOKEN=your-jwt-token-here
```

## Testing

Test the endpoint with curl:

```bash
# Check coverage
curl -X POST http://localhost:36236/api/coverage/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"certification_type": "CV0-004"}'

# Get stats
curl "http://localhost:36236/api/coverage/stats?certification_type=CV0-004" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
