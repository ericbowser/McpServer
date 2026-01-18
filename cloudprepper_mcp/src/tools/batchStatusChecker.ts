import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GeneratedQuestion, CognitiveLevel, SkillLevel, CertificationType } from '../types/index.js';
import { formatQuestionsAsSQL } from './questionGenerator.js';
// @ts-ignore - JavaScript logger module
import logger from '../../logs/cloudPrepperLog.js';

const _logger = logger();

// Get directory paths - save to questions directory relative to project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From dist/tools or src/tools, go up to project root, then into questions
const questionsDir = path.join(__dirname, '..', '..', 'questions');

// Zod schema for input validation
export const BatchStatusCheckSchema = z.object({
  batch_id: z.string().min(1, 'batch_id is required'),
  output_format: z.enum(['json', 'sql']).optional().default('json'),
  poll_interval: z.number().min(5).max(300).optional().default(30),
  max_wait_time: z.number().min(10).max(7200).optional().default(3600),
});

export type BatchStatusCheckInput = z.infer<typeof BatchStatusCheckSchema>;

// Tool definition for MCP
export const batchStatusCheckerTool = {
  name: 'cloudprepper_check_batch_status',
  description: `Check the status of a previously submitted batch job and retrieve results if complete.

This tool allows you to:
- Check the status of a batch job that was submitted earlier
- Poll for completion if the batch is still processing
- Retrieve and save results once the batch is complete
- Useful when the MCP server was restarted or a batch job was submitted but results weren't retrieved

The tool will:
1. Check the current status of the batch using the batch_id
2. If still processing, poll at the specified interval until complete
3. Once complete, retrieve the questions and save them to a file
4. Support both JSON and SQL output formats

Use when you need to:
- Recover results from a batch job submitted before a server restart
- Check on the progress of a long-running batch job
- Retrieve results that weren't saved previously
- Monitor batch job completion status`,
  inputSchema: {
    type: 'object',
    properties: {
      batch_id: {
        type: 'string',
        description: 'The batch_id from a previous batch submission',
      },
      output_format: {
        type: 'string',
        enum: ['json', 'sql'],
        description: 'Output format: "json" (default) or "sql" for SQL INSERT statements',
      },
      poll_interval: {
        type: 'number',
        description: 'Polling interval in seconds (5-300, default: 30)',
        minimum: 5,
        maximum: 300,
      },
      max_wait_time: {
        type: 'number',
        description: 'Maximum time to wait for completion in seconds (10-7200, default: 3600)',
        minimum: 10,
        maximum: 7200,
      },
    },
    required: ['batch_id'],
  },
};

// Helper function to ensure questions directory exists
async function ensureQuestionsDirectory(): Promise<void> {
  try {
    await fs.mkdir(questionsDir, { recursive: true });
    _logger.info(`✓ Questions directory created/verified: ${questionsDir}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      _logger.info(`✗ Failed to create questions directory: ${error}`);
      throw error;
    }
    _logger.info(`✓ Questions directory already exists: ${questionsDir}`);
  }
}

// Helper function to generate filename
function generateFilename(batchId: string, count: number, format: 'json' | 'sql'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const sanitizedBatchId = batchId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  return `batch_${sanitizedBatchId}_${count}q_${timestamp}.${format}`;
}

// Poll batch status until completion (reused from questionBatchGenerator)
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

// Helper function to save results to file
async function saveResults(
  questions: GeneratedQuestion[],
  validated: BatchStatusCheckInput,
  resultsData: Record<string, unknown>
): Promise<{ file_path: string; filename: string; count: number }> {
  await ensureQuestionsDirectory();

  if (validated.output_format === 'sql') {
    // Generate SQL format
    _logger.info('Formatting questions as SQL INSERT statements...');
    // Try to extract certification_type from batch metadata if available, otherwise default to CV0-004
    const certificationType = (resultsData.metadata as Record<string, unknown>)?.certification_type as string;
    const certType = certificationType === 'SAA-C03' ? CertificationType.SAA_C03 : CertificationType.CV0_004;
    const sqlStatements = formatQuestionsAsSQL(questions, {
      certification_type: certType,
      domain_name: undefined, // Domain will be extracted from questions
    });
    const filename = generateFilename(validated.batch_id, questions.length, 'sql');
    const filePath = path.join(questionsDir, filename);
    
    await fs.writeFile(filePath, sqlStatements, 'utf8');
    const stats = await fs.stat(filePath);
    _logger.info(`✓ File saved successfully: ${filePath}`);
    _logger.info(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
    _logger.info(`  Questions: ${questions.length}`);
    
    return { file_path: filePath, filename, count: questions.length };
  } else {
    // Generate JSON format
    _logger.info('Formatting questions as JSON...');
    const jsonContent = JSON.stringify(
      {
        success: true,
        batch_id: validated.batch_id,
        count: questions.length,
        questions: questions,
        status: resultsData.processing_status || 'completed',
      },
      null,
      2
    );
    const filename = generateFilename(validated.batch_id, questions.length, 'json');
    const filePath = path.join(questionsDir, filename);
    
    await fs.writeFile(filePath, jsonContent, 'utf8');
    const stats = await fs.stat(filePath);
    _logger.info(`✓ File saved successfully: ${filePath}`);
    _logger.info(`  File size: ${(stats.size / 1024).toFixed(2)} KB`);
    _logger.info(`  Questions: ${questions.length}`);
    
    return { file_path: filePath, filename, count: questions.length };
  }
}

// Helper function to map API response to GeneratedQuestion type
function mapQuestionsToGenerated(
  questions: Array<Record<string, unknown>>
): GeneratedQuestion[] {
  _logger.info(`\n--- Mapping Questions to GeneratedQuestion Format ---`);
  _logger.info(`Input questions count: ${questions.length}`);
  
  const mappedQuestions = questions.map((q: Record<string, unknown>, index: number) => {
    // Map cognitive_level string to enum, defaulting to APPLICATION
    let cognitiveLevel = CognitiveLevel.APPLICATION;
    if (q.cognitive_level) {
      const cognitiveStr = String(q.cognitive_level);
      const cognitiveKey = Object.values(CognitiveLevel).find(v => v === cognitiveStr);
      if (cognitiveKey) {
        cognitiveLevel = cognitiveKey as CognitiveLevel;
      }
    }
    
    // Map skill_level string to enum, defaulting to INTERMEDIATE
    let skillLevel = SkillLevel.INTERMEDIATE;
    if (q.skill_level) {
      const skillStr = String(q.skill_level);
      const skillKey = Object.values(SkillLevel).find(v => v === skillStr);
      if (skillKey) {
        skillLevel = skillKey as SkillLevel;
      }
    }
    
    const correctAnswers = q.correct_answers as number[];
    const multipleAnswers = correctAnswers.length > 1;
    const mapped: GeneratedQuestion = {
      question_text: q.question_text as string,
      options: q.options as string[],
      correct_answers: correctAnswers,
      multiple_answers: multipleAnswers ? "1" : "0",
      explanation: q.explanation as string,
      domain: (q.domain as string) || 'General',
      category: (q.category as string) || (q.subdomain as string) || 'Certification Topic',
      cognitive_level: cognitiveLevel,
      skill_level: skillLevel,
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
      });
    }
    
    return mapped;
  });

  _logger.info(`✓ Mapped ${mappedQuestions.length} question(s) to GeneratedQuestion format`);
  return mappedQuestions;
}

// Handler function
export async function handleBatchStatusCheck(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  _logger.info('\n=== Starting Batch Status Check ===');
  _logger.info(`Timestamp: ${new Date().toISOString()}`);
  _logger.info(`Raw input args: ${JSON.stringify(args, null, 2)}`);
  
  // Validate input
  _logger.info('Validating input parameters...');
  const validated = BatchStatusCheckSchema.parse(args);
  _logger.info('✓ Input validation successful');
  _logger.info('Validated Parameters:', {
    batch_id: validated.batch_id,
    output_format: validated.output_format,
    poll_interval: validated.poll_interval,
    max_wait_time: validated.max_wait_time,
  });

  const baseUrl = process.env.CLOUDPREPPER_BASE_URL || 'http://localhost:36236';
  const apiToken = process.env.CLOUDPREPPER_API_TOKEN;

  if (!apiToken) {
    _logger.info('✗ CLOUDPREPPER_API_TOKEN is not set in environment variables');
    throw new Error(
      'CLOUDPREPPER_API_TOKEN is not set in environment variables'
    );
  }

  try {
    // Step 1: Check current status (with fallback if status endpoint fails)
    _logger.info(`\n--- Step 1: Checking Batch Status ---`);
    const statusEndpoint = `${baseUrl}/api/questions/batch/${validated.batch_id}/status`;
    _logger.info(`Checking status at: ${statusEndpoint}`);
    
    let statusData: Record<string, unknown> | null = null;
    let processingStatus: string | null = null;
    let statusCheckFailed = false;
    
    try {
      const statusResponse = await fetch(statusEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
      });

            if (!statusResponse.ok) {
              if (statusResponse.status === 404) {
                // #region agent log
                fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:430',message:'Batch not found (404)',data:{batch_id:validated.batch_id,status:statusResponse.status,statusText:statusResponse.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                throw new Error(`Batch not found: ${validated.batch_id}. The batch may not exist, may have expired, or the batch ID may be invalid in Anthropic's API.`);
              }
        if (statusResponse.status === 500) {
          _logger.info(`⚠ Status endpoint returned 500 - endpoint may be broken. Will try results endpoint directly.`);
          statusCheckFailed = true;
        } else {
          const errorData = (await statusResponse.json().catch(() => ({}))) as Record<string, unknown>;
          const errorMsg = (errorData.error as string) || statusResponse.statusText;
          throw new Error(`Failed to check batch status: ${statusResponse.status} - ${errorMsg}`);
        }
      } else {
        statusData = (await statusResponse.json()) as Record<string, unknown>;
        processingStatus = statusData.processing_status as string;
        _logger.info(`Current batch status: ${processingStatus}`);
      }
    } catch (statusError) {
      const errorMessage = statusError instanceof Error ? statusError.message : String(statusError);
      if (errorMessage.includes('500') || errorMessage.includes('Failed to retrieve')) {
        _logger.info(`⚠ Status endpoint error. Will try to retrieve results directly.`);
        statusCheckFailed = true;
      } else {
        throw statusError;
      }
    }

    // If status check failed or we got status, handle accordingly
    if (!statusCheckFailed && statusData && processingStatus) {
      // Check for error states first - don't try to retrieve results if batch failed
      if (processingStatus === 'error' || processingStatus === 'failed' || 
          processingStatus === 'expired' || processingStatus === 'cancelled') {
        const errorDetails = statusData.error as string | undefined;
        let errorMessage: string;
        if (processingStatus === 'expired') {
          errorMessage = `Batch ${validated.batch_id} has expired in Anthropic's API. Expired batches cannot be retrieved. ${errorDetails ? `Error details: ${errorDetails}` : ''}`;
        } else {
          errorMessage = errorDetails 
            ? `Batch processing failed with status: ${processingStatus}. Error: ${errorDetails}`
            : `Batch processing failed with status: ${processingStatus}`;
        }
        _logger.info(`✗ ${errorMessage}`);
        throw new Error(errorMessage);
      }
      
      // If already complete, proceed to retrieve results
      if (processingStatus === 'ended' || processingStatus === 'completed') {
        _logger.info(`✓ Batch is already complete`);
      } else if (processingStatus === 'pending' || processingStatus === 'processing') {
        _logger.info(`Batch is still ${processingStatus}, polling for completion...`);
        try {
          // Poll until complete
          statusData = await pollBatchStatus(
            baseUrl,
            validated.batch_id,
            apiToken,
            validated.poll_interval,
            validated.max_wait_time
          );
          processingStatus = statusData.processing_status as string;
          
          // Check again after polling - batch might have failed during polling
          if (processingStatus === 'error' || processingStatus === 'failed' || 
              processingStatus === 'expired' || processingStatus === 'cancelled') {
            const errorDetails = statusData.error as string | undefined;
            const errorMessage = errorDetails 
              ? `Batch processing failed with status: ${processingStatus}. Error: ${errorDetails}`
              : `Batch processing failed with status: ${processingStatus}`;
            _logger.info(`✗ ${errorMessage}`);
            throw new Error(errorMessage);
          }
        } catch (pollError) {
          const pollErrorMessage = pollError instanceof Error ? pollError.message : String(pollError);
          // If polling failed due to batch failure, rethrow
          if (pollErrorMessage.includes('failed') || pollErrorMessage.includes('error') || 
              pollErrorMessage.includes('expired') || pollErrorMessage.includes('cancelled')) {
            throw pollError;
          }
          _logger.info(`⚠ Polling failed: ${pollErrorMessage}. Will try results endpoint directly.`);
          statusCheckFailed = true;
        }
      }
    }

    // Step 2: Retrieve results (try multiple approaches if status check failed)
    _logger.info(`\n--- Step 2: Retrieving Batch Results ---`);
    
    // If status check failed, try alternative endpoints first
    if (statusCheckFailed) {
      _logger.info('Status endpoint unavailable, trying alternative endpoints...');
      const alternativePaths = [
        `/api/questions/batch/${validated.batch_id}/results`, // Correct backend path
        `/api/questions/batch/${validated.batch_id}`,
        `/api/batch/${validated.batch_id}/results`,
        `/api/batch/${validated.batch_id}`,
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
          
          if (altResponse.ok) {
            const altData = (await altResponse.json()) as Record<string, unknown>;
            // Check if it has questions directly
            if (Array.isArray(altData.questions) && altData.questions.length > 0) {
              _logger.info(`✓ Retrieved ${altData.questions.length} question(s) from alternative endpoint: ${altPath}`);
              const questions = mapQuestionsToGenerated(
                altData.questions as Array<Record<string, unknown>>
              );
              
              // Proceed to save results
              await saveResults(questions, validated, altData);
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: true,
                        message: 'Batch results retrieved and saved to file',
                        batch_id: validated.batch_id,
                        count: questions.length,
                        retrieved_from: 'alternative_endpoint',
                      },
                      null,
                      2
                    ),
                  },
                ],
              };
            }
            // Check if it's a status endpoint with completion status
            if (altData.processing_status === 'completed' || altData.processing_status === 'ended') {
              if (Array.isArray(altData.questions) && altData.questions.length > 0) {
                _logger.info(`✓ Retrieved ${altData.questions.length} question(s) from status endpoint: ${altPath}`);
                const questions = mapQuestionsToGenerated(
                  altData.questions as Array<Record<string, unknown>>
                );
                
                await saveResults(questions, validated, altData);
                return {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(
                        {
                          success: true,
                          message: 'Batch results retrieved and saved to file',
                          batch_id: validated.batch_id,
                          count: questions.length,
                          retrieved_from: 'status_endpoint',
                        },
                        null,
                        2
                      ),
                    },
                  ],
                };
              }
            }
          }
        } catch (altError) {
          _logger.info(`Alternative endpoint ${altPath} failed: ${altError}`);
          // Continue to next alternative
        }
      }
    }
    
    // Try the standard results endpoint
    const resultsEndpoint = `${baseUrl}/api/questions/batch/${validated.batch_id}/results`;
    _logger.info(`Results endpoint: ${resultsEndpoint}`);
    
    const resultsResponse = await fetch(resultsEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!resultsResponse.ok) {
      const errorData = (await resultsResponse.json().catch(() => ({}))) as Record<string, unknown>;
      const errorMsg = (errorData.error as string) || resultsResponse.statusText;
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:550',message:'Results endpoint error',data:{batch_id:validated.batch_id,status:resultsResponse.status,statusText:resultsResponse.statusText,errorMsg,processingStatus,statusCheckFailed,errorData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Handle 404 - batch not found (may be invalid/expired)
      if (resultsResponse.status === 404) {
        throw new Error(`Batch not found: ${validated.batch_id}. The batch may not exist, may have expired, or the batch ID may be invalid in Anthropic's API.`);
      }
      
      // Handle 400 errors that indicate batch failure
      if (resultsResponse.status === 400 && (errorMsg.includes('failed') || errorMsg.includes('error') || errorMsg.includes('Batch failed'))) {
        _logger.info(`✗ Results endpoint indicates batch failed: ${errorMsg}`);
        // Try to get status to provide more details
        let detailedError = `Batch processing failed. ${errorMsg}`;
        if (statusCheckFailed || !processingStatus) {
          try {
            const statusCheckResponse = await fetch(statusEndpoint, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiToken}`,
              },
            });
            if (statusCheckResponse.ok) {
              const statusCheckData = (await statusCheckResponse.json()) as Record<string, unknown>;
              const checkStatus = statusCheckData.processing_status as string;
              const checkError = statusCheckData.error as string | undefined;
              if (checkError) {
                detailedError = `Batch processing failed. Status: ${checkStatus}. Error: ${checkError}`;
              } else {
                detailedError = `Batch processing failed. Status: ${checkStatus}. ${errorMsg}`;
              }
            }
          } catch (statusCheckError) {
            // Use the error message from results endpoint
          }
        } else if (processingStatus) {
          detailedError = `Batch processing failed. Status: ${processingStatus}. ${errorMsg}`;
        }
        throw new Error(detailedError);
      }
      
      // If we have a status from earlier, include it in the error message
      if (processingStatus && (processingStatus === 'error' || processingStatus === 'failed')) {
        throw new Error(`Batch processing failed. Status: ${processingStatus}. ${errorMsg}`);
      }
      
      // If 404 and message indicates batch not completed, check if we can get status info
      if (resultsResponse.status === 404 && errorMsg.includes('not completed')) {
        // Try to get status one more time to provide better error message
        if (statusCheckFailed || !processingStatus) {
          try {
            const statusCheckResponse = await fetch(statusEndpoint, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiToken}`,
              },
            });
            if (statusCheckResponse.ok) {
              const statusCheckData = (await statusCheckResponse.json()) as Record<string, unknown>;
              const checkStatus = statusCheckData.processing_status as string;
              const checkError = statusCheckData.error as string | undefined;
              if (checkStatus === 'error' || checkStatus === 'failed') {
                const detailedError = checkError 
                  ? `Batch processing failed. Status: ${checkStatus}. Error: ${checkError}`
                  : `Batch processing failed. Status: ${checkStatus}`;
                throw new Error(detailedError);
              }
            }
          } catch (statusCheckError) {
            // If status check also fails, use the original error message
          }
        }
        throw new Error(`Batch is not completed. Current status: ${processingStatus || 'unknown'}. ${errorMsg}`);
      }
      
      throw new Error(`Failed to retrieve batch results: ${resultsResponse.status} - ${errorMsg}`);
    }

    const resultsData = (await resultsResponse.json()) as Record<string, unknown>;
    _logger.info('Results data structure:', {
      has_success: !!resultsData.success,
      success_value: resultsData.success,
      has_questions: !!resultsData.questions,
      questions_is_array: Array.isArray(resultsData.questions),
      questions_count: Array.isArray(resultsData.questions) ? resultsData.questions.length : 'N/A',
      has_error: !!resultsData.error,
      error_value: resultsData.error,
      has_status: !!resultsData.status,
      status_value: resultsData.status,
      has_error_message: !!resultsData.error_message,
      error_message_value: resultsData.error_message,
      all_keys: Object.keys(resultsData),
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:625',message:'Results data parsed',data:{batch_id:validated.batch_id,success:resultsData.success,has_questions:!!resultsData.questions,questions_count:Array.isArray(resultsData.questions)?resultsData.questions.length:0,error:resultsData.error,status:resultsData.status,error_message:resultsData.error_message,all_keys:Object.keys(resultsData),processingStatus,statusCheckFailed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Check if results indicate failure (even if HTTP status is 200)
    // If success is explicitly false, or if success is not true and there's an error, or if success is missing/undefined
    const isSuccess = resultsData.success === true;
    const hasError = !!resultsData.error;
    const successIsFalse = resultsData.success === false;
    
    if (!isSuccess || successIsFalse || hasError) {
      const errorMsg = (resultsData.error as string) || (resultsData.error_message as string) || (successIsFalse ? 'Batch processing failed' : 'Batch results indicate failure');
      _logger.info(`✗ Results indicate batch failed. success: ${resultsData.success}, error: ${errorMsg}`);
      
      // Try to get status to provide more details
      // First check if results data already has status information
      const resultStatus = resultsData.status as string | undefined;
      const resultErrorMsg = (resultsData.error_message as string) || errorMsg;
      
      // Check if the error message suggests the batch ID is invalid or expired
      // "Empty status received from Anthropic API" typically indicates an expired batch
      const isEmptyStatusError = resultErrorMsg && typeof resultErrorMsg === 'string' && 
                                 resultErrorMsg.toLowerCase().includes('empty status received from anthropic api');
      const isExpired = errorMsg.toLowerCase().includes('expired') || 
                       (resultStatus && typeof resultStatus === 'string' && resultStatus.toLowerCase() === 'expired') ||
                       (processingStatus && processingStatus.toLowerCase() === 'expired') ||
                       isEmptyStatusError;
      const isInvalidBatchId = errorMsg.toLowerCase().includes('not found') || 
                               errorMsg.toLowerCase().includes('invalid') || 
                               errorMsg.toLowerCase().includes('expired') ||
                               errorMsg.toLowerCase().includes('does not exist') ||
                               isEmptyStatusError;
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:664',message:'Batch failure detected',data:{batch_id:validated.batch_id,errorMsg,resultStatus,resultErrorMsg,resultErrorMsgType:typeof resultErrorMsg,resultErrorMsgLower:typeof resultErrorMsg==='string'?resultErrorMsg.toLowerCase():'N/A',isEmptyStatusError,isExpired,isInvalidBatchId,processingStatus,statusCheckFailed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      let detailedError = errorMsg;
      
      // If batch is specifically expired, provide a more helpful message
      if (isExpired) {
        if (isEmptyStatusError) {
          detailedError = `Batch ${validated.batch_id} has expired in Anthropic's API. The batch returned an empty status, which typically indicates it has expired and can no longer be retrieved.`;
        } else {
          detailedError = `Batch ${validated.batch_id} has expired in Anthropic's API. Expired batches cannot be retrieved. ${errorMsg !== 'Batch processing failed' ? `Original error: ${errorMsg}` : ''}`;
        }
      } else if (isInvalidBatchId) {
        detailedError = `Batch ID ${validated.batch_id} appears to be invalid or expired. The batch may not exist in Anthropic's API, or it may have been deleted. Original error: ${errorMsg}`;
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:675',message:'Before status check',data:{batch_id:validated.batch_id,resultStatus,resultStatusTruthy:!!resultStatus,resultStatusNotUndefined:resultStatus!=='undefined',resultStatusTrimmedNotEmpty:typeof resultStatus==='string'&&resultStatus.trim()!=='',resultStatusNotLowerUndefined:typeof resultStatus==='string'&&resultStatus.toLowerCase()!=='undefined',willUseResultStatus:!!(resultStatus&&resultStatus!=='undefined'&&(typeof resultStatus!=='string'||(resultStatus.trim()!==''&&resultStatus.toLowerCase()!=='undefined')))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // If results data has status, use it (preferred - avoids extra API call)
        if (resultStatus && resultStatus !== 'undefined' && (typeof resultStatus !== 'string' || (resultStatus.trim() !== '' && resultStatus.toLowerCase() !== 'undefined'))) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:675',message:'Using resultStatus',data:{batch_id:validated.batch_id,resultStatus,resultErrorMsg,errorMsg},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        if (resultErrorMsg && resultErrorMsg !== errorMsg) {
          detailedError = `Batch processing failed. Status: ${resultStatus}. ${resultErrorMsg}`;
        } else {
          detailedError = `Batch processing failed. Status: ${resultStatus}`;
        }
      } else if (processingStatus && processingStatus !== 'undefined' && (typeof processingStatus !== 'string' || (processingStatus.trim() !== '' && processingStatus.toLowerCase() !== 'undefined'))) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:682',message:'Using processingStatus',data:{batch_id:validated.batch_id,processingStatus,errorMsg},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        // Use processing status if we have it
        detailedError = `Batch processing failed. Status: ${processingStatus}. ${errorMsg}`;
      } else if (statusCheckFailed || !processingStatus) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:687',message:'Trying status endpoint',data:{batch_id:validated.batch_id,statusCheckFailed,processingStatus,statusEndpoint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        // Try to get status from status endpoint if we don't have it
        try {
          const statusCheckResponse = await fetch(statusEndpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiToken}`,
            },
          });
          if (statusCheckResponse.ok) {
            const statusCheckData = (await statusCheckResponse.json()) as Record<string, unknown>;
            const checkStatus = statusCheckData.processing_status as string;
            const checkError = statusCheckData.error as string | undefined;
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:697',message:'Status endpoint response',data:{batch_id:validated.batch_id,checkStatus,checkError,statusCheckOk:statusCheckResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            if (checkError && checkStatus && checkStatus !== 'undefined' && (typeof checkStatus !== 'string' || (checkStatus.trim() !== '' && checkStatus.toLowerCase() !== 'undefined'))) {
              detailedError = `Batch processing failed. Status: ${checkStatus}. Error: ${checkError}`;
            } else if (checkStatus && checkStatus !== 'undefined' && (typeof checkStatus !== 'string' || (checkStatus.trim() !== '' && checkStatus.toLowerCase() !== 'undefined'))) {
              detailedError = `Batch processing failed. Status: ${checkStatus}. ${errorMsg}`;
            }
            // If status is undefined or invalid, just use the error message from results (already set)
          }
        } catch (statusCheckError) {
          // Use the error message from results endpoint - it's already set
        }
      }
      }
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/648683ab-1e3c-413b-9b90-4313a545543f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'batchStatusChecker.ts:710',message:'Final detailedError',data:{batch_id:validated.batch_id,detailedError,errorMsg,detailedErrorEqualsErrorMsg:detailedError===errorMsg},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // If detailedError is still just errorMsg, use it as-is (no duplication)
      throw new Error(detailedError);
    }
    
    if (!resultsData.success || !Array.isArray(resultsData.questions)) {
      throw new Error('Invalid batch results: expected success flag and questions array');
    }

    const questions = mapQuestionsToGenerated(
      resultsData.questions as Array<Record<string, unknown>>
    );
    _logger.info(`✓ Retrieved ${questions.length} question(s) from batch`);

    // Step 3: Format and save results
    _logger.info(`\n--- Step 3: Formatting and Saving Results ---`);
    const saved = await saveResults(questions, validated, resultsData);
    _logger.info('=== Batch Status Check Complete ===\n');
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Batch results retrieved and saved to file',
              batch_id: validated.batch_id,
              file_path: saved.file_path,
              filename: saved.filename,
              count: saved.count,
              status: processingStatus || 'completed',
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
    _logger.info(`✗ Failed to check batch status: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      _logger.info('Error stack:', error.stack);
    }
    throw new Error(`Failed to check batch status: ${errorMessage}`);
  }
}
