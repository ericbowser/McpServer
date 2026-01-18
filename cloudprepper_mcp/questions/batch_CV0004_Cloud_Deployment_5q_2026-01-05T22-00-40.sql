-- Generated SQL INSERT statements for CloudPrepper questions
-- Certification: CV0-004
-- Domain: Cloud Deployment
-- Count: 5

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
  'Cloud Deployment',
  'Cloud Deployment',
  'A fintech company is deploying a microservices-based trading platform that processes 50,000 transactions per second during peak hours. The application consists of 15 microservices with varying resource requirements. The order processing service needs guaranteed compute resources and sub-5ms response times, while the notification service can tolerate higher latency. The company requires blue-green deployments with zero downtime and needs to comply with PCI DSS requirements for data isolation. Which deployment strategy would best meet these requirements?',
  '["Deploy all services on Amazon EKS with Fargate using Application Load Balancer and AWS App Mesh for traffic management","Use Amazon ECS with EC2 instances, implement dedicated clusters for critical services, and leverage AWS CodeDeploy blue-green deployment with target groups","Deploy on AWS Lambda with API Gateway, using provisioned concurrency for critical services and weighted routing for deployments","Implement Amazon EKS with mixed node groups (dedicated instances for critical services, spot instances for non-critical), using Istio service mesh and Argo Rollouts"]'::jsonb,
  'Implement Amazon EKS with mixed node groups (dedicated instances for critical services, spot instances for non-critical), using Istio service mesh and Argo Rollouts',
  'Option D is correct because it addresses all requirements comprehensively. Mixed node groups allow dedicated instances for the order processing service ensuring guaranteed compute resources and low latency, while spot instances reduce costs for fault-tolerant services like notifications. EKS provides the orchestration needed for 15 microservices, Istio service mesh enables sophisticated traffic management for blue-green deployments, and Argo Rollouts provides advanced deployment strategies with zero downtime. Dedicated instances help meet PCI DSS isolation requirements. Option A with Fargate lacks guaranteed compute resources and may have cold start issues. Option B using ECS is less suitable for complex microservices architectures and doesn''t provide the advanced deployment capabilities needed. Option C with Lambda introduces latency concerns for high-frequency trading operations and has execution time limits that could impact transaction processing.',
  '{"domain":"Cloud Deployment","subdomain":"Container Orchestration and Service Mesh","tags":["kubernetes","microservices","high-performance","compliance","blue-green-deployment"],"references":["AWS EKS Best Practices Guide","PCI DSS Cloud Implementation Guidelines"]}'::jsonb,
  0,
  ARRAY['Implement Amazon EKS with mixed node groups (dedicated instances for critical services, spot instances for non-critical), using Istio service mesh and Argo Rollouts'],
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
  'Cloud Deployment',
  'Cloud Deployment',
  'An enterprise is migrating a legacy monolithic application to a cloud-native architecture. The application handles sensitive healthcare data and requires deployment across multiple AWS regions for disaster recovery. The deployment must ensure data sovereignty compliance (data cannot leave specific geographic boundaries), implement automated rollback capabilities, and maintain 99.99% availability. The infrastructure must support both the legacy application during migration and new cloud-native services. Which deployment approach would best satisfy these requirements?',
  '["Use AWS Control Tower with customized Account Factory, deploy applications using AWS Systems Manager with Parameter Store for configuration management across regions","Implement Infrastructure as Code using AWS CDK with cross-region stacks, AWS Secrets Manager for sensitive data, and AWS CodePipeline with approval gates for multi-region deployments","Deploy using Terraform with region-specific modules, integrate with AWS Config for compliance monitoring, and use AWS Step Functions for orchestrated multi-region deployments","Utilize AWS Service Catalog with region-specific portfolios, AWS CloudFormation StackSets for multi-region deployment, and AWS Systems Manager Incident Manager for automated rollback"]'::jsonb,
  'Implement Infrastructure as Code using AWS CDK with cross-region stacks, AWS Secrets Manager for sensitive data, and AWS CodePipeline with approval gates for multi-region deployments',
  'Option B is correct as it provides the most comprehensive solution for this complex scenario. AWS CDK enables sophisticated Infrastructure as Code with cross-region stack deployment while maintaining data sovereignty through region-specific configurations. AWS Secrets Manager ensures secure handling of sensitive healthcare data with automatic rotation and regional encryption. CodePipeline with approval gates provides the necessary governance for healthcare compliance and automated rollback capabilities through its integration with CloudFormation rollback triggers. The approach supports both legacy and cloud-native deployments through flexible stack compositions. Option A lacks the sophisticated deployment orchestration needed for this complex migration. Option C with Terraform is viable but doesn''t provide the same level of AWS-native integration for compliance monitoring and automated rollback. Option D using Service Catalog is too rigid for the dynamic requirements of a migration scenario and doesn''t provide the granular control needed for data sovereignty.',
  '{"domain":"Cloud Deployment","subdomain":"Multi-Region Infrastructure as Code","tags":["multi-region","compliance","healthcare","infrastructure-as-code","disaster-recovery"],"references":["AWS CDK Multi-Region Deployment Guide","HIPAA Compliance on AWS Whitepaper"]}'::jsonb,
  0,
  ARRAY['Implement Infrastructure as Code using AWS CDK with cross-region stacks, AWS Secrets Manager for sensitive data, and AWS CodePipeline with approval gates for multi-region deployments'],
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
  'Cloud Deployment',
  'Cloud Deployment',
  'A gaming company needs to deploy a real-time multiplayer game backend that supports 100,000 concurrent players globally. The system requires ultra-low latency (sub-20ms), dynamic scaling based on player geography and time zones, and the ability to spin up new game instances within seconds. Game sessions are stateful and typically last 30-45 minutes. The deployment must handle traffic spikes during new game releases and major events. Which deployment architecture would best meet these performance and scalability requirements?',
  '["Use Amazon GameLift with fleet scaling policies, deploy game servers on C6gn instances with enhanced networking, implement CloudFront for static assets","Deploy on Amazon EKS with Karpenter for node autoscaling, use dedicated hosts in multiple AZs, implement custom load balancing with AWS Global Accelerator","Implement a hybrid approach using AWS Wavelength zones for ultra-low latency, ECS Anywhere for edge locations, and AWS Local Zones for regional presence","Use AWS Batch for game instance management, deploy on Spot Fleet with mixed instance types, implement Application Load Balancer with geographic routing"]'::jsonb,
  'Implement a hybrid approach using AWS Wavelength zones for ultra-low latency, ECS Anywhere for edge locations, and AWS Local Zones for regional presence',
  'Option C is correct because it leverages AWS Wavelength zones which provide ultra-low latency by placing compute resources at the edge of 5G networks, crucial for the sub-20ms requirement. ECS Anywhere allows deployment of game servers in strategic edge locations closer to players, while AWS Local Zones provide regional presence for secondary latency requirements. This hybrid approach enables dynamic geographic scaling and rapid instance provisioning. Option A with GameLift is good for game server management but may not achieve the ultra-low latency requirements without edge deployment. Option B with EKS and dedicated hosts provides good performance but lacks the geographic edge presence needed for global ultra-low latency. Option D using Spot Fleet introduces potential interruptions that could disrupt 30-45 minute game sessions, and AWS Batch is not optimized for real-time gaming workloads.',
  '{"domain":"Cloud Deployment","subdomain":"Edge Computing and Low-Latency Architectures","tags":["edge-computing","low-latency","gaming","wavelength","global-scaling"],"references":["AWS Wavelength Developer Guide","Real-time Gaming on AWS Architecture Guide"]}'::jsonb,
  0,
  ARRAY['Implement a hybrid approach using AWS Wavelength zones for ultra-low latency, ECS Anywhere for edge locations, and AWS Local Zones for regional presence'],
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
  'Cloud Deployment',
  'Cloud Deployment',
  'A pharmaceutical research company is deploying an AI/ML pipeline for drug discovery that processes terabytes of genomic data. The pipeline consists of data ingestion, preprocessing, model training, and inference stages with different compute requirements. Training jobs run for 12-48 hours using GPU clusters, while inference needs to be available 24/7 with auto-scaling capabilities. The company has budget constraints and needs to optimize costs while maintaining research velocity. Intermediate data must be encrypted at rest and in transit due to regulatory requirements. Which deployment strategy would provide optimal cost-performance balance?',
  '["Use Amazon SageMaker with managed training jobs on Spot instances, SageMaker endpoints with auto-scaling for inference, and S3 with KMS encryption for data storage","Deploy on Amazon EKS with Cluster Autoscaler, use GPU node groups with Spot instances for training, Reserved instances for inference workloads, and EFS with encryption for shared storage","Implement AWS Batch with mixed instance types for training jobs, AWS Lambda with container images for inference, and encrypted EBS volumes with regular snapshots","Use Amazon EC2 with Auto Scaling groups, implement custom scheduling for GPU instances, deploy inference on Fargate, and use encrypted Amazon FSx for Lustre for high-performance storage"]'::jsonb,
  'Use Amazon SageMaker with managed training jobs on Spot instances, SageMaker endpoints with auto-scaling for inference, and S3 with KMS encryption for data storage',
  'Option A is correct as it provides the most cost-effective and operationally efficient solution for ML workloads. SageMaker managed training jobs with Spot instances can reduce training costs by up to 70% while handling interruptions gracefully for long-running jobs. SageMaker endpoints provide automatic scaling for inference with pay-per-request pricing when idle, optimizing costs. S3 with KMS encryption meets regulatory requirements and provides virtually unlimited scalable storage for genomic data. SageMaker''s native integration handles data movement and security seamlessly. Option B with EKS requires significant operational overhead for ML workload management and doesn''t provide the cost optimizations of managed ML services. Option C using Lambda for inference has limitations on execution time and memory that may not suit complex ML models, and Batch lacks the ML-specific optimizations. Option D requires substantial operational management and custom scheduling implementation, increasing complexity without additional benefits.',
  '{"domain":"Cloud Deployment","subdomain":"Machine Learning Infrastructure Deployment","tags":["machine-learning","gpu-computing","cost-optimization","spot-instances","compliance"],"references":["Amazon SageMaker Cost Optimization Guide","AWS ML Security Best Practices"]}'::jsonb,
  0,
  ARRAY['Use Amazon SageMaker with managed training jobs on Spot instances, SageMaker endpoints with auto-scaling for inference, and S3 with KMS encryption for data storage'],
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
  'Cloud Deployment',
  'Cloud Deployment',
  'A global e-commerce platform experiences extreme traffic variations with 10x spikes during flash sales and holiday seasons. The platform consists of web tier, API gateway, microservices, and database layers. During normal operations, it serves 10,000 requests per second, but during peak events, it must handle 100,000+ RPS with sub-100ms response times. The system needs to deploy new features multiple times per day with canary deployments and automatic rollback capabilities. Cost optimization during low-traffic periods is critical. Which deployment architecture would best handle these dynamic scaling requirements?',
  '["Use Amazon API Gateway with Lambda functions for business logic, DynamoDB with on-demand billing, and CloudFront for global content delivery with automatic scaling","Deploy microservices on Amazon ECS with Application Auto Scaling, use Amazon RDS with read replicas, implement AWS App Mesh for traffic management and canary deployments","Implement Amazon EKS with Vertical Pod Autoscaler and Horizontal Pod Autoscaler, use Amazon Aurora Serverless v2, and deploy Istio for advanced traffic routing and observability","Use AWS App Runner for microservices deployment, Amazon ElastiCache with cluster mode, and AWS Global Accelerator for traffic distribution with health checks"]'::jsonb,
  'Implement Amazon EKS with Vertical Pod Autoscaler and Horizontal Pod Autoscaler, use Amazon Aurora Serverless v2, and deploy Istio for advanced traffic routing and observability',
  'Option C is correct because EKS with both VPA and HPA provides the most sophisticated auto-scaling capabilities needed for 10x traffic spikes. VPA optimizes resource allocation for individual pods while HPA handles horizontal scaling based on demand. Aurora Serverless v2 automatically scales database capacity with sub-second response times, crucial for the 100,000+ RPS requirement. Istio service mesh enables advanced canary deployments with fine-grained traffic splitting and automatic rollback based on error rates and latency metrics. This combination provides both the performance scaling and deployment flexibility required. Option A with Lambda has cold start issues that could impact sub-100ms response time requirements at scale. Option B lacks the automatic vertical scaling optimization and Aurora Serverless benefits for extreme scaling scenarios. Option D with App Runner is too simplistic for complex microservices architectures requiring sophisticated deployment strategies and may not handle the extreme scaling requirements effectively.',
  '{"domain":"Cloud Deployment","subdomain":"Auto-scaling and Traffic Management","tags":["auto-scaling","high-traffic","microservices","canary-deployment","serverless-database"],"references":["Kubernetes Autoscaling Best Practices","AWS Aurora Serverless v2 Performance Guide"]}'::jsonb,
  0,
  ARRAY['Implement Amazon EKS with Vertical Pod Autoscaler and Horizontal Pod Autoscaler, use Amazon Aurora Serverless v2, and deploy Istio for advanced traffic routing and observability'],
  'Application',
  'Expert'
);

-- End of generated SQL statements