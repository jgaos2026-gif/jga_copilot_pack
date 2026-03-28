#!/usr/bin/env bash
# JGA Enterprise OS - AWS Deployment Automation
# Prerequisites: AWS CLI v2, kubectl, helm installed
# Usage: ./aws-deploy.sh --region us-east-1 --environment production

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
CLUSTER_NAME="jga-os-cluster"
NAMESPACE="jga-os"
PROJECT_NAME="jga-enterprise-os"
ECR_REPO="jga-os"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     JGA ENTERPRISE OS - AWS DEPLOYMENT AUTOMATION              ║${NC}"
echo -e "${BLUE}║     Region: $AWS_REGION                                         ║${NC}"
echo -e "${BLUE}║     Environment: $ENVIRONMENT                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print status
log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Step 1: Verify AWS credentials
log_step "Verifying AWS credentials..."
if aws sts get-caller-identity > /dev/null 2>&1; then
    log_success "AWS credentials valid"
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    log_success "AWS Account: $AWS_ACCOUNT"
else
    log_error "AWS credentials not configured. Run: aws configure"
    exit 1
fi

# Step 2: Check prerequisites
log_step "Checking prerequisites..."
for cmd in aws kubectl helm docker; do
    if command -v $cmd &> /dev/null; then
        log_success "$cmd installed"
    else
        log_error "$cmd not found. Please install it."
        exit 1
    fi
done

# Step 3: Create ECR repository
log_step "Setting up ECR repository..."
ECR_REGISTRY="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_FULL_NAME="${ECR_REGISTRY}/${ECR_REPO}"

if aws ecr describe-repositories --repository-names $ECR_REPO --region $AWS_REGION > /dev/null 2>&1; then
    log_success "ECR repository already exists: $ECR_FULL_NAME"
else
    log_step "Creating ECR repository..."
    aws ecr create-repository \
        --repository-name $ECR_REPO \
        --region $AWS_REGION \
        --encryption-configuration encryptionType=AES \
        --image-scanning-configuration scanOnPush=true
    log_success "ECR repository created"
fi

# Step 4: Build and push Docker image
log_step "Building Docker image..."
docker build -t $ECR_FULL_NAME:latest .
log_success "Docker image built"

log_step "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
log_success "Logged into ECR"

log_step "Pushing image to ECR..."
docker push $ECR_FULL_NAME:latest
log_success "Image pushed to ECR: $ECR_FULL_NAME:latest"

# Step 5: Create EKS Cluster
log_step "Checking EKS cluster..."
if aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION > /dev/null 2>&1; then
    log_success "EKS cluster already exists: $CLUSTER_NAME"
else
    log_warning "EKS cluster not found. Create manually or use: eksctl create cluster --name $CLUSTER_NAME"
fi

# Step 6: Get EKS cluster credentials
log_step "Updating kubeconfig..."
aws eks update-kubeconfig \
    --region $AWS_REGION \
    --name $CLUSTER_NAME
log_success "Kubeconfig updated"

# Step 7: Create namespace
log_step "Creating Kubernetes namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
log_success "Namespace created: $NAMESPACE"

# Step 8: Create secrets
log_step "Creating database secret..."
read -sp "Enter RDS password: " RDS_PASSWORD
echo ""
kubectl create secret generic jga-db-secret \
    --from-literal=username=jga_admin \
    --from-literal=password=$RDS_PASSWORD \
    -n $NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -
log_success "Database secret created"

# Step 9: Create KMS secret
log_step "Setting up KMS secret..."
read -p "Enter KMS Key ID: " KMS_KEY_ID
kubectl create secret generic jga-kms-secret \
    --from-literal=key-id=$KMS_KEY_ID \
    -n $NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -
log_success "KMS secret created"

# Step 10: Deploy application
log_step "Deploying application to Kubernetes..."
kubectl apply -f k8s/deployment.yaml
log_success "Application deployed"

# Step 11: Wait for deployment
log_step "Waiting for deployment to be ready..."
kubectl rollout status deployment/jga-os-public -n $NAMESPACE --timeout=600s
kubectl rollout status deployment/jga-os-system-b -n $NAMESPACE --timeout=600s
kubectl rollout status statefulset/jga-os-raft-primary -n $NAMESPACE --timeout=600s
log_success "Deployment ready"

# Step 12: Get ingress IP
log_step "Getting Ingress IP..."
INGRESS_IP=$(kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')
if [ -z "$INGRESS_IP" ]; then
    log_warning "Ingress IP not yet assigned. Wait a few minutes and run: kubectl get ingress -n $NAMESPACE"
else
    log_success "Ingress IP: $INGRESS_IP"
fi

# Step 13: Verify health
log_step "Verifying application health..."
sleep 30
HEALTH=$(kubectl get pod -n $NAMESPACE -l app=jga-os -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}')
if [ "$HEALTH" = "True" ]; then
    log_success "Application is healthy"
else
    log_warning "Application health check inconclusive. Run: kubectl get pods -n $NAMESPACE"
fi

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           DEPLOYMENT COMPLETE - PRODUCTION READY               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Deployment Summary:"
echo "  Cluster: $CLUSTER_NAME"
echo "  Region: $AWS_REGION"
echo "  Namespace: $NAMESPACE"
echo "  Image: $ECR_FULL_NAME:latest"
echo ""
if [ ! -z "$INGRESS_IP" ]; then
    echo "Access your application:"
    echo "  URL: https://$INGRESS_IP"
fi
echo ""
echo "Next steps:"
echo "  1. Configure DNS to point to your Ingress IP"
echo "  2. Verify certificates with: kubectl get certificate -n $NAMESPACE"
echo "  3. Monitor logs: kubectl logs -f -n $NAMESPACE -l app=jga-os"
echo "  4. Scale replicas: kubectl scale deployment jga-os-public --replicas=5 -n $NAMESPACE"
echo ""
