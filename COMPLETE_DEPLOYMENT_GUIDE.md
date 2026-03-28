# JGA Enterprise OS - Complete Git & GitHub Deployment Walkthrough

## PART 1: GIT INSTALLATION & GITHUB PUSH (30 minutes)

### Step 1.1: Install Git (Automated)

**Option A: Download & Install Directly**
```powershell
# Run in PowerShell as Administrator
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.45.0.windows.1/Git-2.45.0-64-bit.exe" -OutFile "$env:TEMP\git-installer.exe"
Start-Process "$env:TEMP\git-installer.exe" -ArgumentList '/VERYSILENT /NORESTART /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"' -Wait
# Restart terminal after installation completes
```

**Option B: Use Chocolatey (if installed)**
```powershell
choco install git -y
```

**Option C: Download from Web Browser**
- Visit: https://git-scm.com/download/win
- Run installer, accept defaults
- Restart terminal

**Verify Installation:**
```powershell
git --version
# Should output: git version 2.45.0.windows.1 (or similar)
```

---

### Step 1.2: Configure Git Identity (Automated)

```powershell
# Set global git configuration
git config --global user.name "JGA Enterprise Team"
git config --global user.email "devops@jga-os.example.com"

# Verify configuration
git config --global --list
```

---

### Step 1.3: GitHub Personal Access Token (Manual - Required)

1. **Go to GitHub:** https://github.com/settings/tokens/new
2. **Create New Token:**
   - Token name: `jga-os-deployment`
   - Scope: Check ✅ `repo` (full control of private/public repos)
   - Scope: Check ✅ `admin:repo_hook` (for webhooks)
   - Scope: Check ✅ `gist` (for gist creation)
   - Expiration: 90 days
3. **Generate & Copy:** Save the token somewhere secure
4. **Keep Safe:** This is shown only once

---

### Step 1.4: Initialize Git Repository (Automated)

```powershell
cd "C:\Users\jaysgraphicarts.org\OneDrive\Documents 1\jga_copilot_pack"

# Initialize git
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: JGA Enterprise OS - Production BRICS Architecture

- 8,200+ lines TypeScript code
- 7 BRIC layers implemented and tested
- 6/6 demo tests PASSING
- Kubernetes manifests ready
- 10 comprehensive documentation guides
- Complete security & load test frameworks
- Ready for AWS deployment"

# Create main branch
git branch -M main

# Display status
git status
```

---

### Step 1.5: Connect to GitHub & Push (Automated)

```powershell
# Add remote origin
git remote add origin https://github.com/jgaos2026/jga-os.git

# Verify remote
git remote -v

# Push to GitHub (you'll be prompted for password - use your Personal Access Token)
git push -u origin main

# When prompted:
# Username: jgaos2026 (your GitHub username)
# Password: [paste your Personal Access Token from Step 1.3]
```

---

### Step 1.6: Verify on GitHub (Manual Verification)

1. **Visit:** https://github.com/jgaos2026/jga-os
2. **Verify You See:**
   - ✅ All project files
   - ✅ README.md visible
   - ✅ 10 documentation files
   - ✅ All code folders
   - ✅ `main` branch active

**Screenshot confirmation:**
- Project shows "Public" status
- Commit count shows your initial commit
- README.md displays as project description

---

## PART 2: AWS DEPLOYMENT AUTOMATION (16 hours)

### Prerequisites
- AWS Account created
- AWS CLI v2 installed and configured (`aws configure`)
- kubectl installed
- Docker installed
- helm installed (optional)

### Step 2.1: AWS Infrastructure Setup

Read: `QUICK_START.md` (complete 16-hour guide)

**Day 1 Summary (8 hours):**
```bash
# Step 1: Verify AWS credentials
aws sts get-caller-identity

# Step 2: Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=jga-vpc}]'

# Step 3: Create subnets
aws ec2 create-subnet --vpc-id vpc-xxxxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a

# Step 4: Create RDS database
aws rds create-db-instance \
  --db-instance-identifier jga-postgresql \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username jga_admin \
  --master-user-password $(openssl rand -base64 32) \
  --allocated-storage 100 \
  --vpc-security-group-ids sg-xxxxx

# Step 5: Create KMS keys
for state in ca tx; do
  aws kms create-key --description "JGA OS $state State Encryption Key" --region us-east-1
done

# Step 6: Create ECR repository
aws ecr create-repository \
  --repository-name jga-os \
  --region us-east-1 \
  --encryption-configuration encryptionType=AES \
  --image-scanning-configuration scanOnPush=true
```

**Day 2 Summary (8 hours):**
```bash
# Step 1: Create EKS cluster
eksctl create cluster \
  --name jga-os-cluster \
  --region us-east-1 \
  --nodes 3 \
  --node-type t3.medium \
  --vpc-private-subnets subnet-xxxxx,subnet-xxxxx,subnet-xxxxx

# Step 2: Get kubeconfig
aws eks update-kubeconfig \
  --region us-east-1 \
  --name jga-os-cluster

# Step 3: Create namespace
kubectl create namespace jga-os

# Step 4: Deploy application
kubectl apply -f k8s/deployment.yaml

# Step 5: Verify deployment
kubectl get all -n jga-os
kubectl logs -f deployment/jga-os-public -n jga-os

# Step 6: Get Ingress IP
kubectl get ingress -n jga-os
```

See `QUICK_START.md` for detailed commands with explanations.

---

## PART 3: DOMAIN & DNS SETUP

### Step 3.1: Setup Route 53 (if using AWS DNS)

```bash
# Create hosted zone
aws route53 create-hosted-zone \
  --name jga-os.example.com \
  --caller-reference "jga-os-$(date +%s)"

# Add A record pointing to Ingress IP
INGRESS_IP=$(kubectl get ingress -n jga-os -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXX \
  --change-batch "{"Changes":[{"Action":"CREATE","ResourceRecordSet":{"Name":"api.jga-os.example.com","Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":"$INGRESS_IP"}]}}]}"
```

See `DNS.md` for complete domain setup guide.

---

## PART 4: POST-DEPLOYMENT VERIFICATION

### Step 4.1: Health Checks

```bash
# Check pod status
kubectl get pods -n jga-os -w

# Check service endpoints
kubectl get endpoints -n jga-os

# Test API endpoint
curl https://api.jga-os.example.com/health

# Check logs
kubectl logs -n jga-os deployment/jga-os-public --tail=50

# Monitor metrics
kubectl top nodes
kubectl top pods -n jga-os
```

### Step 4.2: Run Pre-Launch Tests

```powershell
cd "C:\Users\jaysgraphicarts.org\OneDrive\Documents 1\jga_copilot_pack"

# Demo test (verify integrity)
npm run test:demo

# Security audit (5-phase validation)
npm run security-audit

# Load test (1k contractors)
npm run load-test

# All must PASS before launch
```

---

## PART 5: LAUNCH COUNTDOWN (38 Days)

Follow: `LAUNCH_CHECKLIST.md`

Timeline: March 20 - April 27, 2026

Daily tasks provided for:
- Days 1-10: Pre-flight validation
- Days 11-20: Infrastructure hardening
- Days 21-25: Kubernetes optimization
- Days 26-27: Network & DNS verification
- Days 28-34: Security drills & incident testing
- Days 35-38: Final validation & sign-off

---

## COMPLETE COMMAND SEQUENCE (Copy & Run)

### Windows PowerShell (Install Git + Push GitHub)

```powershell
# 1. Install Git
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.45.0.windows.1/Git-2.45.0-64-bit.exe" -OutFile "$env:TEMP\git-installer.exe"
Start-Process "$env:TEMP\git-installer.exe" -ArgumentList '/VERYSILENT /NORESTART /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"' -Wait
Write-Host "Please restart PowerShell and run the next commands"

# 2. After restart, configure Git
git config --global user.name "JGA Enterprise Team"
git config --global user.email "devops@jga-os.example.com"

# 3. Navigate to project
cd "C:\Users\jaysgraphicarts.org\OneDrive\Documents 1\jga_copilot_pack"

# 4. Initialize and push
git init
git add .
git commit -m "Initial: JGA Enterprise OS - Production ready, 6/6 tests passing"
git branch -M main
git remote add origin https://github.com/jgaos2026/jga-os.git
git push -u origin main
# When prompted: username = jgaos2026, password = [your Personal Access Token]

# 5. Verify
git log --oneline
```

### Linux/WSL/CloudShell (AWS Deployment)

```bash
# 1. Configure AWS
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output (json)

# 2. Verify credentials
aws sts get-caller-identity

# 3. Create infrastructure (see QUICK_START.md for detailed commands)
# This involves 20+ AWS CLI commands across 2 days

# 4. Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml

# 5. Monitor deployment
kubectl get pods -n jga-os -w
```

---

## SUCCESS CRITERIA

✅ System is **ONLINE** when:
- [ ] GitHub repository public with all code visible
- [ ] AWS EKS cluster deployed with 3 nodes
- [ ] Kubernetes pods running (Status: Running)
- [ ] Ingress has external IP assigned
- [ ] DNS points to Ingress IP
- [ ] `curl https://api.jga-os.example.com/health` → 200 OK
- [ ] All 3 tests PASS locally:
  - `npm run test:demo` = 6/6 ✅
  - `npm run security-audit` = All Pass ✅
  - `npm run load-test` = P99 < 500ms ✅

---

## ESTIMATED TIMELINE

| Phase | Duration | Status |
|-------|----------|--------|
| Git Installation & GitHub Push | 30 min | Ready |
| AWS Infrastructure (Day 1) | 8 hours | Ready (need AWS) |
| Kubernetes Deployment (Day 2) | 8 hours | Ready (need AWS) |
| DNS & Verification | 2 hours | Ready |
| Full Launch Countdown | 38 days | Documented |

**Total to "Online":** 18.5 hours (after AWS setup starts)

---

## BLOCKERS & REQUIREMENTS

**You Must Provide:**
1. GitHub Personal Access Token (see Step 1.3)
2. AWS Account with credentials configured
3. AWS region (default: us-east-1)
4. Domain name (or use temporary AWS URL)
5. RDS password for database

**System Provides:**
1. ✅ All code (ready to push)
2. ✅ All infrastructure-as-code (ready to deploy)
3. ✅ All automation scripts (ready to run)
4. ✅ All documentation (ready to follow)

---

## QUICK REFERENCE: COMMANDS TO RUN

### To Get Online Today:
1. Install Git (download link above)
2. Run this PowerShell:
   ```powershell
   git config --global user.name "Team"; git config --global user.email "email@example.com"
   cd "C:\Users\jaysgraphicarts.org\OneDrive\Documents 1\jga_copilot_pack"
   git init; git add .; git commit -m "Initial"; git branch -M main
   git remote add origin https://github.com/jgaos2026/jga-os.git
   git push -u origin main
   ```
3. Verify: https://github.com/jgaos2026/jga-os

### To Deploy to AWS:
1. Complete QUICK_START.md steps (16 hours)
2. Run deployment.yaml
3. Wait for DNS propagation
4. System is **ONLINE**

---

## SUPPORT

All documentation in project folder:
- Git help: `GIT_SETUP_INSTRUCTIONS.md`
- AWS help: `QUICK_START.md`
- Deployment help: `DEPLOYMENT.md`
- Launch help: `LAUNCH_CHECKLIST.md`
- Architecture help: `brics/ARCH.md`

