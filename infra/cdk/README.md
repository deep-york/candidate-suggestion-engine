# CSE Infrastructure — AWS CDK

Deploys the Candidate Suggestion Engine to AWS using TypeScript CDK.

## Stacks

| Stack | Key resources |
|-------|--------------|
| `CseNetworkStack` | VPC (2 AZs), public/private/isolated subnets, NAT Gateway, security groups |
| `CseDatabaseStack` | Aurora PostgreSQL 16 Serverless v2 (0.5–8 ACUs), Secrets Manager credentials |
| `CseCacheStack` | ElastiCache Valkey 7.2 (Redis-compatible), 1 primary + 1 replica |
| `CseStorageStack` | S3 bucket for documents (server-side encryption, SSL enforced, 90-day lifecycle) |
| `CseApiStack` | ECR repo, ECS Fargate service, ALB, auto-scaling (2–10 tasks), CloudWatch logs |
| `CseWebStack` | S3 static hosting + CloudFront distribution with /api/* proxy to ALB |

## Prerequisites

1. **AWS CLI configured**
   ```bash
   aws configure        # or set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION
   aws sts get-caller-identity   # confirm identity
   ```

2. **CDK bootstrapped** (once per account/region)
   ```bash
   npx cdk bootstrap aws://ACCOUNT_ID/REGION
   ```

3. **OpenAI secret in Secrets Manager** (once)
   ```bash
   aws secretsmanager create-secret \
     --name /cse/openai/api-key \
     --secret-string "sk-YOUR_KEY_HERE"
   ```

## Install & build

```bash
cd infra/cdk
npm install
npm run build
```

## Deploy

```bash
# Preview changes
npm run diff

# Deploy all stacks (in dependency order)
npm run deploy
```

Deployment takes ~20–30 minutes on first run (Aurora provisioning is the slowest step).

## Push the API Docker image

After deployment, push your API image to the ECR repository:

```bash
# Get the ECR URI from CDK outputs or:
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name CseApiStack \
  --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue" \
  --output text)

# Authenticate Docker to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_URI

# Build and push
docker build -t cse-api ./apps/api
docker tag cse-api:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Force ECS to redeploy with the new image
aws ecs update-service \
  --cluster cse-cluster \
  --service $(aws cloudformation describe-stacks \
    --stack-name CseApiStack \
    --query "Stacks[0].Outputs[?OutputKey=='ServiceName'].OutputValue" \
    --output text) \
  --force-new-deployment
```

## Deploy the web frontend

```bash
# Build the React app
cd apps/web
VITE_API_URL=''   # Leave empty — CloudFront proxies /api/* to the ALB
npm run build

# Get the bucket name
WEB_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name CseWebStack \
  --query "Stacks[0].Outputs[?OutputKey=='WebBucketName'].OutputValue" \
  --output text)

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name CseWebStack \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

# Upload build output
aws s3 sync dist/ s3://$WEB_BUCKET --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

## Run database migrations

After the API container is running:

```bash
CLUSTER=$(aws cloudformation describe-stacks --stack-name CseApiStack \
  --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue" --output text)

SERVICE=$(aws cloudformation describe-stacks --stack-name CseApiStack \
  --query "Stacks[0].Outputs[?OutputKey=='ServiceName'].OutputValue" --output text)

TASK=$(aws ecs list-tasks --cluster $CLUSTER --service-name $SERVICE \
  --query "taskArns[0]" --output text)

aws ecs execute-command \
  --cluster $CLUSTER \
  --task $TASK \
  --container api \
  --interactive \
  --command "bun run migrate"
```

## HTTPS / Custom domain

1. Request a certificate in ACM for your domain.
2. In [lib/api-stack.ts](lib/api-stack.ts) uncomment the `certificates` line on the HTTPS listener and add your cert ARN.
3. In [lib/web-stack.ts](lib/web-stack.ts) add a `domainNames` array and `certificate` to the CloudFront distribution.
4. Create a CNAME or Alias record in Route 53 pointing to the CloudFront domain.

## Tear down

```bash
npm run destroy
```

Aurora's `deletionProtection: true` means you must manually disable it before destroying the database stack:

```bash
aws rds modify-db-cluster \
  --db-cluster-identifier <cluster-id> \
  --no-deletion-protection \
  --apply-immediately
```

## Cost estimate (us-east-1, light usage)

| Resource | Est. monthly |
|----------|-------------|
| Aurora Serverless v2 (0.5 ACU idle) | ~$10–25 |
| ElastiCache cache.t4g.small × 2 | ~$28 |
| ECS Fargate (2 × 0.5 vCPU / 1 GB) | ~$18 |
| ALB | ~$18 |
| CloudFront (10 GB transfer) | ~$1 |
| S3 | ~$1 |
| NAT Gateway | ~$5 |
| **Total** | **~$80–100/month** |

Scale Aurora down to the minimum ACU when idle to reduce costs further.
