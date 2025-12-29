import { CertificationType, DomainInfo, CloudPlusDomain } from './types/index.js';

// Current year for question generation context
export const CURRENT_YEAR = 2025;

// Quality thresholds
export const MIN_QUALITY_SCORE = 70;
export const MIN_COPYRIGHT_SAFETY_SCORE = 80;
export const MIN_SCENARIO_DEPTH_SCORE = 60;
export const MIN_DISTRACTOR_QUALITY_SCORE = 70;

// Exam domain weights based on official CompTIA Cloud+ CV0-004 specifications
export const DOMAIN_WEIGHTS: Record<CertificationType, DomainInfo[]> = {
  [CertificationType.CV0_004]: [
    {
      name: CloudPlusDomain.CLOUD_ARCHITECTURE_AND_DESIGN,
      weight: 23,
      subdomains: [
        'Cloud service models and delivery',
        'High availability and business continuity',
        'Cloud migration strategies',
        'Performance optimization',
        'Network architecture and components',
      ],
    },
    {
      name: CloudPlusDomain.CLOUD_DEPLOYMENT,
      weight: 19,
      subdomains: [
        'Infrastructure as Code',
        'Configuration management',
        'Container orchestration',
        'Cloud resource provisioning',
        'Migration and integration',
      ],
    },
    {
      name: CloudPlusDomain.CLOUD_SECURITY,
      weight: 19,
      subdomains: [
        'Identity and access management',
        'Data security and encryption',
        'Network security',
        'Compliance and governance',
        'Vulnerability management',
      ],
    },
    {
      name: CloudPlusDomain.CLOUD_OPERATIONS_AND_SUPPORT,
      weight: 17,
      subdomains: [
        'Monitoring and logging',
        'Backup and disaster recovery',
        'Cost optimization',
        'Performance tuning',
        'Automation and orchestration',
      ],
    },
    {
      name: CloudPlusDomain.TROUBLESHOOTING,
      weight: 12,
      subdomains: [
        'Network connectivity issues',
        'Performance degradation',
        'Security incidents',
        'Deployment failures',
        'Integration problems',
      ],
    },
    {
      name: CloudPlusDomain.DEVOPS_FUNDAMENTALS,
      weight: 10,
      subdomains: [
        'CI/CD pipelines',
        'Version control',
        'Infrastructure as Code principles',
        'Collaboration and communication',
        'Agile methodologies',
      ],
    },
  ],
  [CertificationType.SAA_C03]: [
    {
      name: 'Design Secure Architectures',
      weight: 30,
      subdomains: [
        'Secure access to AWS resources',
        'Secure application tiers',
        'Data security controls',
      ],
    },
    {
      name: 'Design Resilient Architectures',
      weight: 26,
      subdomains: [
        'Scalable and loosely coupled architectures',
        'Highly available architectures',
        'Fault-tolerant architectures',
      ],
    },
    {
      name: 'Design High-Performing Architectures',
      weight: 24,
      subdomains: [
        'Storage solutions',
        'Compute solutions',
        'Database solutions',
        'Network architectures',
      ],
    },
    {
      name: 'Design Cost-Optimized Architectures',
      weight: 20,
      subdomains: [
        'Cost-effective storage',
        'Cost-effective compute',
        'Cost-effective database solutions',
        'Cost-optimized network architectures',
      ],
    },
  ],
};

// Generic placeholder phrases to avoid in distractors
export const AVOID_PHRASES = [
  'outdated legacy method',
  'unsupported configuration',
  'deprecated approach',
  'non-existent service',
  'invalid option',
  'not a real',
  'fictional',
  'placeholder',
  'generic solution',
];

// Keywords indicating 2025 relevance
export const YEAR_2025_KEYWORDS = [
  'serverless',
  'container',
  'kubernetes',
  'terraform',
  'infrastructure as code',
  'gitops',
  'zero trust',
  'multi-cloud',
  'hybrid cloud',
  'ai/ml integration',
  'edge computing',
  'observability',
  'finops',
  'sustainability',
];
