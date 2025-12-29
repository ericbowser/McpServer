import { z } from 'zod';
import {
  CertificationType,
  CoverageAnalysis,
  DomainCoverage,
} from '../types/index.js';
import { DOMAIN_WEIGHTS } from '../constants.js';

// Zod schema for input validation
export const CoverageCheckSchema = z.object({
  certification_type: z.nativeEnum(CertificationType),
  total_questions_target: z.number().min(50).default(200),
  current_question_counts: z.record(z.string(), z.number()).optional(),
});

export type CoverageCheckInput = z.infer<typeof CoverageCheckSchema>;

// Tool definition for MCP
export const domainCoverageTool = {
  name: 'cloudprepper_check_coverage',
  description: `Check domain coverage against official exam specifications.

This tool validates your question distribution matches exam requirements:
- Compares current counts against target weights
- Identifies underrepresented domains needing more questions
- Flags overrepresented domains that may skew practice
- Provides specific gap analysis for focused question generation

Use when you need to:
- Plan which domains need more questions
- Validate question bank balance before deployment
- Guide question generation priorities
- Ensure exam-aligned practice experience`,
  inputSchema: {
    type: 'object',
    properties: {
      certification_type: {
        type: 'string',
        enum: Object.values(CertificationType),
        description: 'Target certification (CV0-004 or SAA-C03)',
      },
      total_questions_target: {
        type: 'number',
        description: 'Target total number of questions (default: 200)',
        minimum: 50,
      },
      current_question_counts: {
        type: 'object',
        description:
          'Optional: Current question counts per domain {domain_name: count}. If not provided, will query database.',
        additionalProperties: { type: 'number' },
      },
    },
    required: ['certification_type'],
  },
};

// Handler function
export async function handleCoverageCheck(
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Validate input
  const validated = CoverageCheckSchema.parse(args);

  // Get current counts (from database or provided data)
  const currentCounts =
    validated.current_question_counts ||
    (await getCurrentQuestionCounts(validated.certification_type));

  // Perform coverage analysis
  const analysis = analyzeCoverage(
    validated.certification_type,
    validated.total_questions_target,
    currentCounts
  );

  // Format response with recommendations
  const response = formatCoverageResponse(analysis);

  return {
    content: [
      {
        type: 'text',
        text: response,
      },
    ],
  };
}

async function getCurrentQuestionCounts(
  certType: CertificationType
): Promise<Record<string, number>> {
  // In production, this would query the database
  // For now, return mock data
  
  // Mock data showing realistic distribution with gaps
  const mockCounts: Record<CertificationType, Record<string, number>> = {
    [CertificationType.CV0_004]: {
      'Cloud Architecture and Design': 35,
      'Security': 55,
      'Deployment': 42,
      'Operations and Support': 38,
      'Troubleshooting': 18, // Gap here
    },
    [CertificationType.SAA_C03]: {
      'Design Secure Architectures': 48,
      'Design Resilient Architectures': 40,
      'Design High-Performing Architectures': 45,
      'Design Cost-Optimized Architectures': 25, // Gap here
    },
  };

  return mockCounts[certType];
}

function analyzeCoverage(
  certType: CertificationType,
  targetTotal: number,
  currentCounts: Record<string, number>
): CoverageAnalysis {
  const domains = DOMAIN_WEIGHTS[certType];
  const domainCoverages: DomainCoverage[] = [];
  const gaps: string[] = [];
  const overrepresented: string[] = [];

  let totalCurrent = 0;

  for (const domain of domains) {
    const currentCount = currentCounts[domain.name] || 0;
    totalCurrent += currentCount;

    const targetCount = Math.round((domain.weight / 100) * targetTotal);
    const percentage = (currentCount / targetCount) * 100;

    let status: 'under' | 'on-target' | 'over';
    if (percentage < 80) {
      status = 'under';
      const needed = targetCount - currentCount;
      gaps.push(
        `${domain.name}: Need ${needed} more questions (${currentCount}/${targetCount})`
      );
    } else if (percentage > 120) {
      status = 'over';
      const excess = currentCount - targetCount;
      overrepresented.push(
        `${domain.name}: ${excess} questions over target (${currentCount}/${targetCount})`
      );
    } else {
      status = 'on-target';
    }

    domainCoverages.push({
      domain_name: domain.name,
      current_count: currentCount,
      target_count: targetCount,
      percentage: Math.round(percentage),
      status,
    });
  }

  const overallCoverage = (totalCurrent / targetTotal) * 100;

  return {
    certification_type: certType,
    total_questions: totalCurrent,
    target_questions: targetTotal,
    domains: domainCoverages,
    overall_coverage_percentage: Math.round(overallCoverage),
    gaps,
    overrepresented,
  };
}

function formatCoverageResponse(analysis: CoverageAnalysis): string {
  const lines: string[] = [];

  lines.push(`# Domain Coverage Analysis - ${analysis.certification_type}`);
  lines.push('');
  lines.push(
    `**Overall Progress:** ${analysis.total_questions}/${analysis.target_questions} questions (${analysis.overall_coverage_percentage}%)`
  );
  lines.push('');

  // Domain breakdown
  lines.push('## Domain Breakdown');
  lines.push('');

  for (const domain of analysis.domains) {
    const statusEmoji = {
      under: '🔴',
      'on-target': '🟢',
      over: '🟡',
    }[domain.status];

    lines.push(
      `${statusEmoji} **${domain.domain_name}** - ${domain.current_count}/${domain.target_count} (${domain.percentage}%)`
    );
  }

  lines.push('');

  // Gaps
  if (analysis.gaps.length > 0) {
    lines.push('## ⚠️ Gaps Needing Attention');
    lines.push('');
    for (const gap of analysis.gaps) {
      lines.push(`- ${gap}`);
    }
    lines.push('');
  }

  // Overrepresented
  if (analysis.overrepresented.length > 0) {
    lines.push('## 📊 Overrepresented Domains');
    lines.push('');
    for (const over of analysis.overrepresented) {
      lines.push(`- ${over}`);
    }
    lines.push('');
  }

  // Recommendations
  lines.push('## 💡 Recommendations');
  lines.push('');

  if (analysis.gaps.length > 0) {
    lines.push('**Priority:** Focus question generation on:');
    for (const domain of analysis.domains.filter((d) => d.status === 'under')) {
      lines.push(`- ${domain.domain_name} (${domain.target_count - domain.current_count} questions needed)`);
    }
  } else if (analysis.overall_coverage_percentage < 100) {
    lines.push('**Status:** All domains balanced, continue building toward target');
  } else {
    lines.push('**Status:** Target reached! Maintain balance as you add new questions');
  }

  return lines.join('\n');
}
