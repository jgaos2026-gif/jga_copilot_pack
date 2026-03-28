# JGA BRICS OS - Domain & DNS Configuration

## Overview

This document covers all DNS, domain, and edge network configuration required for the April 27, 2026 launch.

**Primary Domain:** `api.jga-os.example.com`  
**CDN Domain:** `cdn.jga-os.example.com`  
**Status Page:** `status.jga-os.example.com`  
**Docs Domain:** `docs.jga-os.example.com`

---

## Domain Registration

### Option 1: AWS Route 53 (Recommended)

```bash
# 1. Register domain through Route 53
aws route53domains register-domain \
  --domain-name jga-os.example.com \
  --duration-in-years 5 \
  --auto-renew \
  --privacy-protected

# 2. Create hosted zone (auto-created with domain)
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name jga-os.example.com \
  --query 'HostedZones[0].Id' --output text)

echo $HOSTED_ZONE_ID  # Store for later reference
```

### Option 2: External Registrar (GoDaddy, Namecheap, etc.)

```bash
# Update nameservers to Route 53:
# Nameserver 1: [ns-xxx].awsdns-xx.com
# Nameserver 2: [ns-xxx].awsdns-xx.com
# Nameserver 3: [ns-xxx].awsdns-xx.com
# Nameserver 4: [ns-xxx].awsdns-xx.com

# Get nameservers from Route 53
aws route53 get-hosted-zone --id $HOSTED_ZONE_ID \
  --query 'DelegationSet.NameServers' --output text
```

---

## DNS Record Configuration

### 1. Primary API Endpoint

```bash
# Get load balancer DNS name from Kubernetes
export LB_DNS=$(kubectl get svc -n jga-os \
  --selector=app=brics-api \
  --output json | jq '.items[0].status.loadBalancer.ingress[0].hostname' -r)

echo "Load Balancer: $LB_DNS"

# Create A record (Alias to Load Balancer)
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

# Verify DNS resolution (wait 10-60 seconds for propagation)
nslookup api.jga-os.example.com
dig api.jga-os.example.com
```

**Record Details:**
- **Name:** api.jga-os.example.com
- **Type:** A (or AAAA for IPv6)
- **Target:** AWS Network Load Balancer DNS
- **TTL:** 60 seconds (allow rapid failover)
- **Routing:** Simple (single target)

---

### 2. CDN Edge Distribution

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "'$(date +%s)'",
    "Comment": "JGA BRICS OS CDN",
    "Origins": {
      "Items": [{
        "Id": "jga-api-origin",
        "DomainName": "'$LB_DNS'",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only"
        }
      }],
      "Quantity": 1
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "jga-api-origin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
    },
    "Enabled": true
  }'

# Get CloudFront domain name
export CF_DNS=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[0].DomainName' --output text)

echo "CloudFront Distribution: $CF_DNS"
```

### 3. CDN Alias Record

```bash
# Create CNAME record pointing to CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "cdn.jga-os.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "'$CF_DNS'"}]
      }
    }]
  }'
```

---

### 4. Health Check Record

```bash
# Create health check for load balancer
aws route53 create-health-check \
  --health-check-config '{
    "Type": "HTTPS",
    "ResourcePath": "/health",
    "FullyQualifiedDomainName": "'$LB_DNS'",
    "Port": 443,
    "RequestInterval": 30,
    "FailureThreshold": 3
  }'

# Add health check to A record
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.jga-os.example.com",
        "Type": "A",
        "SetIdentifier": "primary",
        "Failover": "PRIMARY",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "'$LB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

---

### 5. Status Page & Documentation

```bash
# Status Page (S3 + CloudFront)
aws s3 mb s3://jga-os-status-page --region us-east-1

# Create status page index.html
cat > status.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>JGA BRICS OS - Status</title>
    <style>
        body { font-family: Arial; margin: 40px; }
        .status-ok { color: green; font-size: 20px; }
    </style>
</head>
<body>
    <h1>JGA Enterprise OS Status</h1>
    <p class="status-ok">✅ System Operational</p>
    <p>All layers online and healthy.</p>
    <a href="https://api.jga-os.example.com/health">API Health Check</a>
</body>
</html>
EOF

# Upload to S3
aws s3 cp status.html s3://jga-os-status-page/

# Create CloudFront distribution for status page
aws cloudfront create-distribution \
  --distribution-config '{
    "CallerReference": "'$(date +%s)'",
    "Comment": "JGA BRICS OS Status Page",
    "Origins": {
      "Items": [{
        "Id": "jga-status-s3",
        "DomainName": "jga-os-status-page.s3.us-east-1.amazonaws.com",
        "S3OriginConfig": {}
      }],
      "Quantity": 1
    },
    "DefaultCacheBehavior": {
      "TargetOriginId": "jga-status-s3",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": ["GET", "HEAD"],
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
    },
    "Enabled": true
  }'

# Get CloudFront domain for status page
export STATUS_CF_DNS=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[-1].DomainName' --output text)

# Add status page DNS record
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "status.jga-os.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "'$STATUS_CF_DNS'"}]
      }
    }]
  }'

# Documentation site (optional - GitHub Pages or similar)
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "docs.jga-os.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "jga-os-docs.pages.dev"}]
      }
    }]
  }'
```

---

## TLS/SSL Certificate Configuration

### 1. Let's Encrypt (Automated via cert-manager)

```bash
# Install cert-manager (if not already installed)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt production
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
    - dns01:
        route53:
          region: us-east-1
          hostedZoneID: $HOSTED_ZONE_ID
EOF

# Ingress will automatically request certificate
# cert-manager handles renewal automatically (30 days before expiry)

# Monitor certificate provisioning
kubectl get cert -n jga-os -w
kubectl describe cert jga-os-tls -n jga-os
```

### 2. Certificate Validation

```bash
# Verify certificate chain
openssl s_client -connect api.jga-os.example.com:443 -showcerts

# Check certificate expiration
echo | openssl s_client -servername api.jga-os.example.com -connect api.jga-os.example.com:443 2>/dev/null | openssl x509 -noout -dates

# Expected output:
# notBefore=Mar 20 00:00:00 2026 GMT
# notAfter=Jun 18 23:59:59 2026 GMT
```

### 3. Certificate Pinning (Advanced)

```bash
# For high-security applications, pin the certificate
# Add to Kubernetes Ingress annotations:
# cert-manager.io/issue-temporary-certificate: "true"
# kubernetes.io/ingress.class: "nginx"
# nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
```

---

## DNS Records Summary

| Record Type | Name | Value | TTL |
|---|---|---|---|
| A (Alias) | api.jga-os.example.com | Load Balancer DNS | 60s |
| CNAME | cdn.jga-os.example.com | CloudFront Domain | 300s |
| CNAME | status.jga-os.example.com | CloudFront (S3) | 300s |
| CNAME | docs.jga-os.example.com | GitHub Pages | 300s |
| MX | jga-os.example.com | mail.jga-os.example.com (optional) | 3600s |
| TXT | jga-os.example.com | v=spf1 include:_spf.google.com ~all | 3600s |

---

## Verification & Testing

### 1. DNS Propagation Check

```bash
# Check DNS resolution worldwide
# Use: https://dnschecker.org
# Or command line:

for ns in 8.8.8.8 1.1.1.1 208.67.222.222; do
  echo "Checking with $ns:"
  dig @$ns api.jga-os.example.com +short
done

# Expected: Load balancer IP address
```

### 2. SSL/TLS Verification

```bash
# Check SSL certificate
curl -v https://api.jga-os.example.com/health

# Expected output:
# * Server certificate:
# *  subject: CN=api.jga-os.example.com
# *  issuer: C=US, O=Let's Encrypt, CN=R3
# *  SSL certificate verify ok.
```

### 3. Performance Testing

```bash
# Check response time from multiple geolocations
# Use: https://www.pingdom.com
# Or local:

time curl https://api.jga-os.example.com/health

# Expected: < 100ms from same region
```

---

## Failover & High Availability

### 1. Multi-Region Setup (Advanced)

```bash
# Create secondary load balancer in different region
# Point to same RDS databases (read replicas)

# Weighted routing in Route 53
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "api.jga-os.example.com",
          "Type": "A",
          "SetIdentifier": "primary-us-east-1",
          "Weight": 100,
          "AliasTarget": {
            "HostedZoneId": "Z35SXDOTRQ7X7K",
            "DNSName": "'$LB_DNS_PRIMARY'",
            "EvaluateTargetHealth": true
          }
        }
      },
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "api.jga-os.example.com",
          "Type": "A",
          "SetIdentifier": "secondary-us-west-2",
          "Weight": 0,
          "AliasTarget": {
            "HostedZoneId": "Z1234567890ABC",
            "DNSName": "'$LB_DNS_SECONDARY'",
            "EvaluateTargetHealth": true
          }
        }
      }
    ]
  }'
```

### 2. Automatic Failover

```bash
# Route 53 health checks will automatically failover if primary is down
# Monitor with:
kubectl get hpa -n jga-os -w
```

---

## Monitoring & Maintenance

### 1. DNS Query Monitoring

```bash
# Monitor DNS queries with CloudWatch
aws cloudwatch put-metric-alarm \
  --alarm-name dns-high-query-count \
  --alarm-description "Alert if DNS queries exceed threshold" \
  --metric-name QueryCount \
  --namespace AWS/Route53 \
  --statistic Sum \
  --period 300 \
  --threshold 10000 \
  --comparison-operator GreaterThanThreshold
```

### 2. Certificate Expiration Alerts

```bash
# cert-manager automatically renews certificates 30 days before expiry
# But set CloudWatch alarm as backup:

aws cloudwatch put-metric-alarm \
  --alarm-name cert-expiration-warning \
  --alarm-description "Alert 7 days before certificate expiry" \
  --metric-name CertificateDaysToExpiry \
  --namespace AWS/CertificateManager \
  --statistic Minimum \
  --period 86400 \
  --threshold 7 \
  --comparison-operator LessThanThreshold
```

### 3. DNS Zone Transfer Logs

```bash
# Enable query logging for security
aws route53 create-query-logging-config \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --cloud-watch-logs-log-group-arn arn:aws:logs:us-east-1:ACCOUNT:log-group:/aws/route53/jga-os

# Query logs will be stored in CloudWatch Logs
# Use for security auditing and troubleshooting
```

---

## Post-Launch DNS Tasks

### 1. Weekly Checks
- [ ] DNS resolution working globally
- [ ] TLS certificate valid and not expiring soon
- [ ] Load balancer health checks passing
- [ ] CDN cache hit rate > 80%

### 2. Monthly Tasks
- [ ] Review DNS query logs for anomalies
- [ ] Update DNS records if infrastructure changes
- [ ] Test failover mechanisms
- [ ] Validate certificate renewal

### 3. Security Checklist
- [ ] DNSSEC enabled (optional but recommended)
- [ ] DNS rate limiting configured
- [ ] DDoS protection via CloudFront
- [ ] Access logs being collected

---

## Troubleshooting

### DNS Not Resolving

```bash
# Check nameservers are pointing to Route 53
nslookup -type=NS jga-os.example.com

# Expected: AWS nameservers
# If different, update at registrar

# Clear local DNS cache
# Linux: sudo systemctl restart systemd-resolved
# macOS: sudo killall -HUP mDNSResponder
# Windows: ipconfig /flushdns
```

### Certificate Not Issued

```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Verify Route 53 credentials
kubectl get secret -n cert-manager

# Check DNS propagation
dig _acme-challenge.api.jga-os.example.com
```

### Slow DNS Resolution

```bash
# Check Route 53 query metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Route53 \
  --metric-name QueryCount \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average

# If high: increase TTL to reduce lookup frequency
```

---

## Final Verification Checklist

- [ ] Domain registered and nameservers configured
- [ ] A record pointing to load balancer (TTL: 60s)
- [ ] CNAME records for CDN, status, docs
- [ ] TLS certificate issued and valid
- [ ] Certificate auto-renewal configured
- [ ] Health checks enabled
- [ ] DNS resolves globally
- [ ] HTTPS redirects working
- [ ] Failover mechanism tested
- [ ] Monitoring and alerts configured

**Status:** Ready for production  
**Last Updated:** March 20, 2026
