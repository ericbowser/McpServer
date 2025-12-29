import { z } from 'zod';
import { QualityAnalysis } from '../types/index.js';
import {
  MIN_QUALITY_SCORE,
  MIN_COPYRIGHT_SAFETY_SCORE,
  MIN_SCENARIO_DEPTH_SCORE,
  MIN_DISTRACTOR_QUALITY_SCORE,
  AVOID_PHRASES,
  YEAR_2025_KEYWORDS,
} from '../constants.js';

// Zod schema for input validation
export const QualityAnalysisSchema = z.object({
  question_text: z.string().min(50, 'Question text too short'),
  options: z.array(z.string()).min(2, 'At least 2 options required'),
  explanation: z.string().min(100, 'Explanation too short'),
  correct_answers: z.array(z.number()),
});

export type QualityAnalysisInput = z.infer<typeof QualityAnalysisSchema>;

// Tool definition for MCP
export const questionQualityTool = {
  name: 'cloudprepper_analyze_quality',
  description: `Analyze certification exam questions for quality, copyright safety, and educational value.

This tool evaluates questions against CloudPrepper's quality standards:
- Copyright risk assessment (checks for potential copying)
- Scenario depth (realistic business context vs simple recall)
- Distractor quality (plausible wrong answers vs generic placeholders)
- Explanation completeness (technical depth and implementation details)
- 2025 relevance (current technologies and best practices)

Use when you need to:
- Validate question quality before adding to database
- Identify improvement areas for existing questions
- Ensure consistency across question bank
- Flag potential copyright issues`,
  inputSchema: {
    type: 'object',
    properties: {
      question_text: {
        type: 'string',
        description: 'The question text to analyze',
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of answer options',
      },
      explanation: {
        type: 'string',
        description: 'The explanation text',
      },
      correct_answers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of correct answer indices (0-based)',
      },
    },
    required: ['question_text', 'options', 'explanation', 'correct_answers'],
  },
};

// Handler function
export async function handleQualityAnalysis(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Validate input
  const validated = QualityAnalysisSchema.parse(args);

  // Perform analysis
  const analysis = await analyzeQuestion(validated);

  // Format response
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            analysis: analysis,
            passed: analysis.overall_score >= MIN_QUALITY_SCORE,
            warnings: analysis.issues.filter((issue) => issue.includes('Warning')),
            errors: analysis.issues.filter((issue) => issue.includes('Error')),
          },
          null,
          2
        ),
      },
    ],
  };
}

async function analyzeQuestion(input: QualityAnalysisInput): Promise<QualityAnalysis> {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 1. Analyze copyright risk
  const copyrightRisk = analyzeCopyrightRisk(input, issues);

  // 2. Analyze scenario depth
  const scenarioDepth = analyzeScenarioDepth(input, issues, suggestions);

  // 3. Analyze distractor quality
  const distractorQuality = analyzeDistractorQuality(input, issues, suggestions);

  // 4. Analyze explanation completeness
  const explanationCompleteness = analyzeExplanationCompleteness(input, issues, suggestions);

  // 5. Analyze 2025 relevance
  const year2025Relevance = analyze2025Relevance(input, issues, suggestions);

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    copyrightRisk * 0.25 +
      scenarioDepth * 0.2 +
      distractorQuality * 0.2 +
      explanationCompleteness * 0.2 +
      year2025Relevance * 0.15
  );

  return {
    overall_score: overallScore,
    copyright_risk:
      copyrightRisk >= 80 ? 'low' : copyrightRisk >= 50 ? 'medium' : 'high',
    scenario_depth: scenarioDepth,
    distractor_quality: distractorQuality,
    explanation_completeness: explanationCompleteness,
    year_2025_relevance: year2025Relevance,
    issues,
    suggestions,
  };
}

function analyzeCopyrightRisk(input: QualityAnalysisInput, issues: string[]): number {
  let score = 100;

  // Check for exact phrase matching (would need a database of known questions in production)
  const questionLower = input.question_text.toLowerCase();
  
  // Check for overly generic phrasing that might indicate copying
  const genericPhrases = [
    'which of the following',
    'what is the best',
    'which service should',
  ];
  
  const genericCount = genericPhrases.filter((phrase) =>
    questionLower.includes(phrase)
  ).length;
  
  if (genericCount > 2) {
    score -= 20;
    issues.push('Warning: Multiple generic phrases detected - may indicate lack of originality');
  }

  // Check for scenario-based questions (more likely to be original)
  const hasScenario = questionLower.includes('company') || 
                      questionLower.includes('organization') ||
                      questionLower.includes('team') ||
                      questionLower.includes('application');
  
  if (!hasScenario) {
    score -= 15;
    issues.push('Warning: No clear scenario context - add business context for originality');
  }

  return Math.max(0, score);
}

function analyzeScenarioDepth(
  input: QualityAnalysisInput,
  issues: string[],
  suggestions: string[]
): number {
  let score = 50; // Base score

  const questionLower = input.question_text.toLowerCase();

  // Check for business context
  const businessKeywords = [
    'company',
    'organization',
    'business',
    'team',
    'department',
    'stakeholder',
  ];
  const hasBusinessContext = businessKeywords.some((kw) => questionLower.includes(kw));

  if (hasBusinessContext) {
    score += 20;
  } else {
    issues.push('Missing: Business context - add company/organization scenario');
    suggestions.push('Add business context like "A company is migrating..." or "An organization requires..."');
  }

  // Check for technical constraints
  const constraintKeywords = [
    'requires',
    'must',
    'needs to',
    'constraints',
    'limited',
    'budget',
    'compliance',
    'regulations',
  ];
  const constraintCount = constraintKeywords.filter((kw) => questionLower.includes(kw)).length;

  score += Math.min(20, constraintCount * 5);

  if (constraintCount === 0) {
    suggestions.push('Add technical or business constraints to increase realism');
  }

  // Check for specific metrics or requirements
  const hasMetrics =
    /\d+/.test(input.question_text) || // Contains numbers
    questionLower.includes('high availability') ||
    questionLower.includes('low latency') ||
    questionLower.includes('scalable');

  if (hasMetrics) {
    score += 10;
  }

  return Math.min(100, score);
}

function analyzeDistractorQuality(
  input: QualityAnalysisInput,
  issues: string[],
  suggestions: string[]
): number {
  let score = 100;
  const incorrectOptions = input.options.filter(
    (_, idx) => !input.correct_answers.includes(idx)
  );

  // Check for generic placeholder phrases
  for (const option of incorrectOptions) {
    const optionLower = option.toLowerCase();
    const foundPlaceholders = AVOID_PHRASES.filter((phrase) =>
      optionLower.includes(phrase)
    );

    if (foundPlaceholders.length > 0) {
      score -= 30;
      issues.push(
        `Error: Generic distractor detected - "${foundPlaceholders[0]}" - use specific technical alternatives`
      );
    }
  }

  // Check if all options are from the same technical domain
  const optionLengths = input.options.map((opt) => opt.length);
  const avgLength = optionLengths.reduce((a, b) => a + b, 0) / optionLengths.length;
  const lengthVariance = optionLengths.map((len) => Math.abs(len - avgLength));
  const maxVariance = Math.max(...lengthVariance);

  if (maxVariance > avgLength * 0.5) {
    score -= 10;
    suggestions.push('Option lengths vary significantly - ensure all distractors are equally plausible');
  }

  // Check for obviously wrong distractors
  const obviousWrongKeywords = ['wrong', 'incorrect', 'invalid', 'fake', 'fictional'];
  for (const option of incorrectOptions) {
    const optionLower = option.toLowerCase();
    if (obviousWrongKeywords.some((kw) => optionLower.includes(kw))) {
      score -= 20;
      issues.push('Error: Distractor contains obviously wrong keywords');
    }
  }

  return Math.max(0, score);
}

function analyzeExplanationCompleteness(
  input: QualityAnalysisInput,
  issues: string[],
  suggestions: string[]
): number {
  let score = 50; // Base score

  const explanation = input.explanation;
  const explanationLower = explanation.toLowerCase();

  // Check for structured explanation
  const hasWhyCorrect =
    explanationLower.includes('correct') ||
    explanationLower.includes('best') ||
    explanationLower.includes('why');

  if (hasWhyCorrect) {
    score += 15;
  } else {
    issues.push('Missing: Explanation should explicitly state why answer is correct');
  }

  // Check for alternative discussion
  const hasAlternatives =
    explanationLower.includes('other option') ||
    explanationLower.includes('alternative') ||
    explanationLower.includes('instead');

  if (hasAlternatives) {
    score += 15;
  } else {
    suggestions.push('Discuss why other options are incorrect or less suitable');
  }

  // Check for technical details
  const technicalKeywords = [
    'because',
    'provides',
    'enables',
    'supports',
    'allows',
    'implements',
  ];
  const technicalCount = technicalKeywords.filter((kw) =>
    explanationLower.includes(kw)
  ).length;

  score += Math.min(20, technicalCount * 4);

  // Check minimum length
  if (explanation.length < 200) {
    score -= 10;
    suggestions.push('Explanation is short - add more technical implementation details');
  }

  return Math.min(100, score);
}

function analyze2025Relevance(
  input: QualityAnalysisInput,
  issues: string[],
  suggestions: string[]
): number {
  let score = 60; // Base score

  const combinedText = (
    input.question_text +
    ' ' +
    input.options.join(' ') +
    ' ' +
    input.explanation
  ).toLowerCase();

  // Check for 2025-relevant keywords
  const relevantKeywords = YEAR_2025_KEYWORDS.filter((kw) =>
    combinedText.includes(kw)
  );

  score += Math.min(40, relevantKeywords.length * 8);

  if (relevantKeywords.length === 0) {
    suggestions.push(
      'Consider adding modern cloud concepts like serverless, containers, IaC, or observability'
    );
  }

  // Check for deprecated/outdated terms
  const outdatedTerms = ['ec2-classic', 'rds mysql 5.5', 'deprecated'];
  const hasOutdated = outdatedTerms.some((term) => combinedText.includes(term));

  if (hasOutdated) {
    score -= 20;
    issues.push('Warning: Question references potentially outdated technologies');
  }

  return Math.min(100, Math.max(0, score));
}
