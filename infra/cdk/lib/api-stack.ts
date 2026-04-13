import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  apiSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.Secret;
  dbEndpoint: string;
  cacheEndpoint: string;
  bucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      vpc,
      apiSecurityGroup,
      dbSecret,
      dbEndpoint,
      cacheEndpoint,
      bucket,
    } = props;

    // ── OpenAI key (must be created in Secrets Manager before deploy) ─
    // aws secretsmanager create-secret --name /cse/openai/api-key --secret-string "sk-..."
    const openAiSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'OpenAiSecret',
      '/cse/openai/api-key',
    );

    // ── ECR repository ───────────────────────────────────────────────
    const ecrRepo = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: 'cse-api',
      imageScanOnPush: true,
      lifecycleRules: [
        {
          // Keep last 10 images
          maxImageCount: 10,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── ECS cluster ──────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'CseCluster', {
      clusterName: 'cse-cluster',
      vpc,
      containerInsights: true,
    });

    // ── Task role ────────────────────────────────────────────────────
    const taskRole = new iam.Role(this, 'ApiTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'CSE API ECS task role',
    });

    // Allow reading DB credentials and OpenAI key
    dbSecret.grantRead(taskRole);
    openAiSecret.grantRead(taskRole);

    // Allow S3 document bucket access
    bucket.grantReadWrite(taskRole);

    // ── Task execution role ──────────────────────────────────────────
    const executionRole = new iam.Role(this, 'ApiExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    });
    dbSecret.grantRead(executionRole);
    openAiSecret.grantRead(executionRole);

    // ── Log group ────────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: '/cse/api',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Task definition ──────────────────────────────────────────────
    const taskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
      taskRole,
      executionRole,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
      },
    });

    const container = taskDef.addContainer('ApiContainer', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      containerName: 'api',
      portMappings: [{ containerPort: 4000 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '4000',
        MINIO_USE_SSL: 'false',
        OPENAI_MODEL: 'gpt-4o',
        OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
        S3_BUCKET: bucket.bucketName,
        S3_REGION: this.region,
        REDIS_URL: `rediss://${cacheEndpoint}:6379`,
        DB_HOST: dbEndpoint,
        DB_NAME: 'candidate_engine',
      },
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        DB_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(openAiSecret),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget -qO /dev/null http://localhost:4000/api/health || exit 1'],
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
    });

    // ── Fargate service ──────────────────────────────────────────────
    const service = new ecs.FargateService(this, 'ApiService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [apiSecurityGroup],
      enableExecuteCommand: true, // allows `aws ecs execute-command` for debugging
      circuitBreaker: { rollback: true },
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
    });

    // ── Auto-scaling ─────────────────────────────────────────────────
    const scaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(30),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
    });

    // ── ALB ──────────────────────────────────────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ApiAlb', {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const listener = alb.addListener('HttpsListener', {
      port: 443,
      // Replace with your ACM certificate ARN.
      // certificates: [elbv2.ListenerCertificate.fromArn('arn:aws:acm:...')],
      open: true,
      protocol: elbv2.ApplicationProtocol.HTTP, // Change to HTTPS when cert is ready
    });

    listener.addTargets('ApiTarget', {
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/api/health',
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // HTTP → HTTPS redirect (activate once certificate is configured)
    alb.addListener('HttpRedirect', {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.redirect({
        port: '443',
        protocol: 'HTTPS',
        permanent: true,
      }),
    });

    this.apiUrl = `http://${alb.loadBalancerDnsName}`;

    // ── Outputs ──────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'ALB DNS name for the API',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepo.repositoryUri,
      description: 'Push API Docker image here',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
    });
  }
}
