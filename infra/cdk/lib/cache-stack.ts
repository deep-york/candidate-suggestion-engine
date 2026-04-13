import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface CacheStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  cacheSecurityGroup: ec2.SecurityGroup;
}

export class CacheStack extends cdk.Stack {
  public readonly cacheEndpoint: string;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    const { vpc, cacheSecurityGroup } = props;

    // ── Subnet group ─────────────────────────────────────────────────
    const isolatedSubnetIds = vpc
      .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED })
      .subnetIds;

    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
      description: 'Isolated subnets for ElastiCache',
      subnetIds: isolatedSubnetIds,
      cacheSubnetGroupName: 'cse-cache-subnet-group',
    });

    // ── Valkey / Redis 7 replication group ───────────────────────────
    // Single-shard, 1 primary + 1 replica for HA.
    // cache.t4g.micro adequate for dev/staging; scale up for production.
    const replicationGroup = new elasticache.CfnReplicationGroup(
      this,
      'CacheCluster',
      {
        replicationGroupDescription: 'CSE Redis cache',
        engine: 'valkey',
        engineVersion: '7.2',
        cacheNodeType: 'cache.t4g.small',
        numCacheClusters: 2,
        automaticFailoverEnabled: true,
        multiAzEnabled: true,
        atRestEncryptionEnabled: true,
        transitEncryptionEnabled: true,
        cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
        securityGroupIds: [cacheSecurityGroup.securityGroupId],
        snapshotRetentionLimit: 1,
        snapshotWindow: '04:00-05:00',
      },
    );

    replicationGroup.addDependency(subnetGroup);

    // Primary endpoint (read/write)
    this.cacheEndpoint = replicationGroup.attrPrimaryEndPointAddress;

    // ── Outputs ──────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'CacheEndpoint', {
      value: this.cacheEndpoint,
      description: 'ElastiCache primary endpoint',
    });
  }
}
