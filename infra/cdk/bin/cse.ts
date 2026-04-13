#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { CacheStack } from '../lib/cache-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { WebStack } from '../lib/web-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

// ── 1. Networking ────────────────────────────────────────────────
const network = new NetworkStack(app, 'CseNetworkStack', { env });

// ── 2. Data layer ────────────────────────────────────────────────
const database = new DatabaseStack(app, 'CseDatabaseStack', {
  env,
  vpc: network.vpc,
  dbSecurityGroup: network.dbSecurityGroup,
});

const cache = new CacheStack(app, 'CseCacheStack', {
  env,
  vpc: network.vpc,
  cacheSecurityGroup: network.cacheSecurityGroup,
});

// ── 3. Object storage ────────────────────────────────────────────
const storage = new StorageStack(app, 'CseStorageStack', { env });

// ── 4. Application ───────────────────────────────────────────────
const api = new ApiStack(app, 'CseApiStack', {
  env,
  vpc: network.vpc,
  apiSecurityGroup: network.apiSecurityGroup,
  dbSecret: database.dbSecret,
  dbEndpoint: database.dbEndpoint,
  cacheEndpoint: cache.cacheEndpoint,
  bucket: storage.bucket,
});

// ── 5. Web / CDN ─────────────────────────────────────────────────
new WebStack(app, 'CseWebStack', {
  env,
  apiUrl: api.apiUrl,
});

app.synth();
