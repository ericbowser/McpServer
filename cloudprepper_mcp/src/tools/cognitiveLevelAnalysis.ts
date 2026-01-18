import { z } from 'zod';
import pool from '../database.js';
import { CognitiveLevel } from '../types/index.js';

// Zod schema for input validation
export const CognitiveLevelAnalysisSchema = z.object({
  question_id: z.number().optional(),
  batch_size: z.number().min(1).max(100).default(10),
  analyze_only: z.boolean().default(true),
});

export type CognitiveLevelAnalysisInput = z.infer<typeof CognitiveLevelAnalysisSchema>;

// Tool definition for MCP
export const cognitiveLevelAnalysisTool = {
  name: 'cloudprepper_analyze_cognitive_level',
  description: `Analyze questions missing cognitive_level and suggest appropriate levels.

This tool helps ensure all questions have proper cognitive level classifications according to Bloom's Taxonomy.
It can:
- Find questions missing cognitive_level
- Analyze question text to suggest appropriate cognitive level
- Optionally update questions with suggested levels

Cognitive levels (Bloom's Taxonomy):
- KNOWLEDGE: Recall facts, terms, basic concepts
- COMPREHENSION: Explain ideas, concepts
- APPLICATION: Use information in new situations
- ANALYSIS: Draw connections, distinguish between parts
- SYNTHESIS: Justify decisions, judge the value
- EVALUATION: Design, construct, produce new work

Use this tool to:
1. Audit existing questions for missing cognitive_level
2. Get AI suggestions for appropriate cognitive levels
3. Batch update questions with suggested levels`,
  inputSchema: {
    type: 'object',
    properties: {
      question_id: {
        type: 'number',
        description: 'Specific question ID to analyze (optional, analyzes all if not provided)',
      },
      batch_size: {
        type: 'number',
        description: 'Number of questions to analyze at once (1-100, default: 10)',
        minimum: 1,
        maximum: 100,
      },
      analyze_only: {
        type: 'boolean',
        description: 'If true, only analyze and suggest. If false, also update database (default: true)',
      },
    },
  },
};

// Handler function
export async function handleCognitiveLevelAnalysis(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate input
    const validated = CognitiveLevelAnalysisSchema.parse(args);
    const { question_id, batch_size, analyze_only } = validated;

    // Build query to find questions missing cognitive_level
    let query: string;
    let params: any[];

    if (question_id) {
      query = `
        SELECT id, question_id, question_number, question_text, domain, skill_level, cognitive_level
        FROM prepper.comptia_cloud_plus_questions
        WHERE question_id = $1
      `;
      params = [question_id];
    } else {
      query = `
        SELECT id, question_id, question_number, question_text, domain, skill_level, cognitive_level
        FROM prepper.comptia_cloud_plus_questions
        WHERE cognitive_level IS NULL
        LIMIT $1
      `;
      params = [batch_size];
    }

    console.error('Querying for questions missing cognitive_level...');
    const result = await pool.query(query, params);
    const questions = result.rows;

    if (questions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: question_id
                  ? `Question ${question_id} already has cognitive_level set`
                  : 'No questions found missing cognitive_level',
                questions_analyzed: 0,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    console.error(`Found ${questions.length} questions to analyze`);

    // Analyze each question and suggest cognitive level
    const analyses = questions.map((q: any) => {
      const suggestedLevel = suggestCognitiveLevel(q.question_text, q.skill_level);
      return {
        id: q.id,
        question_id: q.question_id,
        question_number: q.question_number,
        question_text_preview: q.question_text.substring(0, 100) + '...',
        domain: q.domain,
        skill_level: q.skill_level,
        current_cognitive_level: q.cognitive_level,
        suggested_cognitive_level: suggestedLevel,
        reasoning: getCognitiveLevelReasoning(q.question_text, suggestedLevel),
      };
    });

    // If analyze_only is false, update the database
    let updated_count = 0;
    if (!analyze_only) {
      console.error('Updating questions with suggested cognitive levels...');
      
      for (const analysis of analyses) {
        const updateQuery = `
          UPDATE prepper.comptia_cloud_plus_questions
          SET cognitive_level = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `;
        await pool.query(updateQuery, [analysis.suggested_cognitive_level, analysis.id]);
        updated_count++;
      }
      
      console.error(`✓ Updated ${updated_count} questions`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: analyze_only
                ? 'Analysis complete - no changes made to database'
                : `Updated ${updated_count} questions with suggested cognitive levels`,
              questions_analyzed: questions.length,
              questions_updated: updated_count,
              analyses: analyses,
              next_steps: analyze_only
                ? 'Review suggestions, then run with analyze_only=false to update'
                : 'Cognitive levels updated successfully',
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
              error: 'Failed to analyze cognitive levels',
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

// Suggest cognitive level based on question text and skill level
function suggestCognitiveLevel(questionText: string, skillLevel: string): CognitiveLevel {
  const lowerText = questionText.toLowerCase();

  // Keywords that indicate different cognitive levels
  const keywords = {
    Knowledge: ['what is', 'define', 'list', 'name', 'identify', 'recall', 'which of the following'],
    Comprehension: ['explain', 'describe', 'summarize', 'interpret', 'compare', 'contrast'],
    Application: ['implement', 'configure', 'use', 'demonstrate', 'solve', 'modify', 'how would you'],
    Analysis: ['analyze', 'examine', 'investigate', 'diagnose', 'troubleshoot', 'determine why'],
    Synthesis: ['synthesize', 'combine', 'integrate', 'formulate', 'compile'],
    Evaluation: ['evaluate', 'assess', 'justify', 'recommend', 'which is best', 'most appropriate', 'design', 'develop', 'create', 'plan', 'construct', 'architect'],
  };

  // Check for keyword matches
  for (const [level, words] of Object.entries(keywords)) {
    if (words.some((word) => lowerText.includes(word))) {
      return level as CognitiveLevel;
    }
  }

  // Fallback based on skill level
  if (skillLevel === 'Beginner') {
    return CognitiveLevel.COMPREHENSION;
  } else if (skillLevel === 'Intermediate') {
    return CognitiveLevel.APPLICATION;
  } else {
    return CognitiveLevel.ANALYSIS;
  }
}

// Get reasoning for suggested cognitive level
function getCognitiveLevelReasoning(questionText: string, level: CognitiveLevel): string {
  const lowerText = questionText.toLowerCase();
  
  const reasoningMap: Record<CognitiveLevel, string> = {
    [CognitiveLevel.KNOWLEDGE]: 'Question asks for recall of facts or basic concepts',
    [CognitiveLevel.COMPREHENSION]: 'Question requires explanation or interpretation of concepts',
    [CognitiveLevel.APPLICATION]: 'Question requires applying knowledge to a scenario or problem',
    [CognitiveLevel.ANALYSIS]: 'Question requires analysis, investigation, or troubleshooting',
    [CognitiveLevel.SYNTHESIS]: 'Question requires synthesis, integration, or combining information',
    [CognitiveLevel.EVALUATION]: 'Question requires evaluation, assessment, or creating a solution',
  };

  return reasoningMap[level];
}
