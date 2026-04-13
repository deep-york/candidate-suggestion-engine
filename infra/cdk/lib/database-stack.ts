import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly dbSecret: secretsmanager.Secret;
  public readonly dbEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc, dbSecurityGroup } = props;

    // ── Credentials ──────────────────────────────────────────────────
    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: '/cse/database/credentials',
      description: 'Aurora PostgreSQL credentials for Candidate Suggestion Engine',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'cse' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // ── Subnet group ─────────────────────────────────────────────────
    const subnetGroup = new rds.SubnetGroup(this, 'DbSubnetGroup', {
      description: 'Isolated subnets for Aurora',
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // ── Aurora Serverless v2 (PostgreSQL 16) ─────────────────────────
    // Serverless v2 scales to zero ACUs when idle and supports pgvector.
    const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_2,
      }),
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      defaultDatabaseName: 'candidate_engine',
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 8,
      writer: rds.ClusterInstance.serverlessV2('Writer', {
        autoMinorVersionUpgrade: true,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2('Reader', {
          scaleWithWriter: true,
        }),
      ],
      vpc,
      subnetGroup,
      securityGroups: [dbSecurityGroup],
      storageEncrypted: true,
      backup: {
        retention: cdk.Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      // Enable pgvector and uuid-ossp via parameter group
      parameterGroup: new rds.ParameterGroup(this, 'PgParamGroup', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_16_2,
        }),
        description: 'Enable pgvector extension',
        parameters: {
          'shared_preload_libraries': 'pg_stat_statements,vector',
        },
      }),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.dbEndpoint = cluster.clusterEndpoint.hostname;

    // ── Outputs ──────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.dbEndpoint,
      description: 'Aurora cluster write endpoint',
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'Secrets Manager ARN for DB credentials',
    });
  }
}
