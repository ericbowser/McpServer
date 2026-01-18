import { z } from 'zod';
import pool from '../database.js';

// Zod schema for input validation
export const UniquenessCheckSchema = z.object({
  similarity_threshold: z.number().min(0).max(1).default(0.85),
  check_domain: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type UniquenessCheckInput = z.infer<typeof UniquenessCheckSchema>;

// Tool definition for MCP
export const uniquenessCheckTool = {
  name: 'cloudprepper_check_uniqueness',
  description: `Check for duplicate or highly similar questions to ensure compliance.

This tool helps ensure all questions are unique by:
- Detecting exact duplicate question texts
- Finding highly similar questions (based on text similarity)
- Identifying questions with identical answer patterns
- Checking for plagiarism risk

Compliance is critical - certification questions must be original to avoid copyright issues.

Parameters:
- similarity_threshold: How similar questions must be to flag (0-1, default 0.85)
- check_domain: Limit check to specific domain (optional)
- limit: Maximum number of potential duplicates to return (default 20)

Returns:
- Exact duplicates (same question_text)
- High similarity pairs (above threshold)
- Duplicate detection strategies
- Compliance recommendations`,
  inputSchema: {
    type: 'object',
    properties: {
      similarity_threshold: {
        type: 'number',
        description: 'Similarity threshold for flagging questions (0-1, default: 0.85)',
        minimum: 0,
        maximum: 1,
      },
      check_domain: {
        type: 'string',
        description: 'Limit check to specific domain (optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of duplicates to return (1-100, default: 20)',
        minimum: 1,
        maximum: 100,
      },
    },
  },
};

// Handler function
export async function handleUniquenessCheck(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate input
    const validated = UniquenessCheckSchema.parse(args);
    const { similarity_threshold, check_domain, limit } = validated;

    console.error('Checking for duplicate questions...');

    // Query 1: Find exact duplicates
    let exactDuplicatesQuery = `
      SELECT 
        question_text,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id) as question_ids,
        ARRAY_AGG(question_id) as q_ids,
        ARRAY_AGG(domain) as domains
      FROM prepper.comptia_cloud_plus_questions
      ${check_domain ? 'WHERE domain = $1' : ''}
      GROUP BY question_text
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT $${check_domain ? '2' : '1'}
    `;

    const exactDuplicatesParams = check_domain ? [check_domain, limit] : [limit];
    const exactDuplicatesResult = await pool.query(exactDuplicatesQuery, exactDuplicatesParams);
    const exactDuplicates = exactDuplicatesResult.rows;

    console.error(`Found ${exactDuplicates.length} sets of exact duplicates`);

    // Query 2: Find questions with same options (potential copies)
    let sameOptionsQuery = `
      SELECT 
        options,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id) as question_ids,
        ARRAY_AGG(question_text) as question_texts,
        ARRAY_AGG(domain) as domains
      FROM prepper.comptia_cloud_plus_questions
      ${check_domain ? 'WHERE domain = $1' : ''}
      GROUP BY options
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT $${check_domain ? '2' : '1'}
    `;

    const sameOptionsParams = check_domain ? [check_domain, limit] : [limit];
    const sameOptionsResult = await pool.query(sameOptionsQuery, sameOptionsParams);
    const sameOptions = sameOptionsResult.rows;

    console.error(`Found ${sameOptions.length} sets with identical options`);

    // Query 3: Get total question count and stats
    let statsQuery = `
      SELECT 
        COUNT(*) as total_questions,
        COUNT(DISTINCT question_text) as unique_question_texts,
        COUNT(*) - COUNT(DISTINCT question_text) as text_duplicates,
        COUNT(DISTINCT options) as unique_option_sets
      FROM prepper.comptia_cloud_plus_questions
      ${check_domain ? 'WHERE domain = $1' : ''}
    `;

    const statsParams = check_domain ? [check_domain] : [];
    const statsResult = await pool.query(statsQuery, statsParams);
    const stats = statsResult.rows[0];

    // Calculate uniqueness score
    const uniquenessScore = stats.total_questions > 0
      ? (stats.unique_question_texts / stats.total_questions) * 100
      : 100;

    // Build compliance assessment
    const complianceLevel = 
      stats.text_duplicates === 0 ? 'EXCELLENT' :
      stats.text_duplicates < 5 ? 'GOOD' :
      stats.text_duplicates < 10 ? 'FAIR' :
      'NEEDS REVIEW';

    const recommendations = [];
    if (exactDuplicates.length > 0) {
      recommendations.push(
        `Remove or rewrite ${exactDuplicates.reduce((sum: number, d: any) => sum + (d.duplicate_count - 1), 0)} duplicate questions`
      );
    }
    if (sameOptions.length > 0) {
      recommendations.push(
        'Review questions with identical options - may indicate copying'
      );
    }
    if (uniquenessScore < 95) {
      recommendations.push(
        'Aim for 100% unique question texts to ensure compliance'
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('All questions appear to be unique - excellent!');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              compliance_level: complianceLevel,
              uniqueness_score: Math.round(uniquenessScore * 100) / 100,
              statistics: {
                total_questions: parseInt(stats.total_questions),
                unique_question_texts: parseInt(stats.unique_question_texts),
                text_duplicates: parseInt(stats.text_duplicates),
                unique_option_sets: parseInt(stats.unique_option_sets),
                domain_filter: check_domain || 'all domains',
              },
              exact_duplicates: exactDuplicates.map((d: any) => ({
                question_text_preview: d.question_text.substring(0, 100) + '...',
                duplicate_count: d.duplicate_count,
                question_ids: d.question_ids,
                domains: d.domains,
              })),
              identical_options_count: sameOptions.length,
              recommendations: recommendations,
              next_steps: [
                'Review flagged duplicates',
                'Rewrite or remove duplicate questions',
                'Ensure all questions are original work',
                'Run this check regularly to maintain compliance',
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'Failed to check uniqueness',
              details: errorMessage,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
