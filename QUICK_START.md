# JGA BRICS OS - Quick Start Implementation Guide

**For:** DevOps/SRE Teams  
**Purpose:** Step-by-step execution guide for April 27, 2026 launch  
**Time:** ~2 days for complete deployment

---

## Day 1: Setup & Validation (8 hours)

### Step 1: Clone Repository & Install Dependencies (30 min)

```bash
# Clone the JGA OS repository
git clone https://github.com/jga-os/brics-os.git
cd brics-os

# Install Node dependencies
npm install

# Verify TypeScript compiles
npm run build

# Run all tests (demo tests should all pass)
npm run test:demo
# Expected Output: ✅ DEMO.1-6 all passing (6/6)
```

### Step 2: Run Pre-Flight Validation (45 min)

```bash
# 1. Security Audit (comprehensive 5-phase scan)
npm run security-audit
# Expected: ✅ PASSED
# Check for: secret scanning, dependency audit, architecture review, 
# encryption validation, compliance gate

# 2. Load Test (validate performance under load)
npm run load-test
# Expected: ✅ PASSED
# Metrics: throughput > 5 leads/sec, p99 < 500ms, error rate < 1%

# 3. Verify all demo tests still pass
npm run test:demo
# Expected: 6/6 passing
```

**Decision Point:** If any test fails, fix before proceeding. ⚠️  
Go-live is blocked until all three pass.

### Step 3: Set Up AWS Account (1.5 hours)

```bash
# Configure AWS credentials
aws configure
# Input: Access Key, Secret Key, Region (us-east-1), Output format (json)

# Verify access
aws sts get-caller-identity
# Should show your AWS account

# Export key variables for later steps
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
export AWS_REGION=us-east-1
export CLUSTER_NAME=jga-os-prod
export HOSTED_ZONE_ID=[YOUR_ROUTE53_ZONE_ID]

# Create secrets directory
mkdir -p ~/.jga-os-secrets
chmod 700 ~/.jga-os-secrets
```

### Step 4: Configure Docker Registry (1 hour)

```bash
# Create ECR repository
aws ecr create-repository --repository-name jga-os --region $AWS_REGION

# Build Docker image
docker build -t jga-os:1.0 .

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Tag image
docker tag jga-os:1.0 \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/jga-os:1.0

# Push to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/jga-os:1.0

# Verify
aws ecr describe-images --repository-name jga-os
```

### Step 5: Create EKS Cluster (2 hours - mostly automated)

```bash
# Install eksctl (if needed)
# macOS: brew install eksctl
# Linux: curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp

# Create cluster (this takes ~15-20 minutes)
eksctl create cluster \
  --name $CLUSTER_NAME \
  --region $AWS_REGION \
  --nodegroup-name workers \
  --nodes 3 \
  --node-type t3.xlarge \
  --managed \
  --enable-ssm

# Wait and verify
eksctl get cluster --name $CLUSTER_NAME

# Update kubeconfig
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

# Verify kubectl access
kubectl cluster-info
kubectl get nodes
# Expected: 3 nodes in Ready state
```

---

## Day 2: Infrastructure & Deployment (8 hours)

### Step 1: Create Databases (1.5 hours - mostly automated)

```bash
# Create security group for RDS
export SG_ID=$(aws ec2 create-security-group \
  --group-name jga-os-rds-sg \
  --description "Security group for JGA OS RDS" \
  --query 'GroupId' --output text)

# Allow PostgreSQL from cluster nodes
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0

# Create CA state database
aws rds create-db-instance \
  --db-instance-identifier jga-os-state-ca \
  --db-instance-class db.t3.large \
  --engine postgres \
  --engine-version 14 \
  --master-username postgres \
  --master-user-password $(openssl rand -base64 32) \
  --allocated-storage 100 \
  --storage-type gp2 \
  --storage-encrypted \
  --vpc-security-group-ids $SG_ID \
  --multi-az \
  --backup-retention-period 30 \
  --backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --publicly-accessible false \
  --enable-cloudwatch-logs-exports postgresql

# Create TX state database (same process)
aws rds create-db-instance \
  --db-instance-identifier jga-os-state-tx \
  --db-instance-class db.t3.large \
  --engine postgres \
  --engine-version 14 \
  --master-username postgres \
  --master-user-password $(openssl rand -base64 32) \
  --allocated-storage 100 \
  --storage-type gp2 \
  --storage-encrypted \
  --vpc-security-group-ids $SG_ID \
  --multi-az \
  --backup-retention-period 30 \
  --backup-window "03:30-04:30" \
  --publicly-accessible false \
  --enable-cloudwatch-logs-exports postgresql

# Wait for databases to be available
while true; do
  aws rds describe-db-instances --query 'DBInstances[0].DBInstanceStatus' --output text
  # Wait until it says "available"
  sleep 30
done

# Get database endpoints
export CA_DB_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier jga-os-state-ca \
  --query 'DBInstances[0].Endpoint.Address' --output text)

export TX_DB_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier jga-os-state-tx \
  --query 'DBInstances[0].Endpoint.Address' --output text)

echo "CA Database: $CA_DB_ENDPOINT"
echo "TX Database: $TX_DB_ENDPOINT"
```

### Step 2: Create KMS Keys (30 min)

```bash
# Create CA state encryption key
export CA_KMS_KEY_ID=$(aws kms create-key \
  --description "JGA OS State BRIC CA encryption key" \
  --tags TagKey=State,TagValue=CA TagKey=Project,TagValue=jga-os \
  --query 'KeyMetadata.KeyId' --output text)

# Create TX state encryption key
export TX_KMS_KEY_ID=$(aws kms create-key \
  --description "JGA OS State BRIC TX encryption key" \
  --tags TagKey=State,TagValue=TX TagKey=Project,TagValue=jga-os \
  --query 'KeyMetadata.KeyId' --output text)

# Create aliases for easy reference
aws kms create-alias --alias-name alias/jga-os-state-ca --target-key-id $CA_KMS_KEY_ID
aws kms create-alias --alias-name alias/jga-os-state-tx --target-key-id $TX_KMS_KEY_ID

echo "CA KMS Key: $CA_KMS_KEY_ID"
echo "TX KMS Key: $TX_KMS_KEY_ID"

# Store in secrets file for later
cat > ~/.jga-os-secrets/kms-keys.env <<EOF
CA_KMS_KEY_ID=$CA_KMS_KEY_ID
TX_KMS_KEY_ID=$TX_KMS_KEY_ID
EOF
```

### Step 3: Configure Kubernetes Namespace (45 min)

```bash
# Create namespace
kubectl create namespace jga-os

# Create ConfigMap with environment variables
kubectl create configmap jga-os-config \
  --from-literal=ENVIRONMENT=production \
  --from-literal=LOG_LEVEL=info \
  --from-literal=STATES=CA,TX \
  --from-literal=MFA_REQUIRED=true \
  --from-literal=VPN_REQUIRED=false \
  --from-literal=RAFT_HEARTBEAT_INTERVAL=150 \
  --from-literal=RAFT_ELECTION_TIMEOUT=1500 \
  -n jga-os

# Create Secrets for sensitive data
kubectl create secret generic jga-os-secrets \
  --from-literal=CA_DB_URL="postgresql://postgres:$(openssl rand -base64 32)@$CA_DB_ENDPOINT:5432/jga_os" \
  --from-literal=TX_DB_URL="postgresql://postgres:$(openssl rand -base64 32)@$TX_DB_ENDPOINT:5432/jga_os" \
  --from-literal=CA_KMS_KEY_ID=$CA_KMS_KEY_ID \
  --from-literal=TX_KMS_KEY_ID=$TX_KMS_KEY_ID \
  --from-literal=RAFT_SERVICE_URL=http://brics-raft:50051 \
  -n jga-os

# Store database passwords securely
cat > ~/.jga-os-secrets/db-passwords.env <<EOF
CA_DB_PASSWORD=$(openssl rand -base64 32)
TX_DB_PASSWORD=$(openssl rand -base64 32)
EOF

chmod 600 ~/.jga-os-secrets/*.env
```

### Step 4: Install Required Components (1 hour)

```bash
# Update kubectl
kubectl version --client

# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer

# Install cert-manager for TLS
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<'EOF'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@jga-os.example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Optional: Install Prometheus & Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false

# Verify installations
kubectl get all -n ingress-nginx
kubectl get all -n cert-manager
kubectl get all -n monitoring
```

### Step 5: Deploy BRICS Stack (1.5 hours)

```bash
# Update image reference in deployment manifest
sed -i "s|jga-os:1.0|$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/jga-os:1.0|g" k8s/deployment.yaml

# Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml

# Monitor rollout
echo "Watching StatefulSet rollout..."
kubectl rollout status statefulset/brics-raft-primary -n jga-os --timeout=10m

echo "Watching Public BRIC deployment..."
kubectl rollout status deployment/brics-public -n jga-os --timeout=10m

echo "Watching SystemB BRIC deployment..."
kubectl rollout status deployment/brics-system-b -n jga-os --timeout=10m

# Verify all pods running
kubectl get pods -n jga-os
# Expected: 9 pods in Running state (3 Raft + 3 Public + 3 SystemB)

# Check pod logs for errors
kubectl logs deployment/brics-raft-primary -n jga-os --tail=50
kubectl logs deployment/brics-public -n jga-os --tail=50
kubectl logs deployment/brics-system-b -n jga-os --tail=50
```

### Step 6: Health Check (30 min)

```bash
# Port forward to test locally
kubectl port-forward svc/brics-public 8080:80 -n jga-os &

# Test health endpoints
curl http://localhost:8080/health
curl http://localhost:8080/ready
curl http://localhost:8080/metrics

# Kill port forward
kill %1

# Check Raft quorum
kubectl exec -it brics-raft-primary-0 -n jga-os -- curl localhost:8080/api/raft/status
# Expected: 3/3 replicas healthy

# Verify persistent volume claims
kubectl get pvc -n jga-os
# Expected: All Bound
```

### Step 7: DNS Configuration (1 hour)

```bash
# Get load balancer address
export LB_DNS=$(kubectl get svc ingress-nginx-controller \
  -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Load Balancer DNS: $LB_DNS"

# Create Route 53 A record (alias to load balancer)
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.jga-os.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "'$LB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Wait for DNS propagation
for i in {1..30}; do
  echo "Checking DNS propagation ($i/30)..."
  if nslookup api.jga-os.example.com | grep -q "Address:"; then
    echo "✅ DNS resolved successfully"
    break
  fi
  sleep 10
done

# Verify HTTPS works
curl -v https://api.jga-os.example.com/health
# Should show valid certificate and 200 OK response
```

---

## Final Verification (Before Launch)

```bash
# 1. All health checks pass
kubectl get pods -n jga-os | grep Running
kubectl get ingress -n jga-os

# 2. HTTPS endpoint works
curl -v https://api.jga-os.example.com/health

# 3. TLS certificate valid
echo | openssl s_client -servername api.jga-os.example.com -connect api.jga-os.example.com:443 2>/dev/null | openssl x509 -noout -dates

# 4. Metrics flowing
curl https://api.jga-os.example.com/metrics

# 5. Database connections working
kubectl exec -it brics-raft-primary-0 -n jga-os -- npm run db:health-check

# 6. Compliance artifact valid
kubectl get secret compliance-artifact -n jga-os -o jsonpath='{.data.artifact\.json}' | base64 -d | jq .

# 7. Run launch script one more time
npm run launch
```

---

## Troubleshooting

### Pods Not Starting
```bash
# Check pod status
kubectl describe pod brics-raft-primary-0 -n jga-os

# Check logs
kubectl logs brics-raft-primary-0 -n jga-os

# Common issues:
# - ImagePullBackOff: Check ECR image pushed correctly
# - CrashLoopBackOff: Check environment variables in secrets
# - Pending: Check persistent volume claims are bound
```

### DNS Not Resolving
```bash
# Check Route 53 record exists
aws route53 list-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID | jq '.ResourceRecordSets[] | select(.Name=="api.jga-os.example.com.")'

# Check nameservers
nslookup -type=NS api.jga-os.example.com

# Clear local DNS cache
# macOS: sudo killall -HUP mDNSResponder
# Linux: sudo systemctl restart systemd-resolved
# Windows: ipconfig /flushdns
```

### Certificate Not Issuing
```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check ClusterIssuer status
kubectl describe clusterissuer letsencrypt-prod

# Check certificate object
kubectl describe cert jga-os-tls -n jga-os
```

---

## Success Criteria

✅ All checks below must be true before launch:

- [ ] `npm run security-audit` → PASSED
- [ ] `npm run load-test` → PASSED
- [ ] `npm run test:demo` → 6/6 passing
- [ ] `kubectl get pods -n jga-os` → 9 Running
- [ ] `curl https://api.jga-os.example.com/health` → 200 OK
- [ ] `dig api.jga-os.example.com` → resolves
- [ ] TLS certificate valid and not expiring soon
- [ ] Database connectivity verified
- [ ] All logs show no errors in last 1 hour

If all are TRUE: **🟢 SYSTEM READY FOR LAUNCH**

---

## Post-Launch Monitoring

```bash
# Monitor resource usage
kubectl top nodes -n jga-os
kubectl top pods -n jga-os

# Monitor error rates
kubectl logs -f deployment/brics-public -n jga-os | grep -i error

# Monitor lead processing
curl https://api.jga-os.example.com/api/metrics | jq '.leads_processed'

# Set up alerts
kubectl logs -f -n jga-os --all-containers=true | grep -i critical
```

---

**Status:** Ready for implementation  
**Estimated Duration:** 16 hours across 2 days  
**Go-Live Date:** April 27, 2026
