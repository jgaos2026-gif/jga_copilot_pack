# JGA BRICS OS - Launch Checklist (April 27, 2026)

**Target Launch Date:** April 27, 2026  
**Days to Launch:** 38 (from March 20, 2026)  
**Status:** Code Complete ✅ | Infrastructure Ready ✅ | Validation Pending ⏳

---

## Pre-Flight Validation (Days 1-10)

- [ ] **Security Audit Passing**
  ```bash
  npm run security-audit
  # Expected: ✅ PASSED (0 critical failures)
  ```
  - No secrets leaked
  - No critical vulnerabilities
  - All 8 system laws enforced
  - Go/no-go: APPROVED

- [ ] **Load Test Passed**
  ```bash
  npm run load-test
  # Expected: ✅ PASSED
  ```
  - Throughput: > 5 leads/second
  - P99 Latency: < 500ms
  - Error Rate: < 1%
  - 1,000 contractors provisioned successfully

- [ ] **Demo Tests Still Passing**
  ```bash
  npm run test:demo
  # Expected: DEMO.1-6 all passing (6/6 ✅)
  ```

- [ ] **Code Coverage Verified**
  - Public BRIC: 100% stateless
  - SystemB BRIC: 100% metadata-only
  - Spine BRIC: 100% law enforcement
  - State BRIC: 100% isolated per state
  - Owners Room: 100% MFA + dual-auth
  - Overseer: 100% incident detection
  - Compliance: 100% gate enforcement

- [ ] **Docker Image Built & Pushed**
  ```bash
  docker build -t jga-os:1.0 .
  docker tag jga-os:1.0 [ECR]/jga-os:1.0
  docker push [ECR]/jga-os:1.0
  # Verify: aws ecr describe-images --repository-name jga-os
  ```

---

## Infrastructure Setup (Days 11-20)

### AWS Account Prep
- [ ] AWS Account created and access configured
- [ ] IAM policies for EKS, RDS, KMS configured
- [ ] Billing alerts configured ($10k/month limit)
- [ ] Backup and DR plan in place

### EKS Cluster
- [ ] EKS cluster created (jga-os-prod, 3+ nodes)
  ```bash
  eksctl create cluster --name jga-os-prod --region us-east-1 --nodes 3
  ```
- [ ] OIDC provider associated for Pod IAM
- [ ] Worker nodes passed security baseline
- [ ] Cluster autoscaling configured (min: 3, max: 10)
- [ ] Network policies enforced

### Database Setup
- [ ] RDS PostgreSQL created for CA state (100Gi, encrypted, multi-AZ)
  ```bash
  # Database: jga-os-state-ca
  ```
- [ ] RDS PostgreSQL created for TX state (100Gi, encrypted, multi-AZ)
  ```bash
  # Database: jga-os-state-tx
  ```
- [ ] Database credentials stored in Kubernetes Secrets
- [ ] Backup policy: daily, 30-day retention
- [ ] Read replicas configured for HA

### Storage Setup
- [ ] PersistentVolumes created (50Gi Raft data per node)
- [ ] State BRIC storage (100Gi each for CA, TX)
- [ ] Storage classes configured (gp2, encrypted)
- [ ] Snapshots scheduled (daily)

### KMS Encryption Keys
- [ ] Master key created per state (CA and TX)
- [ ] Key rotation policy: 90 days
- [ ] Key access policies restricted to EKS IRSA role
- [ ] Keys stored in AWS Secrets Manager

---

## Kubernetes Deployment (Days 21-25)

### Pre-Deployment
- [ ] Namespace `jga-os` created
  ```bash
  kubectl create namespace jga-os
  ```
- [ ] Secrets created (KMS keys, database URLs)
  ```bash
  kubectl create secret generic kms-keys \
    --from-literal=ca-key-id=[ARN] \
    --from-literal=tx-key-id=[ARN] \
    -n jga-os
  ```
- [ ] ConfigMap created with environment variables
- [ ] Image registry credentials configured

### Installation
- [ ] NGINX Ingress Controller installed
- [ ] cert-manager installed with ClusterIssuer
- [ ] Prometheus + Grafana deployed
- [ ] ServiceMonitor configured for metrics collection
- [ ] Kubernetes manifest applied
  ```bash
  kubectl apply -f k8s/deployment.yaml
  ```

### Verification
- [ ] All pods running (3 Raft + 3 Public + 3 SystemB)
  ```bash
  kubectl get pods -n jga-os | grep Running
  # Expected: 9 pods all Running
  ```
- [ ] StatefulSet rollout successful
  ```bash
  kubectl rollout status statefulset/brics-raft-primary -n jga-os
  ```
- [ ] Health checks passing
  ```bash
  kubectl exec -it brics-raft-primary-0 -n jga-os -- curl localhost:8080/health
  # Expected: 200 OK
  ```
- [ ] Metrics flowing to Prometheus
  ```bash
  kubectl get servicemonitor -n jga-os
  # Expected: servicemonitor active
  ```
- [ ] Persistent volumes mounted
  ```bash
  kubectl get pv -n jga-os
  # Expected: All Bound
  ```

---

## Network & Domain Setup (Days 26-27)

### DNS Configuration
- [ ] Domain registered: `api.jga-os.example.com`
- [ ] Route 53 hosted zone created
- [ ] A record created (alias to NLB)
  ```bash
  dig api.jga-os.example.com
  # Expected: resolves to load balancer IP
  ```
- [ ] Health checks configured in Route 53
- [ ] CNAME records for CDN, status, docs created

### TLS/SSL
- [ ] Let's Encrypt ClusterIssuer deployed
- [ ] Certificate issued and valid
  ```bash
  kubectl get cert -n jga-os
  # Expected: jga-os-tls READY=True
  ```
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Certificate renewal automated (30 days before expiry)

### Testing URL Access
- [ ] `https://api.jga-os.example.com/health` → 200 OK
- [ ] `https://api.jga-os.example.com/ready` → 200 OK
- [ ] `https://api.jga-os.example.com/metrics` → Prometheus metrics
- [ ] HTTPS only enforced (no HTTP)

---

## Security Hardening (Days 28-30)

### Network Security
- [ ] NetworkPolicy enforced (deny ingress except Ingress controller)
- [ ] Pod security policy applied
- [ ] RBAC roles configured (SA per BRIC)
- [ ] Service accounts restricted permissions

### Data Security
- [ ] Database encryption at rest enabled
- [ ] TLS encryption in transit enforced
- [ ] API rate limiting configured (1000 req/sec)
- [ ] Input validation enforced on all endpoints

### Access Control
- [ ] Owners Room MFA configured
- [ ] Dual-auth bypass disabled
- [ ] API keys rotated monthly
- [ ] SSH access disabled on nodes

### Compliance
- [ ] Compliance artifact valid and loaded
  ```bash
  kubectl get secret compliance-artifact -n jga-os
  ```
- [ ] Audit logs being collected
- [ ] NIST AI RMF framework ingested
- [ ] OWASP LLM Top 10 mitigations verified

---

## Incident Simulation (Days 31-34)

- [ ] **Corruption Scenario:** Corrupt node, verify auto-healing
  ```bash
  # Demo.1: Corruption detected on primary
  # Demo.2: Merkle path validation works
  # Demo.3: Replicas detect corruption
  # Demo.4: Quorum consensus on healing
  # Demo.5: Leader re-election on corruption
  # Demo.6: Full node reprovisioning
  npm run test:demo
  # Expected: All 6 passing
  ```

- [ ] **Credential Leak Scenario:** Inject test credential, verify detection
  - Rotate credentials within 15 minutes
  - Verify no unauthorized access occurred
  - Update audit logs

- [ ] **DDoS Scenario:** CloudFront absorbs attack
  - Monitor metrics (requests/sec)
  - Verify rate limiting engaged
  - Check error distribution

- [ ] **Compliance Violation:** Trigger gate closure
  - Verify business calls rejected
  - Confirm escrow holds pending
  - Verify gate can be reopened after fix

---

## Final Sign-Off (Day 35)

### Technical Lead Checklist
- [ ] All code reviewed and approved
- [ ] No known critical bugs
- [ ] Performance meets targets (P99 < 500ms)
- [ ] Security audit passed
- [ ] Incident drills successful

### Operations Lead Checklist
- [ ] Runbooks documented and tested
- [ ] On-call team trained
- [ ] Escalation procedures defined
- [ ] Rollback procedure tested and < 30 minutes

### Legal/Compliance Checklist
- [ ] NIST AI RMF compliance verified
- [ ] Data residency verified (CA/TX states)
- [ ] Privacy policy updated
- [ ] Terms of service reviewed
- [ ] Compliance artifact signed

### Business Lead Checklist
- [ ] Contractor training complete
- [ ] Marketing materials ready
- [ ] Sales team trained
- [ ] Support team ready to handle calls
- [ ] Escalation contacts configured

### Executive Sign-Off
- [ ] CEO approval
- [ ] Board approval (if required)
- [ ] Go-live decision finalized

---

## Launch Day (April 27, 2026)

### Morning Checks (6:00 AM)
- [ ] All systems green (health checks passing)
  ```bash
  kubectl get pods -n jga-os
  kubectl get svc -n jga-os
  kubectl get ingress -n jga-os
  ```
- [ ] No error spikes in logs
  ```bash
  kubectl logs deployment/brics-raft-primary -n jga-os | tail -100 | grep -i error
  ```
- [ ] DNS resolving correctly
  ```bash
  dig api.jga-os.example.com
  ```
- [ ] TLS certificate valid
  ```bash
  curl -v https://api.jga-os.example.com/health
  ```
- [ ] Database connections working
  - CA: SELECT COUNT(*) FROM contractors
  - TX: SELECT COUNT(*) FROM contractors
- [ ] Metrics flowing to Prometheus
- [ ] Backups completed successfully
- [ ] On-call team ready

### Traffic Cutover (8:00 AM)
- [ ] Update DNS to point to production load balancer
- [ ] Monitor traffic gradual ramp:
  - 8:00-9:00 AM: 1% traffic (50 leads)
  - 9:00-10:00 AM: 10% traffic (500 leads)
  - 10:00 AM: 100% traffic (full load)
- [ ] Monitor error rates (target: < 0.1%)
- [ ] Monitor latency (target: p99 < 500ms)
- [ ] Monitor CPU/memory (target: < 70%)

### Post-Launch (Throughout Day)
- [ ] Hourly status checks for first 8 hours
- [ ] Daily status checks for first 30 days
- [ ] Monitor contractor onboarding (100+ expected day 1)
- [ ] No critical incidents

### If Issues Occur
- [ ] Execute incident response (< 1 hour resolution target)
- [ ] Document root cause
- [ ] Implement fix and redeploy
- [ ] Run security audit post-incident

---

## Post-Launch (30 Days)

### Week 1
- [ ] Monitor system stability (uptime > 99.9%)
- [ ] Analyze contractor feedback
- [ ] Performance tuning if needed
- [ ] First security scan with penetration tester

### Week 2-4
- [ ] Dependency security updates
- [ ] Burn-down operational issues
- [ ] Team retrospective and lessons learned
- [ ] Update runbooks based on real incidents
- [ ] Plan Phase 2 features (additional states, etc.)

### Ongoing
- [ ] Monthly security audits
- [ ] Quarterly penetration testing
- [ ] Annual compliance certification
- [ ] Continuous monitoring and alerting

---

## Critical Contact Information

**On-Call Team:**
- Engineering Lead: [name] - [phone]
- Operations Lead: [name] - [phone]
- Security Lead: [name] - [phone]
- Executive Lead: [name] - [phone]

**Escalation:**
- P1 Critical: ops-team@jga-os.example.com
- P2 High: tech-lead@jga-os.example.com
- P3 Medium: engineering@jga-os.example.com

**Documentation:**
- Architecture: `brics/ARCH.md`
- Runbooks: `brics/april-keys/APRIL.KEYS.md`
- Deployment: `DEPLOYMENT.md`
- DNS: `DNS.md`

---

## Time Remaining

**Today:** March 20, 2026 (Day 0)  
**Days Remaining:** 38  
**Target Launch:** April 27, 2026

> ⏳ **Status: ON TRACK**  
> All code complete. Validation and infrastructure deployment in progress.

---

## Quick Command Reference

```bash
# Status checks
kubectl get all -n jga-os
kubectl get events -n jga-os --sort-by='.lastTimestamp'

# View logs
kubectl logs -f deployment/brics-public -n jga-os
kubectl logs -f statefulset/brics-raft-primary -n jga-os

# Access Prometheus metrics
kubectl port-forward svc/prometheus 9090:9090 -n monitoring

# Access Grafana dashboards
kubectl port-forward svc/grafana 3000:80 -n monitoring

# Check certificate status
kubectl get cert -o wide -n jga-os
kubectl describe cert jga-os-tls -n jga-os

# Database backup
kubectl exec jga-os-state-ca-0 -- pg_dump -U postgres > state-ca-backup.sql

# Incident: Manual stitch brick heal
kubectl exec -it brics-raft-primary-0 -n jga-os -- npm run heal:stitch-brick

# Incident: Close compliance gate
kubectl exec -it brics-spine-0 -n jga-os -- npm run gate:close

# Incident: Rollback deployment
kubectl rollout undo deployment/brics-public -n jga-os
```

---

**Last Updated:** March 20, 2026  
**Next Update:** March 25, 2026 (Infrastructure milestone check)
