#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool definitions and handlers
import {
  questionGeneratorTool,
  handleQuestionGeneration,
} from './tools/questionGenerator.js';
import {
  questionQualityTool,
  handleQualityAnalysis,
} from './tools/questionQuality.js';
import {
  domainCoverageTool,
  handleCoverageCheck,
} from './tools/domainCoverage.js';
import {
  questionInsertTool,
  handleQuestionInsert,
} from './tools/questionInsert.js';
import {
  cognitiveLevelAnalysisTool,
  handleCognitiveLevelAnalysis,
} from './tools/cognitiveLevelAnalysis.js';
import {
  uniquenessCheckTool,
  handleUniquenessCheck,
} from './tools/uniquenessCheck.js';

// Create MCP server instance
const server = new Server(
  {
    name: 'cloudprepper-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      questionGeneratorTool,
      questionQualityTool,
      domainCoverageTool,
      questionInsertTool,
      cognitiveLevelAnalysisTool,
      uniquenessCheckTool,
    ],
  };
});

// Register tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'cloudprepper_generate_question':
        return await handleQuestionGeneration(args);

      case 'cloudprepper_analyze_quality':
        return await handleQualityAnalysis(args);

      case 'cloudprepper_check_coverage':
        return await handleCoverageCheck(args);

      case 'cloudprepper_insert_question':
        return await handleQuestionInsert(args);

      case 'cloudprepper_analyze_cognitive_level':
        return await handleCognitiveLevelAnalysis(args);

      case 'cloudprepper_check_uniqueness':
        return await handleUniquenessCheck(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CloudPrepper MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
