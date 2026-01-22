import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CertificationType,
  CognitiveLevel,
  SkillLevel,
  GeneratedQuestion,
  CloudPlusDomain,
} from '../types/index.js';
import { CURRENT_YEAR } from '../constants.js';
import { formatQuestionsAsSQL } from './questionGenerator.js';
// Logger stub - outputs to stderr to avoid breaking MCP JSON-RPC protocol
const _logger = {
  info: (...args: unknown[]) => console.error('[INFO]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  warn: (...args: unknown[]) => console.error('[WARN]', ...args),
  debug: (...args: unknown[]) => console.error('[DEBUG]', ...args),
};

// Get directory paths - save to questions directory relative to project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From dist/tools or src/tools, go up to project root, then into questions
const questionsDir = path.join(__dirname, '..', '..', 'questions');

// Zod schema for input validation
export const QuestionBatchGenerationSchema = z.object({
  certification_type: z.nativeEnum(CertificationType),
  domain_name: z.nativeEnum(CloudPlusDomain).optional(),
  cognitive_level: z.union([
    z.nativeEnum(CognitiveLevel),
    z.array(z.nativeEnum(CognitiveLevel))
  ]).optional(),
  skill_level: z.union([
    z.nativeEnum(SkillLevel),
    z.array(z.nativeEnum(SkillLevel))
  ]).optional(),
  count: z.number().min(1).max(50).default(1),
  scenario_context: z.string().optional(),
  output_format: z.enum(['json', 'sql']).optional().default('json'),
});

export type QuestionBatchGenerationInput = z.infer<typeof QuestionBatchGenerationSchema>;

// Tool definition for MCP
export const questionBatchGeneratorTool = {
  name: 'cloudprepper_generate_batch',
  description: `Generate multiple copyright-safe, scenario-based certification exam questions using batch processing.

This tool efficiently generates large batches of high-quality practice questions (1-50) using Anthropic's batch API. It follows the same principles as the regular question generator:
- Uses conceptual transformation (never copies existing questions)
- Focuses on real-world scenarios from ${CURRENT_YEAR}
- Targets appropriate cognitive and skill levels
- Provides comprehensive explanations with technical depth
- Ensures proper difficulty distribution

Output Formats:
- "json" (default): Saves structured JSON with question objects to a file in ../questions/ directory
- "sql": Saves ready-to-use PostgreSQL INSERT statements to a file in ../questions/ directory. The statements can be executed directly against the prepper.comptia_cloud_plus_questions table. Each statement is properly escaped and uses PostgreSQL-specific syntax (jsonb, arrays, sequences).

Note: Since batch processing may take time, this tool implements polling to wait for batch completion:
- Submits batch request and receives batch_id
- Polls batch status at configurable intervals (default: 30s)
- Waits for completion with timeout (default: 3600s / 1 hour)
- Retrieves results once batch is complete
- All output is saved to files with descriptive names (including timestamp, certification type, domain, and question count)

The response includes the file path where you can find the results. Polling progress is logged to stderr.

Use when you need to:
- Generate large batches of questions efficiently (10-50 questions)
- Fill gaps in domain coverage at scale
- Create comprehensive question sets for specific topics
- Produce multiple questions at specific difficulty levels
- Get SQL INSERT statements for direct database insertion

Note: For smaller batches (1-10 questions), consider using cloudprepper_generate_question for faster single-request processing.`,
  inputSchema: {
    type: 'object',
    properties: {
      certification_type: {
        type: 'string',
        enum: Object.values(CertificationType),
        description: 'Target certification (CV0-004 or SAA-C03)',
      },
      domain_name: {
        type: 'string',
        enum: Object.values(CloudPlusDomain),
        description: 'Specific CompTIA Cloud+ domain to focus on (optional)',
      },
      cognitive_level: {
        oneOf: [
          {
            type: 'string',
            enum: Object.values(CognitiveLevel),
            description: "Bloom's taxonomy level (optional, single value)",
          },
          {
            type: 'array',
            items: {
              type: 'string',
              enum: Object.values(CognitiveLevel),
            },
            description: "Bloom's taxonomy levels (optional, array for batch generation - tells backend what kinds of questions to create)",
          },
        ],
        description: "Bloom's taxonomy level(s) - can be a single value or array for batch generation",
      },
      skill_level: {
        oneOf: [
          {
            type: 'string',
            enum: Object.values(SkillLevel),
            description: 'Target skill level (optional, single value)',
          },
          {
            type: 'array',
            items: {
              type: 'string',
              enum: Object.values(SkillLevel),
            },
            description: 'Target skill levels (optional, array for batch generation - tells backend what kinds of questions to create)',
          },
        ],
        description: 'Target skill level(s) - can be a single value or array for batch generation',
      },
      count: {
        type: 'number',
        description: 'Number of questions to generate (1-50, default: 1)',
        minimum: 1,
        maximum: 50,
      },
      scenario_context: {
        type: 'string',
        description: 'Optional scenario context or specific requirements',
      },
      output_format: {
        type: 'string',
        enum: ['json', 'sql'],
        description: 'Output format: "json" (default) or "sql" for SQL INSERT statements',
      },
    },
    required: ['certification_type'],
  },
};

// Helper function to ensure questions directory exists
async function ensureQuestionsDirectory(): Promise<void> {
  try {
    await fs.mkdir(questionsDir, { recursive: true });
    _logger.info(`✓ Questions directory created/verified: ${questionsDir}`);
  } catch (error) {
    // Directory might already exist, which is fine
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      _logger.info(`✗ Failed to create questions directory: ${error}`);
      throw error;
    }
    _logger.info(`✓ Questions directory already exists: ${questionsDir}`);
  }
}

// Helper function to generate filename
function generateFilename(params: QuestionBatchGenerationInput, count: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const cert = params.certification_type.replace(/[^a-zA-Z0-9]/g, '');
  const domain = params.domain_name
    ? params.domain_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)
    : 'all';
  return `batch_${cert}_${domain}_${count}q_${timestamp}.sql`;
}

// Handler function
export async function handleQuestionBatchGeneration(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  _logger.info('\n=== Starting Batch Question Generation ===');
  _logger.info(`Timestamp: ${new Date().toISOString()}`);
  _logger.info(`Raw input args: ${JSON.stringify(args, null, 2)}`);
  
  // Validate input
  _logger.info('Validating input parameters...');
  const validated = QuestionBatchGenerationSchema.parse(args);
  _logger.info('✓ Input validation successful');
  // Normalize for logging
  const cognitiveLevelsForLog = Array.isArray(validated.cognitive_level)
    ? validated.cognitive_level
    : validated.cognitive_level
    ? [validated.cognitive_level]
    : undefined;
  const skillLevelsForLog = Array.isArray(validated.skill_level)
    ? validated.skill_level
    : validated.skill_level
    ? [validated.skill_level]
    : undefined;

  _logger.info('Validated Parameters:', {
    certification_type: validated.certification_type,
    domain_name: validated.domain_name,
    cognitive_levels: cognitiveLevelsForLog,
    skill_levels: skillLevelsForLog,
    count: validated.count,
    output_format: validated.output_format,
    scenario_context: validated.scenario_context ? `[${validated.scenario_context.length} chars]` : 'not provided',
  });

  // Generate questions from batch API
  _logger.info(`\n--- Step 1: Requesting Questions from Batch API ---`);
  _logger.info(`Requesting ${validated.count} question(s) from batch API...`);
  const requestStartTime = Date.now();
  const questions = await generateBatchQuestions(validated);
  const requestDuration = ((Date.now() - requestStartTime) / 1000).toFixed(2);
  _logger.info(`✓ Received ${questions.length} question(s) from batch API (took ${requestDuration}s)`);
  _logger.info(`Question details:`, {
    count: questions.length,
    domains: [...new Set(questions.map(q => q.domain))],
    cognitive_levels: [...new Set(questions.map(q => q.cognitive_level))],
    skill_levels: [...new Set(questions.map(q => q.skill_level))],
  });

  // Format response based on output_format
  _logger.info(`\n--- Step 2: Formatting Output (format: ${validated.output_format}) ---`);
  if (validated.output_format === 'sql') {
    _logger.info('Formatting questions as SQL INSERT statements...');
    const formatStartTime = Date.now();
    // Generate PostgreSQL-compatible INSERT statements ready for direct execution
    const sqlStatements = formatQuestionsAsSQL(questions, {
      certification_type: validated.certification_type,
      domain_name: validated.domain_name,
    });
    const formatDuration = ((Date.now() - formatStartTime) / 1000).toFixed(2);
    _logger.info(`✓ Generated ${questions.length} SQL INSERT statement(s) (took ${formatDuration}s)`);
    _logger.info(`SQL output size: ${(sqlStatements.length / 1024).toFixed(2)} KB`);

    // Ensure questions directory exists
    _logger.info(`Ensuring questions directory exists: ${questionsDir}`);
    await ensureQuestionsDirectory();
    _logger.info('✓ Questions directory ready');

    // Generate filename and save to file
    _logger.info(`\n--- Step 3: Saving to File ---`);
    const filename = generateFilename(validated, questions.length);
    const filePath = path.join(questionsDir, filename);
    _logger.info(`Generated filename: ${filename}`);
    _logger.info(`Full file path: ${filePath}`);
    _logger.info(`Saving SQL file: ${filename}`);

    try {
      await fs.writeFile(filePath, sqlStatements, 'utf8');
      const stats = await fs.stat(filePath);
      _logger.info(`✓ File saved successfully: ${filePath}`);
      _logger.info(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
      _logger.info(`  Questions: ${questions.length}`);
      _logger.info('=== Batch Generation Complete ===\n');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Batch questions generated and saved to file',
                file_path: filePath,
                filename: filename,
                count: questions.length,
                metadata: {
                  certification_type: validated.certification_type,
                  domain_name: validated.domain_name,
                  cognitive_levels: cognitiveLevelsForLog,
                  skill_levels: skillLevelsForLog,
                  batch_processing: true,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      _logger.info(`✗ Failed to save SQL file: ${errorMessage}`);
      throw new Error(
        `Failed to save SQL file: ${errorMessage}`
      );
    }
  }

  // Default: JSON format - also save to file
  _logger.info('Formatting questions as JSON...');
  const jsonFormatStartTime = Date.now();
  const jsonContent = JSON.stringify(
    {
      success: true,
      count: questions.length,
      questions: questions,
      metadata: {
        certification_type: validated.certification_type,
        domain_name: validated.domain_name,
        cognitive_levels: cognitiveLevelsForLog,
        skill_levels: skillLevelsForLog,
        batch_processing: true,
      },
    },
    null,
    2
  );
  const jsonFormatDuration = ((Date.now() - jsonFormatStartTime) / 1000).toFixed(2);
  _logger.info(`✓ Generated JSON for ${questions.length} question(s) (took ${jsonFormatDuration}s)`);
  _logger.info(`JSON output size: ${(jsonContent.length / 1024).toFixed(2)} KB`);

  // Ensure questions directory exists
  _logger.info(`Ensuring questions directory exists: ${questionsDir}`);
  await ensureQuestionsDirectory();
  _logger.info('✓ Questions directory ready');

  // Generate filename and save to file
  _logger.info(`\n--- Step 3: Saving to File ---`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const cert = validated.certification_type.replace(/[^a-zA-Z0-9]/g, '');
  const domain = validated.domain_name
    ? validated.domain_name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)
    : 'all';
  const jsonFilename = `batch_${cert}_${domain}_${questions.length}q_${timestamp}.json`;
  const jsonFilePath = path.join(questionsDir, jsonFilename);
  _logger.info(`Generated filename: ${jsonFilename}`);
  _logger.info(`Full file path: ${jsonFilePath}`);
  _logger.info(`Saving JSON file: ${jsonFilename}`);

  try {
    await fs.writeFile(jsonFilePath, jsonContent, 'utf8');
    const stats = await fs.stat(jsonFilePath);
    _logger.info(`✓ File saved successfully: ${jsonFilePath}`);
    _logger.info(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
    _logger.info(`  Questions: ${questions.length}`);
    _logger.info('=== Batch Generation Complete ===\n');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Batch questions generated and saved to file',
              file_path: jsonFilePath,
              filename: jsonFilename,
              count: questions.length,
                metadata: {
                  certification_type: validated.certification_type,
                  domain_name: validated.domain_name,
                  cognitive_levels: cognitiveLevelsForLog,
                  skill_levels: skillLevelsForLog,
                  batch_processing: true,
                },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    _logger.info(`✗ Failed to save JSON file: ${errorMessage}`);
    throw new Error(
      `Failed to save JSON file: ${errorMessage}`
    );
  }
}

// Poll batch status until completion
async function pollBatchStatus(
  baseUrl: string,
  batchId: string,
  apiToken: string,
  pollInterval: number = 30,
  maxWaitTime: number = 3600
): Promise<Record<string, unknown>> {
  const statusEndpoint = `${baseUrl}/api/questions/batch/${batchId}/status`;
  const startTime = Date.now();
  let pollCount = 0;

  _logger.info(`\n--- Polling Batch Status ---`);
  _logger.info(`Batch ID: ${batchId}`);
  _logger.info(`Status endpoint: ${statusEndpoint}`);
  _logger.info(`Poll interval: ${pollInterval}s`);
  _logger.info(`Max wait time: ${maxWaitTime}s`);
  _logger.info(`Start time: ${new Date(startTime).toISOString()}`);

  while (true) {
    pollCount++;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    
    try {
      const pollRequestStart = Date.now();
      _logger.info(`[Poll #${pollCount}] Sending GET request to status endpoint...`);
      const response = await fetch(statusEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
      });
      const pollRequestDuration = ((Date.now() - pollRequestStart) / 1000).toFixed(2);
      _logger.info(`[Poll #${pollCount}] Response received (${pollRequestDuration}s): status ${response.status}`);

      if (!response.ok) {
        // Handle 404 and 500 - endpoint might not exist or be broken
        if (response.status === 404 || response.status === 500) {
          const errorMsg = response.status === 404 
            ? 'Batch status endpoint not found (404)'
            : `Batch status endpoint error (500)`;
          _logger.info(`✗ ${errorMsg}`);
          throw new Error(`Batch status check failed: ${errorMsg}`);
        }
        
        const errorData = (await response.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        const errorMsg = (errorData.error as string) || response.statusText;
        _logger.info(`✗ Failed to check batch status: ${response.status} - ${errorMsg}`);
        throw new Error(`Batch status check failed: ${errorMsg}`);
      }

      const statusData = (await response.json()) as Record<string, unknown>;
      const processingStatus = statusData.processing_status as string;
      
      _logger.info(`[Poll #${pollCount}, ${elapsed}s] Batch status: ${processingStatus}`);
      _logger.info(`[Poll #${pollCount}] Full status data:`, {
        processing_status: processingStatus,
        has_questions: !!statusData.questions,
        has_error: !!statusData.error,
        keys: Object.keys(statusData),
      });

      // Check if batch is complete
      if (processingStatus === 'ended' || processingStatus === 'completed') {
        _logger.info(`✓ Batch processing completed after ${elapsed}s (${pollCount} polls)`);
        return statusData;
      }

      // Check for error states
      if (
        processingStatus === 'expired' ||
        processingStatus === 'cancelled' ||
        processingStatus === 'failed'
      ) {
        _logger.info(`✗ Batch processing failed with status: ${processingStatus}`);
        throw new Error(`Batch processing failed: ${processingStatus}`);
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitTime * 1000) {
        _logger.info(`✗ Batch polling timeout after ${maxWaitTime}s`);
        throw new Error(
          `Batch processing timeout: exceeded ${maxWaitTime}s wait time`
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
    } catch (error) {
      // If it's a timeout or failure error, rethrow
      if (error instanceof Error && error.message.includes('timeout')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('failed')) {
        throw error;
      }
      // For other errors, log and retry
      _logger.info(`⚠ Error polling batch status (will retry): ${error}`);
      await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
    }
  }
}

// Call the cloud_prepper_api batch endpoint to generate questions
async function generateBatchQuestions(
  params: QuestionBatchGenerationInput
): Promise<GeneratedQuestion[]> {
  const baseUrl = process.env.CLOUDPREPPER_BASE_URL || 'http://localhost:36236';
  const endpoint = process.env.CLOUDPREPPER_GENERATE_BATCH || '/api/questions/generateBatch';
  const apiToken = process.env.CLOUDPREPPER_API_TOKEN;
  const apiUrl = `${baseUrl}${endpoint}`;
  const pollInterval = parseInt(process.env.CLOUDPREPPER_POLL_INTERVAL || '30', 10);
  const maxWaitTime = parseInt(process.env.CLOUDPREPPER_MAX_WAIT_TIME || '3600', 10);

  if (!apiToken) {
    _logger.info('✗ CLOUDPREPPER_API_TOKEN is not set in environment variables');
    throw new Error(
      'CLOUDPREPPER_API_TOKEN is not set in environment variables'
    );
  }

  // Normalize cognitive_level and skill_level to arrays for backend
  const cognitiveLevels = Array.isArray(params.cognitive_level)
    ? params.cognitive_level
    : params.cognitive_level
    ? [params.cognitive_level]
    : undefined;
  const skillLevels = Array.isArray(params.skill_level)
    ? params.skill_level
    : params.skill_level
    ? [params.skill_level]
    : undefined;

  _logger.info(`Calling batch API: ${apiUrl}`);
  _logger.info('Request payload:', {
    certification_type: params.certification_type,
    domain_name: params.domain_name,
    cognitive_levels: cognitiveLevels,
    skill_levels: skillLevels,
    count: params.count,
    scenario_context: params.scenario_context ? 'provided' : 'not provided',
  });

  try {
    const startTime = Date.now();
    
    // Step 1: Submit batch request
    _logger.info('\n--- Submitting Batch Request ---');
    _logger.info('Submitting batch request to API...');
    _logger.info(`  URL: ${apiUrl}`);
    _logger.info(`  Base URL: ${baseUrl}`);
    _logger.info(`  Endpoint: ${endpoint}`);
    _logger.info(`  Timeout: 30 seconds`);
    _logger.info(`  Poll interval: ${pollInterval}s`);
    _logger.info(`  Max wait time: ${maxWaitTime}s`);
    
    // Add timeout to fetch request (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    let response: Response;
    try {
      const requestBody = {
        certification_type: params.certification_type,
        domain_name: params.domain_name,
        cognitive_levels: cognitiveLevels,
        skill_levels: skillLevels,
        count: params.count,
        scenario_context: params.scenario_context,
      };
      _logger.info('Request body:', JSON.stringify(requestBody, null, 2));
      _logger.info('Sending POST request...');
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        _logger.info('✗ Fetch request timed out after 30 seconds');
        throw new Error('API request timed out: The backend server did not respond within 30 seconds. Please check if the API server is running at ' + apiUrl);
      }
      throw fetchError;
    }

    const submitTime = ((Date.now() - startTime) / 1000).toFixed(2);
    _logger.info(`Batch submission response received (${submitTime}s): status ${response.status}`);

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const errorMsg = (errorData.error as string) || response.statusText;
      _logger.info(`✗ Batch API request failed: ${response.status} - ${errorMsg}`);
      throw new Error(
        `Batch API request failed with status ${response.status}: ${errorMsg}`
      );
    }

    const submitData = (await response.json()) as Record<string, unknown>;
    _logger.info('Batch submission response parsed successfully');
    _logger.info('Response data structure:', {
      has_batch_id: !!submitData.batch_id,
      batch_id: submitData.batch_id,
      has_questions: !!submitData.questions,
      questions_is_array: Array.isArray(submitData.questions),
      questions_count: Array.isArray(submitData.questions) ? submitData.questions.length : 'N/A',
      has_success: !!submitData.success,
      success_value: submitData.success,
      has_status: !!submitData.status,
      status_value: submitData.status,
      all_keys: Object.keys(submitData),
    });

    // Check if we got a batch_id (async processing) or questions directly (sync processing)
    const batchId = submitData.batch_id as string | undefined;
    const questions = submitData.questions as Array<Record<string, unknown>> | undefined;
    const status = submitData.status as string | undefined;

    // If we have questions directly, return them (backend handled polling internally)
    if (questions && Array.isArray(questions) && questions.length > 0) {
      _logger.info(`✓ Backend returned ${questions.length} question(s) directly (synchronous)`);
      _logger.info('Processing synchronous response (no polling needed)');
      const mappedQuestions = mapQuestionsToGenerated(questions, params);
      _logger.info(`✓ Mapped ${mappedQuestions.length} question(s) to GeneratedQuestion format`);
      return mappedQuestions;
    }

    // If we have a batch_id, check status first before polling
    if (batchId) {
      _logger.info(`✓ Batch submitted successfully, batch_id: ${batchId}`);
      
      // Check if status indicates completion (backend might process synchronously)
      if (status === 'completed' || status === 'ended' || status === 'success') {
        _logger.info(`✓ Batch status indicates completion: ${status}`);
        _logger.info('Attempting to retrieve results directly...');
        
        // Try to get results directly
        try {
          const resultsEndpoint = `${baseUrl}/api/questions/batch/${batchId}/results`;
          _logger.info(`Trying results endpoint: ${resultsEndpoint}`);
          const resultsResponse = await fetch(resultsEndpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiToken}`,
            },
          });
          
          if (resultsResponse.ok) {
            const resultsData = (await resultsResponse.json()) as Record<string, unknown>;
            if (Array.isArray(resultsData.questions) && resultsData.questions.length > 0) {
              _logger.info(`✓ Retrieved ${resultsData.questions.length} question(s) from results endpoint`);
              return mapQuestionsToGenerated(
                resultsData.questions as Array<Record<string, unknown>>,
                params
              );
            }
          }
        } catch (error) {
          _logger.info(`⚠ Could not retrieve results directly, will try polling: ${error}`);
        }
      }
      
      _logger.info('Starting to poll for batch completion...');

      // Step 2: Poll for batch completion
      let statusData: Record<string, unknown>;
      try {
        statusData = await pollBatchStatus(baseUrl, batchId, apiToken, pollInterval, maxWaitTime);
      } catch (error) {
        // If polling fails with 404 or 500, the endpoint might not exist or be broken
        // Try alternative: check if backend processes synchronously and returns results later
        const errorMessage = error instanceof Error ? error.message : String(error);
        _logger.info(`Error caught from pollBatchStatus: ${errorMessage}`);
        // Check for any batch status endpoint errors (404, 500, or any error message indicating endpoint issues)
        if (errorMessage.includes('404') || errorMessage.includes('Not Found') || 
            errorMessage.includes('500') || errorMessage.includes('Failed to retrieve') ||
            errorMessage.includes('Batch status endpoint error') || errorMessage.includes('Batch status endpoint not found') ||
            errorMessage.includes('Batch status check failed')) {
          const errorType = errorMessage.includes('500') || errorMessage.includes('Failed to retrieve') ? '500' : '404';
          _logger.info(`⚠ Batch status endpoint error (${errorType}). Backend may process synchronously.`);
          _logger.info('Attempting to retrieve results directly without status polling...');
          
          // Wait a bit for processing, then try results endpoint
          _logger.info(`Waiting ${pollInterval}s for batch processing...`);
          await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
          
          const resultsEndpoint = `${baseUrl}/api/questions/batch/${batchId}/results`;
          _logger.info(`Trying results endpoint: ${resultsEndpoint}`);
          const resultsResponse = await fetch(resultsEndpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiToken}`,
            },
          });
          
          if (resultsResponse.ok) {
            const resultsData = (await resultsResponse.json()) as Record<string, unknown>;
            if (Array.isArray(resultsData.questions) && resultsData.questions.length > 0) {
              _logger.info(`✓ Retrieved ${resultsData.questions.length} question(s) from results endpoint`);
              return mapQuestionsToGenerated(
                resultsData.questions as Array<Record<string, unknown>>,
                params
              );
            }
          }
          
          // Try alternative endpoint paths (including the correct backend paths)
          _logger.info('Trying alternative endpoint paths...');
          const alternativePaths = [
            `/api/questions/batch/${batchId}/status`,  // Correct backend path
            `/api/questions/batch/${batchId}/results`, // Correct backend path
            `/api/batch/${batchId}/status`,
            `/api/batch/${batchId}/results`,
            `/api/questions/batch/${batchId}`,
            `/api/batch/${batchId}`,
          ];
          
          for (const altPath of alternativePaths) {
            try {
              const altEndpoint = `${baseUrl}${altPath}`;
              _logger.info(`Trying alternative endpoint: ${altEndpoint}`);
              const altResponse = await fetch(altEndpoint, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiToken}`,
                },
              });
              const altStatus = altResponse.status;
              const altStatusText = altResponse.statusText;
              _logger.info(`Alternative endpoint ${altPath} response: status ${altStatus} ${altStatusText}`);
              
              if (altResponse.ok) {
                const altData = (await altResponse.json()) as Record<string, unknown>;
                if (Array.isArray(altData.questions) && altData.questions.length > 0) {
                  _logger.info(`✓ Retrieved ${altData.questions.length} question(s) from alternative endpoint: ${altPath}`);
                  return mapQuestionsToGenerated(
                    altData.questions as Array<Record<string, unknown>>,
                    params
                  );
                }
                // Check if it's a status endpoint with questions
                if (altData.processing_status === 'completed' || altData.processing_status === 'ended') {
                  if (Array.isArray(altData.questions) && altData.questions.length > 0) {
                    _logger.info(`✓ Retrieved ${altData.questions.length} question(s) from status endpoint: ${altPath}`);
                    return mapQuestionsToGenerated(
                      altData.questions as Array<Record<string, unknown>>,
                      params
                    );
                  }
                }
              }
            } catch (altError) {
              _logger.info(`Alternative endpoint ${altPath} failed: ${altError}`);
              // Continue to next alternative
            }
          }
          
          // Last resort: try re-checking the submission endpoint with batch_id
          if (status === 'pending') {
            _logger.info('Status is "pending" - backend may process synchronously. Waiting and re-checking submission endpoint...');
            
            // Try multiple times with increasing wait intervals
            const maxRetries = 3;
            for (let retry = 1; retry <= maxRetries; retry++) {
              const waitTime = pollInterval * retry; // 30s, 60s, 90s
              _logger.info(`Waiting ${waitTime}s before retry ${retry}/${maxRetries}...`);
              await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
              
              try {
                // Try GET with batch_id query parameter
                const recheckUrl = `${apiUrl}?batch_id=${batchId}`;
                _logger.info(`Re-checking submission endpoint (GET): ${recheckUrl}`);
                let recheckResponse: Response | null = null;
                let recheckError: unknown = null;
                try {
                  recheckResponse = await fetch(recheckUrl, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${apiToken}`,
                    },
                  });
                  const getStatus = recheckResponse.status;
                  const getStatusText = recheckResponse.statusText;
                } catch (error) {
                  recheckError = error;
                  _logger.info(`Re-check attempt ${retry} failed: ${error}`);
                  if (retry < maxRetries) {
                    continue; // Try next retry
                  }
                }
                
                if (recheckResponse && !recheckResponse.ok && !recheckError) {
                  // Try POST with batch_id in body
                  _logger.info(`GET failed, trying POST with batch_id in body...`);
                  try {
                    recheckResponse = await fetch(apiUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiToken}`,
                      },
                      body: JSON.stringify({
                        batch_id: batchId,
                        action: 'get_results',
                      }),
                    });
                    const postStatus = recheckResponse.status;
                    const postStatusText = recheckResponse.statusText;
                  } catch (postError) {
                    // Ignore POST errors in re-check
                  }
                }
                
                if (recheckResponse && recheckResponse.ok) {
                  const recheckData = (await recheckResponse.json()) as Record<string, unknown>;
                  _logger.info('Re-check response structure:', {
                    has_questions: !!recheckData.questions,
                    questions_is_array: Array.isArray(recheckData.questions),
                    questions_count: Array.isArray(recheckData.questions) ? recheckData.questions.length : 'N/A',
                    status: recheckData.status,
                    all_keys: Object.keys(recheckData),
                  });
                  
                  if (Array.isArray(recheckData.questions) && recheckData.questions.length > 0) {
                    _logger.info(`✓ Retrieved ${recheckData.questions.length} question(s) from re-checked submission endpoint`);
                    return mapQuestionsToGenerated(
                      recheckData.questions as Array<Record<string, unknown>>,
                      params
                    );
                  }
                  
                  // Check if status changed to completed
                  const newStatus = recheckData.status as string;
                  if (newStatus === 'completed' || newStatus === 'ended' || newStatus === 'success') {
                    _logger.info(`Status changed to ${newStatus}, but no questions found. Continuing to wait...`);
                    continue;
                  }
                }
              } catch (recheckError) {
                _logger.info(`Re-check attempt ${retry} failed: ${recheckError}`);
                if (retry < maxRetries) {
                  continue; // Try next retry
                }
              }
            }
          }
          
          // If all else fails, fall back to using regular question generator in a loop
          _logger.info('\n--- Fallback: Using Regular Question Generator ---');
          _logger.info('Batch polling endpoints not available. Falling back to regular question generator...');
          _logger.info(`Will generate ${params.count} question(s) using multiple calls to /api/questions/generateQuestion`);
          
          const allQuestions: GeneratedQuestion[] = [];
          const questionsPerCall = 10; // Regular generator supports up to 10
          const numCalls = Math.ceil(params.count / questionsPerCall);
          
          for (let i = 0; i < numCalls; i++) {
            const remaining = params.count - allQuestions.length;
            const currentCount = Math.min(remaining, questionsPerCall);
            
            _logger.info(`\nFallback call ${i + 1}/${numCalls}: Generating ${currentCount} question(s)...`);
            
            try {
              // Use the regular question generator endpoint
              const regularEndpoint = `${baseUrl}/api/questions/generateQuestion`;
              const regularResponse = await fetch(regularEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiToken}`,
                },
                body: JSON.stringify({
                  certification_type: params.certification_type,
                  domain_name: params.domain_name,
                  cognitive_levels: cognitiveLevels,
                  skill_levels: skillLevels,
                  count: currentCount,
                  scenario_context: params.scenario_context,
                }),
              });
              
              if (!regularResponse.ok) {
                const errorData = (await regularResponse.json().catch(() => ({}))) as Record<string, unknown>;
                throw new Error(
                  `Regular generator failed: ${regularResponse.status} - ${(errorData.error as string) || regularResponse.statusText}`
                );
              }
              
              const regularData = (await regularResponse.json()) as Record<string, unknown>;
              if (regularData.success && Array.isArray(regularData.questions)) {
                const mappedQuestions = mapQuestionsToGenerated(
                  regularData.questions as Array<Record<string, unknown>>,
                  params
                );
                allQuestions.push(...mappedQuestions);
                _logger.info(`✓ Generated ${mappedQuestions.length} question(s) in fallback call ${i + 1}`);
              } else {
                throw new Error('Invalid response from regular question generator');
              }
            } catch (fallbackError) {
              _logger.info(`✗ Fallback call ${i + 1} failed: ${fallbackError}`);
              throw new Error(
                `Batch generation failed and fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
              );
            }
          }
          
          _logger.info(`✓ Fallback completed: Generated ${allQuestions.length} question(s) total`);
          return allQuestions;
        }
        throw error;
      }

      // Step 3: Retrieve results
      _logger.info('\n--- Retrieving Batch Results ---');
      _logger.info('Batch completed, retrieving results...');
      const resultsEndpoint = `${baseUrl}/api/questions/batch/${batchId}/results`;
      _logger.info(`Results endpoint: ${resultsEndpoint}`);
      const resultsStartTime = Date.now();
      const resultsResponse = await fetch(resultsEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
      });
      const resultsDuration = ((Date.now() - resultsStartTime) / 1000).toFixed(2);
      _logger.info(`Results response received (${resultsDuration}s): status ${resultsResponse.status}`);

      if (!resultsResponse.ok) {
        const errorData = (await resultsResponse.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        const errorMsg = (errorData.error as string) || resultsResponse.statusText;
        _logger.info(`✗ Failed to retrieve batch results: ${resultsResponse.status} - ${errorMsg}`);
        throw new Error(`Failed to retrieve batch results: ${errorMsg}`);
      }

      const resultsData = (await resultsResponse.json()) as Record<string, unknown>;
      _logger.info('Results data structure:', {
        has_success: !!resultsData.success,
        success_value: resultsData.success,
        has_questions: !!resultsData.questions,
        questions_is_array: Array.isArray(resultsData.questions),
        questions_count: Array.isArray(resultsData.questions) ? resultsData.questions.length : 'N/A',
        all_keys: Object.keys(resultsData),
      });
      
      if (!resultsData.success || !Array.isArray(resultsData.questions)) {
        _logger.info('✗ Invalid batch results structure:', {
          has_success: !!resultsData.success,
          success_value: resultsData.success,
          has_questions_array: Array.isArray(resultsData.questions),
          questions_type: typeof resultsData.questions,
        });
        throw new Error('Invalid batch results: expected success flag and questions array');
      }

      const questionsCount = (resultsData.questions as Array<unknown>).length;
      _logger.info(`✓ Retrieved ${questionsCount} question(s) from completed batch`);
      _logger.info(`Results metadata:`, {
        success: resultsData.success,
        questions_count: questionsCount,
        batch_id: resultsData.batch_id || 'not provided',
      });

      return mapQuestionsToGenerated(
        resultsData.questions as Array<Record<string, unknown>>,
        params
      );
    }

    // Fallback: try to parse as direct response (for backwards compatibility)
    if (submitData.success && Array.isArray(submitData.questions)) {
      _logger.info('✓ Backend returned questions in submission response');
      return mapQuestionsToGenerated(
        submitData.questions as Array<Record<string, unknown>>,
        params
      );
    }

    // No batch_id and no questions - error
    _logger.info('✗ Invalid API response: no batch_id and no questions', {
      has_batch_id: !!batchId,
      has_questions: !!questions,
      response_keys: Object.keys(submitData),
    });
    throw new Error(
      'Invalid batch API response: expected batch_id or questions array'
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    _logger.info(`✗ Failed to generate batch questions: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      _logger.info('Error stack:', error.stack);
    }
    
    // Provide more specific error messages for common issues
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      _logger.info(`\n⚠ Connection Error: Unable to connect to API server at ${apiUrl}`);
      _logger.info('  Possible causes:');
      _logger.info('  1. The backend API server is not running');
      _logger.info('  2. The API server is running on a different port');
      _logger.info('  3. Network connectivity issues');
      _logger.info(`\n  Check: Is the API server running at ${baseUrl}?`);
    }
    
    throw new Error(
      `Failed to generate batch questions from API: ${errorMessage}`
    );
  }
}

// Helper function to map API response to GeneratedQuestion type
function mapQuestionsToGenerated(
  questions: Array<Record<string, unknown>>,
  params: QuestionBatchGenerationInput
): GeneratedQuestion[] {
  _logger.info(`\n--- Mapping Questions to GeneratedQuestion Format ---`);
  _logger.info(`Input questions count: ${questions.length}`);
  // Normalize for fallback use
  const fallbackCognitiveLevel = Array.isArray(params.cognitive_level)
    ? params.cognitive_level[0]
    : params.cognitive_level;
  const fallbackSkillLevel = Array.isArray(params.skill_level)
    ? params.skill_level[0]
    : params.skill_level;

  _logger.info(`Mapping parameters:`, {
    provided_domain: params.domain_name,
    provided_cognitive_level: params.cognitive_level,
    provided_skill_level: params.skill_level,
  });
  
  const mappedQuestions = questions.map((q: Record<string, unknown>, index: number) => {
    const correctAnswers = q.correct_answers as number[];
    const multipleAnswers = correctAnswers.length > 1;
    const mapped = {
      question_text: q.question_text as string,
      options: q.options as string[],
      correct_answers: correctAnswers,
      multiple_answers: multipleAnswers ? "1" : "0",
      explanation: q.explanation as string,
      domain: (q.domain as string) || params.domain_name || 'General',
      category: (q.category as string) || (q.subdomain as string) || 'Certification Topic',
      cognitive_level:
        (q.cognitive_level as CognitiveLevel) ||
        fallbackCognitiveLevel ||
        CognitiveLevel.APPLICATION,
      skill_level:
        (q.skill_level as SkillLevel) ||
        fallbackSkillLevel ||
        SkillLevel.INTERMEDIATE,
      tags: (q.tags as string[]) || [],
      references: (q.references as string[]) || [],
    };
    
    if (index < 3) { // Log first 3 for debugging
      _logger.info(`Question ${index + 1} mapping:`, {
        has_question_text: !!mapped.question_text,
        question_text_length: mapped.question_text?.length,
        options_count: mapped.options?.length,
        correct_answers: mapped.correct_answers,
        domain: mapped.domain,
        cognitive_level: mapped.cognitive_level,
        skill_level: mapped.skill_level,
      });
    }
    
    return mapped;
  });

  _logger.info(`✓ Mapped ${mappedQuestions.length} question(s) to GeneratedQuestion format`);
  _logger.info(`Mapping summary:`, {
    total_mapped: mappedQuestions.length,
    domains: [...new Set(mappedQuestions.map(q => q.domain))],
    cognitive_levels: [...new Set(mappedQuestions.map(q => q.cognitive_level))],
    skill_levels: [...new Set(mappedQuestions.map(q => q.skill_level))],
  });
  return mappedQuestions;
}
