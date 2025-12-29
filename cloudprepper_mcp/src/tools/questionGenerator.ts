import { z } from 'zod';
import {
  CertificationType,
  CognitiveLevel,
  SkillLevel,
  GeneratedQuestion,
  CloudPlusDomain,
} from '../types/index.js';
import { CURRENT_YEAR } from '../constants.js';

// Zod schema for input validation
export const QuestionGenerationSchema = z.object({
  certification_type: z.nativeEnum(CertificationType),
  domain_name: z.nativeEnum(CloudPlusDomain).optional(),
  cognitive_level: z.nativeEnum(CognitiveLevel).optional(),
  skill_level: z.nativeEnum(SkillLevel).optional(),
  count: z.number().min(1).max(10).default(1),
  scenario_context: z.string().optional(),
  output_format: z.enum(['json', 'sql']).optional().default('json'),
});

export type QuestionGenerationInput = z.infer<typeof QuestionGenerationSchema>;

// Tool definition for MCP
export const questionGeneratorTool = {
  name: 'cloudprepper_generate_question',
  description: `Generate copyright-safe, scenario-based certification exam questions.

This tool creates high-quality practice questions following these principles:
- Uses conceptual transformation (never copies existing questions)
- Focuses on real-world scenarios from ${CURRENT_YEAR}
- Targets appropriate cognitive and skill levels
- Provides comprehensive explanations with technical depth
- Ensures proper difficulty distribution

Output Formats:
- "json" (default): Returns structured JSON with question objects
- "sql": Returns ready-to-use SQL INSERT statements for prepper.comptia_cloud_plus_questions table

Use when you need to:
- Create new practice questions at scale
- Fill gaps in domain coverage
- Generate scenario-based questions for specific topics
- Produce questions at specific difficulty levels
- Get SQL INSERT statements for direct database insertion`,
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
        type: 'string',
        enum: Object.values(CognitiveLevel),
        description: "Bloom's taxonomy level (optional)",
      },
      skill_level: {
        type: 'string',
        enum: Object.values(SkillLevel),
        description: 'Target skill level (optional)',
      },
      count: {
        type: 'number',
        description: 'Number of questions to generate (1-10, default: 1)',
        minimum: 1,
        maximum: 10,
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

// Handler function
export async function handleQuestionGeneration(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Validate input
  const validated = QuestionGenerationSchema.parse(args);

  // Build generation prompt
  const prompt = buildGenerationPrompt(validated);

  // Generate questions (mock for now - will integrate Claude API later)
  const questions = await generateQuestions(prompt, validated.count);

  // Format response based on output_format
  if (validated.output_format === 'sql') {
    const sqlStatements = formatQuestionsAsSQL(questions, validated);
    return {
      content: [
        {
          type: 'text',
          text: sqlStatements,
        },
      ],
    };
  }

  // Default: JSON format
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            count: questions.length,
            questions: questions,
            metadata: {
              certification_type: validated.certification_type,
              domain_name: validated.domain_name,
              cognitive_level: validated.cognitive_level,
              skill_level: validated.skill_level,
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

function buildGenerationPrompt(params: QuestionGenerationInput): string {
  const { certification_type, domain_name, cognitive_level, skill_level, scenario_context } =
    params;

  let prompt = `You are an expert certification exam question writer for ${certification_type}.

CRITICAL REQUIREMENTS:
1. NEVER copy or paraphrase existing exam questions
2. Create original scenarios based on real-world ${CURRENT_YEAR} cloud architectures
3. Questions must test practical application, not memorization
4. Use current AWS/cloud services and best practices
5. Provide detailed explanations with technical reasoning

`;

  if (domain_name) {
    prompt += `DOMAIN FOCUS: ${domain_name}\n`;
  }

  if (cognitive_level) {
    prompt += `COGNITIVE LEVEL: ${cognitive_level} (Bloom's Taxonomy)\n`;
  }

  if (skill_level) {
    prompt += `SKILL LEVEL: ${skill_level}\n`;
  }

  if (scenario_context) {
    prompt += `SCENARIO CONTEXT: ${scenario_context}\n`;
  }

  prompt += `
QUESTION STRUCTURE:
1. Start with a realistic business scenario
2. Include relevant technical constraints
3. Present 4-5 plausible options (all within same domain)
4. Mark correct answer(s)
5. Provide comprehensive explanation with:
   - Why correct answer(s) are right
   - Why other options are wrong
   - Technical implementation details
   - Real-world considerations

AVOID:
- Generic placeholder distractors like "Outdated legacy method"
- Obviously wrong answers
- Options from completely different domains
- Surface-level explanations

Generate the question(s) now.`;

  return prompt;
}

// Mock generation for now - will replace with Claude API call
async function generateQuestions(
  prompt: string,
  count: number
): Promise<GeneratedQuestion[]> {
  // This is a placeholder that returns a sample question
  // In production, this would call the Claude API with the prompt
  const sampleQuestion: GeneratedQuestion = {
    question_text:
      'A company is migrating their on-premises application to AWS. The application requires consistent low-latency access to a PostgreSQL database with automatic failover capabilities. The database must be able to handle read-heavy workloads during business hours and requires encryption at rest. Which solution best meets these requirements?',
    options: [
      'Deploy Amazon RDS for PostgreSQL with Multi-AZ deployment, enable encryption at rest, and create read replicas in the same region',
      'Deploy Amazon Aurora PostgreSQL with a cluster configuration spanning multiple AZs, enable encryption at rest, and use Aurora Auto Scaling for read replicas',
      'Deploy PostgreSQL on EC2 instances with EBS volumes, configure synchronous replication using streaming replication, and enable EBS encryption',
      'Deploy Amazon Redshift with encryption enabled and configure distribution keys for optimal read performance',
    ],
    correct_answers: [1],
    explanation:
      'Aurora PostgreSQL with multi-AZ clustering (Option B) is the best choice because:\n\n' +
      '**Why B is correct:**\n' +
      '- Aurora automatically replicates data across 3 AZs with 6 copies\n' +
      '- Provides automatic failover in under 30 seconds\n' +
      '- Aurora Auto Scaling automatically adds/removes read replicas based on load\n' +
      '- Native encryption at rest using KMS\n' +
      '- Superior performance for read-heavy workloads with up to 15 read replicas\n\n' +
      '**Why other options are less suitable:**\n' +
      '- Option A: RDS Multi-AZ provides failover but limited to 5 read replicas and slower failover than Aurora\n' +
      '- Option C: Self-managed PostgreSQL requires manual configuration, monitoring, and failover orchestration, increasing operational overhead\n' +
      '- Option D: Redshift is a data warehouse solution optimized for OLAP workloads, not OLTP applications requiring low-latency access',
    domain: 'Design High-Performing Architectures',
    subdomain: 'Database solutions',
    cognitive_level: CognitiveLevel.APPLICATION,
    skill_level: SkillLevel.INTERMEDIATE,
    tags: ['aurora', 'postgresql', 'high-availability', 'read-replicas', 'multi-az'],
    references: [
      'AWS Aurora Documentation',
      'RDS Multi-AZ Deployments',
      'Database Migration Best Practices',
    ],
  };

  // Return array of sample questions (would be real generation in production)
  return Array(count).fill(sampleQuestion);
}

// Format questions as SQL INSERT statements
function formatQuestionsAsSQL(
  questions: GeneratedQuestion[],
  metadata: QuestionGenerationInput
): string {
  const sqlStatements: string[] = [];
  
  sqlStatements.push('-- Generated SQL INSERT statements for CloudPrepper questions');
  sqlStatements.push(`-- Certification: ${metadata.certification_type}`);
  if (metadata.domain_name) {
    sqlStatements.push(`-- Domain: ${metadata.domain_name}`);
  }
  sqlStatements.push(`-- Count: ${questions.length}`);
  sqlStatements.push('');

  for (const question of questions) {
    // Escape single quotes in text fields for SQL
    const escapeSQL = (text: string): string => {
      return text.replace(/'/g, "''");
    };

    const questionText = escapeSQL(question.question_text);
    const explanation = escapeSQL(question.explanation);
    const optionsJson = JSON.stringify(question.options).replace(/'/g, "''");
    const multipleAnswers = question.correct_answers.length > 1;
    
    // Convert answer indices to actual answer texts
    const correctAnswersArray = question.correct_answers.map(idx => question.options[idx]);
    const correctAnswer = multipleAnswers ? 'NULL' : `'${escapeSQL(question.options[question.correct_answers[0]])}'`;
    
    // Format correct_answers as PostgreSQL TEXT[] array
    const correctAnswersSQL = `ARRAY[${correctAnswersArray.map(a => `'${escapeSQL(a)}'`).join(', ')}]`;

    // Build explanation_details JSONB
    const explanationDetails = {
      domain: question.domain,
      subdomain: question.subdomain,
      tags: question.tags || [],
      references: question.references || [],
    };
    const explanationDetailsJson = JSON.stringify(explanationDetails).replace(/'/g, "''");

    // Determine category (use domain or default)
    const category = question.domain || 'General';

    const sql = `INSERT INTO prepper.comptia_cloud_plus_questions(
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
  '${escapeSQL(category)}',
  '${escapeSQL(question.domain || category)}',
  '${questionText}',
  '${optionsJson}'::jsonb,
  ${correctAnswer},
  '${explanation}',
  '${explanationDetailsJson}'::jsonb,
  ${multipleAnswers},
  ${correctAnswersSQL},
  '${question.cognitive_level}',
  '${question.skill_level}'
);`;

    sqlStatements.push(sql);
    sqlStatements.push('');
  }

  sqlStatements.push('-- End of generated SQL statements');
  
  return sqlStatements.join('\n');
}
