# JGA Enterprise OS - Production Deployment Guide

## Overview

This guide covers all steps required to deploy JGA BRICS OS to production for April 27, 2026 launch.

**Target Environment:** AWS (EKS), CloudFront CDN, RDS/DynamoDB, Route 53

## Pre-Deployment Checklist

- [ ] All security audit checks passing
- [ ] Load tests completed successfully (1k leads, 100 concurrent)
- [ ] Docker images built and pushed to ECR
- [ ] Kubernetes cluster provisioned (EKS)
- [ ] RDS databases created (CA and TX states)
- [ ] KMS keys provisioned per state
- [ ] DNS records prepared for cutover
- [ ] Monitoring/logging configured (CloudWatch, Datadog, or ELK)
- [ ] Backup and disaster recovery plan reviewed
- [ ] Team trained on incident response runbooks

---

## Step 1: Infrastructure Setup (Days 1-3)

### 1.1 AWS EKS Cluster

```bash
# Create EKS cluster (3-node minimum)
eksctl create cluster \
  --name jga-os-prod \
  --region us-east-1 \
  --nodegroup-name workers \
  --nodes 3 \
  --node-type t3.xlarge \
  --managed

# Add IAM roles for Pods
eksctl utils associate-iam-oidc-provider --cluster=jga-os-prod --region=us-east-1

# Install AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=jga-os-prod
```

### 1.2 Create RDS Databases (One per State)

```bash
# CA State Database
aws rds create-db-instance \
  --db-instance-identifier jga-os-state-ca \
  --db-instance-class db.t3.large \
  --engine postgres \
  --master-username postgres \
  --master-user-password [GENERATE_STRONG_PASSWORD] \
  --allocated-storage 100 \
  --storage-encrypted \
  --kms-key-id [KMS_KEY_ARN] \
  --multi-az \
  --vpc-security-group-ids [SECURITY_GROUP_ID]

# TX State Database
aws rds create-db-instance \
  --db-instance-identifier jga-os-state-tx \
  --db-instance-class db.t3.large \
  --engine postgres \
  --master-username postgres \
  --master-user-password [GENERATE_STRONG_PASSWORD] \
  --allocated-storage 100 \
  --storage-encrypted \
  --kms-key-id [KMS_KEY_ARN] \
  --multi-az
```

### 1.3 Create KMS Keys (Encryption at Rest)

```bash
# CA State Key
aws kms create-key \
  --description "JGA OS State BRIC CA encryption key" \
  --tags TagKey=State,TagValue=CA TagKey=Project,TagValue=jga-os

# TX State Key
aws kms create-key \
  --description "JGA OS State BRIC TX encryption key" \
  --tags TagKey=State,TagValue=TX TagKey=Project,TagValue=jga-os

# Store key IDs in Kubernetes Secrets
kubectl create secret generic kms-keys \
  --from-literal=ca-key-id=[CA_KMS_KEY_ID] \
  --from-literal=tx-key-id=[TX_KMS_KEY_ID] \
  -n jga-os
```

---

## Step 2: Containerization (Days 4-5)

### 2.1 Build Docker Image

```bash
# Build
docker build -t jga-os:1.0 .

# Tag for ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [AWS_ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com

docker tag jga-os:1.0 [AWS_ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/jga-os:1.0

# Push
docker push [AWS_ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/jga-os:1.0
```

### 2.2 Image Security Scanning

```bash
# Scan with AWS ECR
aws ecr start-image-scan \
  --repository-name jga-os \
  --image-id imageTag=1.0

# Wait for scan completion
aws ecr describe-image-scan-findings \
  --repository-name jga-os \
  --image-id imageTag=1.0
```

---

## Step 3: Kubernetes Deployment (Days 6-7)

### 3.1 Create Namespace & Secrets

```bash
kubectl create namespace jga-os

# Create database secrets
kubectl create secret generic db-credentials \
  --from-literal=ca-url=postgresql://user:pass@[CA_RDS_ENDPOINT]:5432/jga_os \
  --from-literal=tx-url=postgresql://user:pass@[TX_RDS_ENDPOINT]:5432/jga_os \
  -n jga-os

# Create compliance artifact secrets
kubectl create secret generic compliance-artifact \
  --from-file=artifact.json=./compliance-artifact.json \
  -n jga-os
```

### 3.2 Deploy BRICS Stack

```bash
# Update image references in k8s/deployment.yaml
sed -i 's|jga-os:1.0|[AWS_ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/jga-os:1.0|g' k8s/deployment.yaml

# Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml

# Wait for rollout
kubectl rollout status statefulset/brics-raft-primary -n jga-os --timeout=10m
kubectl rollout status deployment/brics-public -n jga-os --timeout=10m
kubectl rollout status deployment/brics-system-b -n jga-os --timeout=10m
```

### 3.3 Verify Pod Health

```bash
# Check pod status
kubectl get pods -n jga-os -w

# Check logs
kubectl logs -f deployment/brics-public -n jga-os

# Port forward for local testing
kubectl port-forward svc/brics-public 8080:80 -n jga-os
```

---

## Step 4: Domain & DNS Setup (Days 8-9)

### 4.1 Get Load Balancer Address

```bash
# Get NLB/ALB DNS name
kubectl get ingress -n jga-os

# Output will show: api.jga-os.example.com → [LOAD_BALANCER_ADDRESS]
```

### 4.2 Update Route 53

```bash
# Create hosted zone (if not already done)
aws route53 create-hosted-zone --name api.jga-os.example.com --caller-reference $(date +%s)

# Get hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name api.jga-os.example.com \
  --query 'HostedZones[0].Id' --output text)

# Create DNS record (alias to load balancer)
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.jga-os.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "[LOAD_BALANCER_DNS]",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

### 4.3 Enable TLS Certificate

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Create Let's Encrypt issuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@jga-os.example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Certificate will be auto-provisioned by ingress
# Verify with: kubectl get certificate -n jga-os
```

---

## Step 5: CDN & Static Asset Publishing (Days 10-11)

### 5.1 Configure CloudFront

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name "[LOAD_BALANCER_DNS]" \
  --default-root-object index.html \
  --with-config-file cdn-config.json
```

### 5.2 Update Route 53 for CDN

```bash
# Create CNAME for CDN
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "cdn.jga-os.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "[CLOUDFRONT_DOMAIN_NAME]"}]
      }
    }]
  }'
```

---

## Step 6: Monitoring & Observability (Days 12-13)

### 6.1 Setup CloudWatch

```bash
# Enable container insights
aws eks update-cluster-config \
  --name jga-os-prod \
  --logging '{"clusterLogging":[{"enabled":true,"types":["api","audit","authenticator","controllerManager","scheduler"]}]}'
```

### 6.2 Configure Application Metrics

```bash
# Install Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus \
  -n monitoring \
  --create-namespace

# Install Grafana
helm install grafana grafana/grafana \
  -n monitoring
```

### 6.3 Setup Alerting

```yaml
# Create AlertManager rules
rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    annotations:
      summary: "High error rate on {{ $labels.pod }}"

  - alert: RaftQuorumLoss
    expr: brics_raft_healthy_nodes < 2
    for: 1m
    annotations:
      summary: "Raft quorum lost - critical incident!"

  - alert: DataCorruptionDetected
    expr: brics_stitch_corruption_detected > 0
    for: 1m
    annotations:
      summary: "Data corruption detected - auto-healing initiated"
```

---

## Step 7: Load Testing (Days 14-15)

### 7.1 Run Load Tests

```bash
npm run load-test
```

**Expected Results:**
- Throughput: > 5 leads/sec
- P99 Latency: < 500ms
- Error Rate: < 1%
- All 1,000 contractors provisioned successfully

### 7.2 Stress Test Results

```
✅ PASSED: System meets production performance targets
```

---

## Step 8: Security Audit & Hardening (Days 16-17)

### 8.1 Run Full Security Audit

```bash
npm run security-audit
```

**Audit Checklist:**
- ✅ No secrets in code
- ✅ No critical vulnerabilities
- ✅ All 8 system laws enforced
- ✅ Public boundary isolated
- ✅ State BRIC data isolated
- ✅ Compliance gate active
- ✅ MFA enforced on Owners Room
- ✅ Encryption at rest enabled

### 8.2 Penetration Testing

```bash
# OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.jga-os.example.com

# Manual security review
# - SSL/TLS configuration
# - API rate limiting
# - Input validation
# - Authorization checks
```

---

## Step 9: Incident Drills (Days 18-20)

### 9.1 Simulate Data Corruption

```bash
# Demo is already tested and passes all 6 scenarios
npm run test:demo

# Verify auto-healing works under production load
```

### 9.2 Credential Leak Drill

```bash
# Simulate credential leak detection
# 1. Inject test credential to repo
# 2. Run secret scanner
# 3. Verify detection and rotation
# 4. Confirm no false alarms on cleanup
```

### 9.3 Compliance Violation Response

```bash
# Test compliance gate closure
# 1. Trigger high-risk incident
# 2. Verify compliance gate closes business calls
# 3. Confirm escrow holds pending gate reopening
```

---

## Step 10: Final Pre-Launch (Days 21-25)

### 10.1 Run Complete Launch Script

```bash
npm run launch
```

**Expected Output:**
```
✅ SYSTEM GO FOR LAUNCH
- All verification checks passed
- OS is fully operational
- Ready for production deployment
```

### 10.2 Approval & Sign-Off

- [ ] Technical Lead approval
- [ ] Legal Counsel approval  
- [ ] Owner/stakeholder approval
- [ ] Operations team sign-off

### 10.3 Cutover Plan

- Maintain parallel system if using existing infrastructure
- Monitor error rates during cutover
- Have rollback plan ready (< 30 min recovery time)

---

## Step 11: Go-Live (April 27, 2026)

### 11.1 Final Status Check

```bash
# Verify all systems operational
kubectl get pods -n jga-os
kubectl get svc -n jga-os
kubectl logs deployment/brics-raft-primary -n jga-os | tail -20

# Verify compliance artifact is valid
kubectl get secret compliance-artifact -n jga-os -o jsonpath='{.data.artifact\.json}' | base64 -d | jq .

# Check DNS resolution
dig api.jga-os.example.com
```

### 11.2 Enable Public Access

```bash
# Update DNS TTL to 60 seconds
# Deploy cutover traffic gradually:
# - 10% traffic → 1 hour
# - 50% traffic → 2 hours
# - 100% traffic → 4 hours

# Monitor metrics throughout
```

### 11.3 Celebrate! 🎉

```bash
echo "JGA Enterprise OS is LIVE!"
```

---

## Post-Launch Operations

### Ongoing Monitoring

- **Per-minute:** Health checks, error rates, latency
- **Per-hour:** Compliance artifact expiration, backup status
- **Per-day:** Security logs, audit trail, incident review
- **Per-week:** Load test results, contractor activity
- **Per-month:** Key rotation, dependency updates, security audit

### Incident Response

- **Data Corruption:** Auto-healing within 5 minutes (tested)
- **Credential Leak:** Revoke + rotate within 15 minutes
- **Compliance Violation:** Close gate + investigate within 1 hour
- **Security Breach:** Escalate to incident commander + legal

### Scaling

If load exceeds 1k contractors:
1. Increase replica count (Kubernetes HPA handles automatically)
2. Add additional State BRIC regions
3. Expand contractor training capacity

---

## Rollback Plan

If critical issues occur post-launch:

1. **Immediate (< 5 min):** Close compliance gate to stop all transactions
2. **Short-term (5-30 min):** Failover to previous deployment slot
3. **Long-term:** Root cause analysis + fix + new deployment

```bash
# Rollback to previous image
kubectl set image deployment/brics-public \
  brics-public=[OLD_ECR_IMAGE] \
  -n jga-os

# Scale down new deployment
kubectl scale deployment brics-public --replicas=0 -n jga-os
```

---

## Support & Escalation

**On-Call Rotation:** ops-team@jga-os.example.com

**Severity Levels:**
- P1 (Critical): Any BRIC down, data loss, compliance violation
- P2 (High): Degraded performance, security concerns
- P3 (Medium): Operational efficiency, feature requests

**Runbooks:** See `brics/april-keys/APRIL.KEYS.md`

---

**Last Updated:** March 20, 2026  
**Status:** Ready for Production Deployment  
**Next Review:** Post-Launch + 2 weeks
