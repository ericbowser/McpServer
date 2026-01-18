-- Generated SQL INSERT statements for CloudPrepper questions
-- Certification: CV0-004
-- Domain: DevOps Fundamentals
-- Count: 2

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
  'DevOps Fundamentals',
  'DevOps Fundamentals',
  'A fintech company is implementing a zero-downtime deployment strategy for their microservices architecture running on Amazon EKS. Their trading platform handles 50,000+ transactions per minute and requires strict regulatory compliance with audit trails. The development team needs to deploy updates 15+ times daily while maintaining service availability and ensuring all deployments can be traced and rolled back within 30 seconds if anomalies are detected. The platform uses Istio service mesh and Prometheus for monitoring. Which deployment strategy combination best addresses these requirements?',
  '["Implement blue-green deployments with AWS CodeDeploy, using Application Load Balancer target group switching and AWS Config for compliance tracking","Use Istio traffic splitting with canary deployments, implementing Flagger for automated rollbacks based on Prometheus metrics and ArgoCD for GitOps audit trails","Deploy with rolling updates using Kubernetes native deployments, AWS X-Ray for tracing, and AWS CloudTrail for audit compliance","Implement feature flags with AWS AppConfig, using Lambda@Edge for traffic routing and Amazon CloudWatch for monitoring and rollback triggers"]'::jsonb,
  'Use Istio traffic splitting with canary deployments, implementing Flagger for automated rollbacks based on Prometheus metrics and ArgoCD for GitOps audit trails',
  'Option B is correct because it leverages the existing Istio service mesh for sophisticated traffic management and integrates seamlessly with the monitoring infrastructure. Istio''s traffic splitting enables precise canary deployments where traffic can be gradually shifted to new versions (e.g., 5%, 10%, 25%, 50%, 100%). Flagger automates the entire canary process by monitoring Prometheus metrics in real-time and can trigger rollbacks within seconds when anomalies are detected, meeting the 30-second requirement. ArgoCD provides GitOps-based deployment with complete audit trails for regulatory compliance, tracking every deployment change through Git commits. This combination handles 15+ daily deployments efficiently through automation while maintaining zero downtime. Option A uses blue-green deployments which, while providing zero downtime, requires maintaining two complete environments and ALB target group switching introduces latency that may not meet the 30-second rollback requirement. Option C''s rolling updates can cause temporary inconsistencies during high-frequency trading and lacks the sophisticated traffic management needed for instant rollbacks. Option D introduces unnecessary complexity with Lambda@Edge and doesn''t leverage the existing service mesh infrastructure, plus feature flags don''t address the core deployment strategy requirements for the microservices architecture.',
  '{"domain":"DevOps Fundamentals","subdomain":"Continuous Integration/Continuous Deployment","tags":["zero-downtime-deployment","canary-deployment","service-mesh","automated-rollback","regulatory-compliance"],"references":["Istio Traffic Management Documentation","Flagger Canary Deployment Guide","ArgoCD GitOps Best Practices"]}'::jsonb,
  0,
  ARRAY['Use Istio traffic splitting with canary deployments, implementing Flagger for automated rollbacks based on Prometheus metrics and ArgoCD for GitOps audit trails'],
  'Application',
  'Expert'
);

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
  'DevOps Fundamentals',
  'DevOps Fundamentals',
  'A healthcare SaaS company is restructuring their monolithic application into microservices using AWS. They need to implement infrastructure as code that supports multiple environments (dev, staging, prod) with different compliance requirements. The production environment must be HIPAA compliant with encrypted storage, VPC isolation, and detailed audit logging. Development environments need cost optimization with spot instances, while staging requires production-like performance testing capabilities with synthetic load generation. The infrastructure must support automatic scaling based on custom metrics and maintain consistency across environments while allowing environment-specific configurations. Which IaC approach best satisfies these multi-environment requirements?',
  '["Use AWS CloudFormation with nested stacks, separate templates per environment, AWS Systems Manager Parameter Store for environment variables, and CloudFormation StackSets for cross-region deployments","Implement Terraform with workspaces, environment-specific tfvars files, Terraform Cloud for state management, and use conditional logic within modules for environment-specific resources","Deploy with AWS CDK using multiple stacks with environment-specific constructs, AWS Secrets Manager for configuration, and CDK Pipelines for automated deployment across environments","Use Pulumi with stack-specific configurations, AWS Parameter Store integration, and Pulumi ESC for environment management with policy-based compliance enforcement"]'::jsonb,
  'Implement Terraform with workspaces, environment-specific tfvars files, Terraform Cloud for state management, and use conditional logic within modules for environment-specific resources',
  'Option B is correct because Terraform workspaces provide clean environment isolation while maintaining code consistency. The workspace pattern allows the same Terraform configuration to deploy different environments with environment-specific tfvars files controlling variables like instance types (spot for dev, on-demand for prod), encryption settings (required only for prod), and VPC configurations (isolated for prod, shared for dev). Conditional logic in modules enables HIPAA-specific resources (AWS Config rules, CloudTrail, KMS encryption) to be deployed only in production while cost optimization features (spot instances, smaller instance types) apply to development. Terraform Cloud provides secure state management with team collaboration features and audit trails required for healthcare compliance. The approach supports custom metrics-based auto-scaling through AWS Auto Scaling policies defined in the Terraform modules. Option A''s CloudFormation nested stacks become complex for multi-environment scenarios and lack the flexibility of Terraform''s workspace model. Parameter Store alone doesn''t provide the sophisticated environment management needed. Option C''s AWS CDK, while powerful, requires more complex construct inheritance patterns for environment differences and CDK Pipelines add unnecessary complexity for this use case. Option D''s Pulumi is capable but less mature in enterprise environments, and the policy-based compliance enforcement through Pulumi ESC is newer and less proven in healthcare compliance scenarios compared to Terraform''s established patterns.',
  '{"domain":"DevOps Fundamentals","subdomain":"Infrastructure as Code","tags":["infrastructure-as-code","multi-environment","terraform-workspaces","hipaa-compliance","environment-isolation"],"references":["Terraform Workspace Documentation","AWS HIPAA Compliance Guide","Terraform Enterprise Multi-Environment Patterns"]}'::jsonb,
  0,
  ARRAY['Implement Terraform with workspaces, environment-specific tfvars files, Terraform Cloud for state management, and use conditional logic within modules for environment-specific resources'],
  'Application',
  'Expert'
);

-- End of generated SQL statements