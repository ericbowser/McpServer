// Core certification types
export enum CertificationType {
  CV0_004 = 'CV0-004',
  SAA_C03 = 'SAA-C03',
}

// Official CompTIA Cloud+ (CV0-004) Domains (matching database exactly)
export enum CloudPlusDomain {
  CLOUD_ARCHITECTURE_AND_DESIGN = 'Cloud Architecture and Design',           // 23%
  CLOUD_SECURITY = 'Cloud Security',                                         // 19%
  DEVOPS_FUNDAMENTALS = 'DevOps Fundamentals',                               // 10%
  CLOUD_OPERATIONS_AND_SUPPORT = 'Cloud Operations and Support',             // 17%
  CLOUD_DEPLOYMENT = 'Cloud Deployment',                                     // 19%
  TROUBLESHOOTING = 'Troubleshooting',                                       // 12%
}

// Cognitive complexity levels (Bloom's Taxonomy - Original 6 Levels)
export enum CognitiveLevel {
  KNOWLEDGE = 'Knowledge',           // Recall facts and basic concepts
  COMPREHENSION = 'Comprehension',   // Explain ideas or concepts
  APPLICATION = 'Application',       // Use information in new situations
  ANALYSIS = 'Analysis',             // Draw connections among ideas
  SYNTHESIS = 'Synthesis',           // Justify a decision or course of action
  EVALUATION = 'Evaluation',         // Produce new or original work
}

// Experience-based skill levels
export enum SkillLevel {
  BEGINNER = 'Beginner',         // Entry-level understanding
  INTERMEDIATE = 'Intermediate', // Working knowledge
  ADVANCED = 'Advanced',         // Expert proficiency
  EXPERT = 'Expert',             // Master-level expertise
}

// Domain information structure
export interface DomainInfo {
  name: string;
  weight: number; // Percentage
  subdomains?: string[];
}

// Generated question structure
export interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_answers: number[]; // Array of indices (0-based)
  explanation: string;
  domain: CloudPlusDomain | string; // Allow CloudPlusDomain enum or string for flexibility
  subdomain?: string;
  cognitive_level: CognitiveLevel;
  skill_level: SkillLevel;
  tags: string[];
  references?: string[];
}

// Quality analysis result
export interface QualityAnalysis {
  overall_score: number; // 0-100
  copyright_risk: 'low' | 'medium' | 'high';
  scenario_depth: number; // 0-100
  distractor_quality: number; // 0-100
  explanation_completeness: number; // 0-100
  year_2025_relevance: number; // 0-100
  issues: string[];
  suggestions: string[];
}

// Coverage analysis result
export interface CoverageAnalysis {
  certification_type: CertificationType;
  total_questions: number;
  target_questions: number;
  domains: DomainCoverage[];
  overall_coverage_percentage: number;
  gaps: string[];
  overrepresented: string[];
}

export interface DomainCoverage {
  domain_name: string;
  current_count: number;
  target_count: number;
  percentage: number;
  status: 'under' | 'on-target' | 'over';
}
