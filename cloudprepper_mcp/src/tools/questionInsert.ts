import { z } from "zod";
import pool from "../database.js";
import {
  CertificationType,
  CognitiveLevel,
  SkillLevel,
  CloudPlusDomain,
} from "../types/index.js";

// Zod schema for input validation
export const QuestionInsertSchema = z.object({
  question: z.object({
    question_text: z.string(),
    options: z.array(z.string()),
    correct_answers: z.array(z.number()),
    explanation: z.string(),
    domain: z.nativeEnum(CloudPlusDomain),
    category: z.string().optional(),
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
  name: "cloudprepper_insert_question",
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
    type: "object",
    properties: {
      question: {
        type: "object",
        description: "The generated question object",
        properties: {
          question_text: {
            type: "string",
            description: "The question text",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Array of answer options",
          },
          correct_answers: {
            type: "array",
            items: { type: "number" },
            description: "Array of correct answer indices (0-based)",
          },
          explanation: {
            type: "string",
            description: "Detailed explanation of the answer",
          },
          domain: {
            type: "string",
            enum: Object.values(CloudPlusDomain),
            description: "Official CompTIA Cloud+ CV0-004 domain (REQUIRED)",
          },
          category: {
            type: "string",
            description: "Category name (optional)",
          },
          cognitive_level: {
            type: "string",
            enum: Object.values(CognitiveLevel),
            description: "Bloom's Taxonomy cognitive level (REQUIRED)",
          },
          skill_level: {
            type: "string",
            enum: Object.values(SkillLevel),
            description: "Experience-based skill level (REQUIRED)",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Array of tags (optional)",
          },
          references: {
            type: "array",
            items: { type: "string" },
            description: "Array of reference materials (optional)",
          },
        },
        required: [
          "question_text",
          "options",
          "correct_answers",
          "explanation",
          "domain",
          "cognitive_level",
          "skill_level",
        ],
      },
      certification_type: {
        type: "string",
        enum: Object.values(CertificationType),
        description: "Certification type (CV0-004 or SAA-C03)",
      },
      category: {
        type: "string",
        description: "Question category (optional, defaults to domain)",
      },
    },
    required: ["question", "certification_type"],
  },
};

// Handler function
export async function handleQuestionInsert(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  console.error('\n=== Starting Question Insert ===');
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error(`Raw input args: ${JSON.stringify(args, null, 2)}`);
  
  try {
    // Validate input
    console.error('Validating input parameters...');
    const validated = QuestionInsertSchema.parse(args);
    console.error('✓ Input validation successful');
    const { question, certification_type, category } = validated;
    
    console.error('Validated parameters:', {
      certification_type,
      category: category || 'not provided',
      question_text_length: question.question_text?.length,
      options_count: question.options?.length,
      correct_answers: question.correct_answers,
      domain: question.domain,
      cognitive_level: question.cognitive_level,
      skill_level: question.skill_level,
      has_category: !!question.category,
      tags_count: question.tags?.length || 0,
      references_count: question.references?.length || 0,
    });

    // Determine category if not provided
    console.error('\n--- Step 1: Preparing Data ---');
    const finalCategory = category || question.domain || "General";
    console.error(`Final category: ${finalCategory}`);

    // Prepare data for insertion
    console.error('Preparing data for insertion...');
    const optionsJson = JSON.stringify(question.options);
    console.error(`Options JSON size: ${(optionsJson.length / 1024).toFixed(2)} KB`);
    const multipleAnswers = question.correct_answers.length > 1;
    console.error(`Multiple answers: ${multipleAnswers} (${question.correct_answers.length} correct answer(s))`);

    // Convert answer indices to text array of the actual answer text
    console.error('Mapping correct answer indices to answer text...');
    const correctAnswersArray = question.correct_answers.map(
      (idx) => question.options[idx]
    );
    console.error(`Correct answers text: ${correctAnswersArray.join(', ')}`);

    // For single answer, get the text of the correct answer
    const correctAnswer = multipleAnswers
      ? null
      : question.options[question.correct_answers[0]];
    console.error(`Single correct answer: ${correctAnswer || 'N/A (multiple answers)'}`);

    // Combine explanation with additional details if available
    console.error('Preparing explanation and metadata...');
    const fullExplanation = question.explanation;
    console.error(`Explanation length: ${fullExplanation.length} characters`);
    const explanationDetails = {
      domain: question.domain,
      category: question.category,
      tags: question.tags || [],
      references: question.references || [],
    };
    console.error('Explanation details:', {
      domain: explanationDetails.domain,
      category: explanationDetails.category || 'not provided',
      tags_count: explanationDetails.tags.length,
      references_count: explanationDetails.references.length,
    });

    // Insert query using sequences (no difficulty column)
    console.error('\n--- Step 2: Building SQL Query ---');
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
      finalCategory, // $1 category
      question.domain, // $2 domain (now required, using enum)
      question.question_text, // $3 question_text
      optionsJson, // $4 options (JSONB)
      correctAnswer, // $5 correct_answer (text, nullable)
      fullExplanation, // $6 explanation
      JSON.stringify(explanationDetails), // $7 explanation_details (JSONB)
      multipleAnswers ? "1" : "0", // $8 multiple_answers (bit)
      correctAnswersArray, // $9 correct_answers (text[])
      question.cognitive_level, // $10 cognitive_level (enum)
      question.skill_level, // $11 skill_level (enum)
    ];
    
    console.error('SQL query prepared');
    console.error('Parameter values:', {
      category: values[0],
      domain: values[1],
      question_text_length: values[2]?.length,
      options_json_length: values[3]?.length,
      correct_answer: values[4] || 'NULL',
      explanation_length: values[5]?.length,
      explanation_details_length: values[6]?.length,
      multiple_answers: values[7],
      correct_answers_count: values[8]?.length,
      cognitive_level: values[9],
      skill_level: values[10],
    });

    // Execute insert
    console.error("\n--- Step 3: Executing SQL INSERT ---");
    console.error("Query:", insertQuery);
    console.error("Values count:", values.length);
    console.error("Values preview:", JSON.stringify(values.map((v, i) => {
      if (typeof v === 'string' && v.length > 100) {
        return `[${i}]: ${v.substring(0, 100)}... (${v.length} chars)`;
      }
      return `[${i}]: ${v}`;
    }), null, 2));

    const insertStartTime = Date.now();
    console.error('Executing database query...');
    const result = await pool.query(insertQuery, values);
    const insertDuration = ((Date.now() - insertStartTime) / 1000).toFixed(2);
    const inserted = result.rows[0];

    console.error(`✓ Insert completed (took ${insertDuration}s)`);
    console.error(`Inserted record:`, {
      id: inserted.id,
      question_id: inserted.question_id,
      question_number: inserted.question_number,
    });
    console.error(`Rows affected: ${result.rowCount}`);

    // Helper to safely escape SQL string values for display
    const sqlEscape = (str: string | null) => {
      if (str === null) return "NULL";
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
  ${correctAnswer ? sqlEscape(correctAnswer) : "NULL"},
  ${sqlEscape(fullExplanation)},
  ${sqlEscape(JSON.stringify(explanationDetails))}::jsonb,
  ${multipleAnswers},
  ARRAY[${correctAnswersArray.map((a) => sqlEscape(a)).join(", ")}],
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
  ${sqlEscape(
      question.question_text.substring(0, 80) +
      (question.question_text.length > 80 ? "..." : "")
    )},
  '${optionsJson.substring(0, 80)}...'::jsonb,
  ${correctAnswer ? sqlEscape(correctAnswer.substring(0, 40) + "...") : "NULL"},
  ${sqlEscape(fullExplanation.substring(0, 60) + "...")},
  '{...}'::jsonb,
  ${multipleAnswers},
  ARRAY[${correctAnswersArray
        .map((a) => sqlEscape(a.substring(0, 30) + "..."))
        .join(", ")}],
  ${sqlEscape(question.cognitive_level)},
  ${sqlEscape(question.skill_level)}
);
`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              message:
                "✅ Question inserted successfully with standardized values",
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
                category: question.category,
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: "Failed to insert question",
              details: errorMessage,
              hint: "Make sure to use the official values from the dropdowns: Domain (6 options), Cognitive Level (6 options), Skill Level (4 options)",
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
