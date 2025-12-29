# MCP Server Backend Integration Guide

## Overview

Update the MCP server to call your cloud_prepper_api backend for real question generation instead of using mock data.

## Configuration

### 1. Add Backend URL to MCP Server

Create a `.env` file in your MCP server directory:

```bash
cd C:\Projects\McpServer\cloudprepper_mcp
```

Create `.env` file:
```env
BACKEND_URL=http://localhost:3000
BACKEND_JWT_TOKEN=your-jwt-token-here
```

### 2. Get JWT Token

You need a JWT token to authenticate with your backend. Two options:

**Option A: Login via API**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-username","password":"your-password"}'
```

Copy the token from the response and add to `.env`

**Option B: Create dedicated MCP service account**
Register a new user specifically for MCP:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"mcp-service",
    "email":"mcp@localhost.com",
    "password":"secure-password-here"
  }'
```

Then login to get the token.

## Code Changes Needed

### File: `src/tools/questionGenerator.ts`

Replace the `generateQuestions()` function:

```typescript
async function generateQuestions(
  prompt: string,
  count: number,
  params: QuestionGenerationInput
): Promise<GeneratedQuestion[]> {
  try {
    // Call backend API
    const response = await fetch(`${process.env.BACKEND_URL}/questions/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BACKEND_JWT_TOKEN}`,
      },
      body: JSON.stringify({
        certification_type: params.certification_type,
        domain_name: params.domain_name,
        cognitive_level: params.cognitive_level,
        skill_level: params.skill_level,
        count: count,
        scenario_context: params.scenario_context,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Backend API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.questions) {
      throw new Error('Invalid response from backend');
    }

    return data.questions;
  } catch (error) {
    console.error('Question generation failed:', error);
    throw error;
  }
}
```

### Add Node.js fetch support

For Node.js < 18, add to `package.json`:
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.0.4",
  "zod": "^3.23.8",
  "node-fetch": "^3.3.2"
}
```

Then import at top of `questionGenerator.ts`:
```typescript
import fetch from 'node-fetch';
```

For Node.js >= 18, fetch is built-in (no changes needed).

## Testing

### 1. Start Backend Server
```bash
cd C:\Projects\cloud_prepper_api
npm run dev
```

### 2. Build MCP Server
```bash
cd C:\Projects\McpServer\cloudprepper_mcp
npm run build
```

### 3. Test with MCP Inspector
```bash
npm run inspect
```

Try generating questions - you should now get real, unique questions from Claude!

## Environment Variables Summary

### Backend (.env in cloud_prepper_api)
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=...
JWT_SECRET=...
PORT=3000
```

### MCP Server (.env in cloudprepper_mcp)
```env
BACKEND_URL=http://localhost:3000
BACKEND_JWT_TOKEN=eyJhbGc...
```

## Troubleshooting

### Error: "ECONNREFUSED"
- Backend server not running
- Solution: Start backend with `npm run dev`

### Error: "Unauthorized" (401)
- Invalid or expired JWT token
- Solution: Login again and get new token

### Error: "ANTHROPIC_API_KEY not found"
- API key not set in backend .env
- Solution: Add your Anthropic API key to backend .env

### Questions still mock/hardcoded
- MCP server not rebuilt after changes
- Solution: Run `npm run build` in MCP directory

---

**Status:** Ready for integration
**Next:** I can update the questionGenerator.ts code for you
