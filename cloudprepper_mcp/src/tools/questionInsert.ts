import { z } from 'zod';
import pool from '../database.js';
import {
  CertificationType,
  CognitiveLevel,
  SkillLevel,
  CloudPlusDomain,
} from '../types/index.js';

// Zod schema for input validation
export const QuestionInsertSchema = z.object({
  question: z.object({
    question_text: z.string(),
    options: z.array(z.string()),
    correct_answers: z.array(z.number()),
    explanation: z.string(),
    domain: z.nativeEnum(CloudPlusDomain),
    subdomain: z.string().optional(),
    cognitive_level: z.nativeEnum(CognitiveLevel),
    skill_level: z.nativeEnum(SkillLevel),
    tags: z.array(z.string()).optional(),
    references: z.array(z.string()).optional(),
  }),
  certification_type: z.nativeEnum(CertificationType),
  category: z.string().optional(),
});

export type QuestionInsertInput = z.infer<typeof QuestionInsertSchema>;

// Tool definition for MCP
export const questionInsertTool = {
  name: 'cloudprepper_insert_question',
  description: `Insert a generated question into the PostgreSQL database.

This tool saves generated questions to the prepper.comptia_cloud_plus_questions table.
It automatically handles:
- Sequential question_id and question_number using database sequences
- JSON formatting for options and correct_answers arrays
- Multiple answer support
- Full metadata including cognitive level, skill level, domain info

Use this after generating questions with cloudprepper_generate_question to persist them to the database.

IMPORTANT: Use the official CompTIA Cloud+ CV0-004 domains from the dropdown.`,
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'object',
        description: 'The generated question object',
        properties: {
          question_text: {
            type: 'string',
            description: 'The question text',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of answer options',
          },
          correct_answers: {
            type: 'array',
            items: { type: 'number' },
            description: 'Array of correct answer indices (0-based)',
          },
          explanation: {
            type: 'string',
            description: 'Detailed explanation of the answer',
          },
          domain: {
            type: 'string',
            enum: Object.values(CloudPlusDomain),
            description: 'Official CompTIA Cloud+ CV0-004 domain (REQUIRED)',
          },
          subdomain: {
            type: 'string',
            description: 'Subdomain name (optional)',
          },
          cognitive_level: {
            type: 'string',
            enum: Object.values(CognitiveLevel),
            description: "Bloom's Taxonomy cognitive level (REQUIRED)",
          },
          skill_level: {
            type: 'string',
            enum: Object.values(SkillLevel),
            description: 'Experience-based skill level (REQUIRED)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of tags (optional)',
          },
          references: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of reference materials (optional)',
          },
        },
        required: [
          'question_text',
          'options',
          'correct_answers',
          'explanation',
          'domain',
          'cognitive_level',
          'skill_level',
        ],
      },
      certification_type: {
        type: 'string',
        enum: Object.values(CertificationType),
        description: 'Certification type (CV0-004 or SAA-C03)',
      },
      category: {
        type: 'string',
        description: 'Question category (optional, defaults to domain)',
      },
    },
    required: ['question', 'certification_type'],
  },
};

// Handler function
export async function handleQuestionInsert(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Validate input
    const validated = QuestionInsertSchema.parse(args);
    const { question, certification_type, category } = validated;

    // Determine category if not provided
    const finalCategory = category || question.domain || 'General';

    // Prepare data for insertion
    const optionsJson = JSON.stringify(question.options);
    const multipleAnswers = question.correct_answers.length > 1;
    
    // Convert answer indices to text array of the actual answer text
    const correctAnswersArray = question.correct_answers.map(idx => question.options[idx]);
    
    // For single answer, get the text of the correct answer
    const correctAnswer = multipleAnswers ? null : question.options[question.correct_answers[0]];

    // Combine explanation with additional details if available
    const fullExplanation = question.explanation;
    const explanationDetails = {
      domain: question.domain,
      subdomain: question.subdomain,
      tags: question.tags || [],
      references: question.references || [],
    };

    // Insert query using sequences (no difficulty column)
    const insertQuery = `
      INSERT INTO prepper.comptia_cloud_plus_questions(
        question_id, 
        question_number, 
        category, 
        domain, 
        question_text, 
        options, 
        correct_answer, 
        explanation, 
        explanation_details, 
        multiple_answers, 
        correct_answers, 
        cognitive_level, 
        skill_level
      )
      VALUES (
        nextval('prepper.question_id_seq'), 
        nextval('prepper.question_number_seq'), 
        $1, 
        $2, 
        $3, 
        $4, 
        $5, 
        $6, 
        $7, 
        $8, 
        $9, 
        $10, 
        $11
      )
      RETURNING id, question_id, question_number;
    `;

    const values = [
      finalCategory,                          // $1 category
      question.domain,                        // $2 domain (now required, using enum)
      question.question_text,                 // $3 question_text
      optionsJson,                            // $4 options (JSONB)
      correctAnswer,                          // $5 correct_answer (text, nullable)
      fullExplanation,                        // $6 explanation
      JSON.stringify(explanationDetails),     // $7 explanation_details (JSONB)
      multipleAnswers,                        // $8 multiple_answers (bit)
      correctAnswersArray,                    // $9 correct_answers (text[])
      question.cognitive_level,               // $10 cognitive_level (enum)
      question.skill_level,                   // $11 skill_level (enum)
    ];

    // Execute insert
    console.error('\n=== Executing SQL INSERT ===');
    console.error('Query:', insertQuery);
    console.error('Values:', JSON.stringify(values, null, 2));
    
    const result = await pool.query(insertQuery, values);
    const inserted = result.rows[0];
    
    console.error(`✓ Inserted: id=${inserted.id}, question_id=${inserted.question_id}, question_number=${inserted.question_number}\n`);

    // Helper to safely escape SQL string values for display
    const sqlEscape = (str: string | null) => {
      if (str === null) return 'NULL';
      return `'${str.replace(/'/g, "''")}'`;
    };

    // Build readable SQL for output (properly escaped)
    const readableSQL = `INSERT INTO prepper.comptia_cloud_plus_questions(
  question_id, 
  question_number, 
  category, 
  domain, 
  question_text, 
  options, 
  correct_answer, 
  explanation, 
  explanation_details, 
  multiple_answers, 
  correct_answers, 
  cognitive_level, 
  skill_level
)
VALUES (
  nextval('prepper.question_id_seq'),
  nextval('prepper.question_number_seq'),
  ${sqlEscape(finalCategory)},
  ${sqlEscape(question.domain)},
  ${sqlEscape(question.question_text)},
  ${sqlEscape(optionsJson)}::jsonb,
  ${correctAnswer ? sqlEscape(correctAnswer) : 'NULL'},
  ${sqlEscape(fullExplanation)},
  ${sqlEscape(JSON.stringify(explanationDetails))}::jsonb,
  ${multipleAnswers},
  ARRAY[${correctAnswersArray.map(a => sqlEscape(a)).join(', ')}],
  ${sqlEscape(question.cognitive_level)},
  ${sqlEscape(question.skill_level)}
);
`;

    // Also create a concise version for display
    const conciseSQL = `INSERT INTO prepper.comptia_cloud_plus_questions(
  question_id, question_number, category, domain, 
  question_text, options, correct_answer, explanation, 
  explanation_details, multiple_answers, correct_answers, 
  cognitive_level, skill_level
)
VALUES (
  nextval('prepper.question_id_seq'),
  nextval('prepper.question_number_seq'),
  ${sqlEscape(finalCategory)},
  ${sqlEscape(question.domain)},
  ${sqlEscape(question.question_text.substring(0, 80) + (question.question_text.length > 80 ? '...' : ''))},
  '${optionsJson.substring(0, 80)}...'::jsonb,
  ${correctAnswer ? sqlEscape(correctAnswer.substring(0, 40) + '...') : 'NULL'},
  ${sqlEscape(fullExplanation.substring(0, 60) + '...')},
  '{...}'::jsonb,
  ${multipleAnswers},
  ARRAY[${correctAnswersArray.map(a => sqlEscape(a.substring(0, 30) + '...')).join(', ')}],
  ${sqlEscape(question.cognitive_level)},
  ${sqlEscape(question.skill_level)}
);
`;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: '✅ Question inserted successfully with standardized values',
              database_record: {
                id: inserted.id,
                question_id: inserted.question_id,
                question_number: inserted.question_number,
              },
              certification_type,
              category: finalCategory,
              standardized_values: {
                domain: question.domain,
                skill_level: question.skill_level,
                cognitive_level: question.cognitive_level,
              },
              sql_executed_preview: conciseSQL,
              sql_executed_full: readableSQL,
              metadata: {
                domain: question.domain,
                subdomain: question.subdomain,
                multiple_answers: multipleAnswers,
                options_count: question.options.length,
                correct_answers_count: question.correct_answers.length,
              },
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
              error: 'Failed to insert question',
              details: errorMessage,
              hint: 'Make sure to use the official values from the dropdowns: Domain (6 options), Cognitive Level (6 options), Skill Level (4 options)',
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
