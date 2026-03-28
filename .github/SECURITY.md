# Security Policy

## Reporting Security Vulnerabilities

**Do NOT open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability, please report it by emailing **security@jaysgraphicarts.org** with:

- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (if you have one)

**Please include:**
- Your name and affiliation
- The affected component(s)
- Any related system law violations

### Response Timeline

We aim to:
- **Acknowledge** your report within 48 hours
- **Provide updates** every 7 days
- **Release a patch** within 30 days of confirmation
- **Publish a security advisory** once patched

## Supported Versions

| Version | Supported | Status |
|---------|-----------|--------|
| 1.x     | ✅ Yes    | Actively maintained |
| 0.x     | ❌ No     | Deprecated |

Only the latest major version receives security updates.

## Security Practices in This Project

### 8 System Laws (Security-Focused)

This project enforces these security principles:

1. **Unidirectional Public Boundary** - Prevents unauthorized inbound access
2. **Spine Has No Customer Data** - Reduces attack surface for policy engine
3. **System B Metadata-Only** - PII never exposed in middleware layer
4. **State BRIC Isolation** - Geographic data isolation prevents mass compromise
5. **Owners Room Requires MFA + Dual-Auth** - Administrative access hardened
6. **Compliance Gate Blocks Business Calls** - Regulatory enforcement point
7. **Stitch Brick Corruption Detection** - Detects tampering with consensus
8. **Zero-Trust Inter-BRIC Communication** - Explicit allow, deny by default

### Code Security Requirements

All contributions must:

- ✅ Pass security linting
- ✅ Include security tests for sensitive operations
- ✅ Document security implications
- ✅ Comply with all 8 system laws
- ✅ Use server-side validation (never trust client input)
- ✅ Implement proper authentication/authorization
- ✅ Use parameterized queries (never raw SQL)
- ✅ Encrypt sensitive data at rest and in transit
- ✅ Follow OWASP ASVS standards

### Dependency Management

- Dependencies are audited weekly
- Security patches are prioritized
- Outdated packages trigger alerts
- Major updates require testing

**To check dependencies:**
```bash
npm audit
npm audit fix
```

### Data Protection

- PII is stored only in isolated state BRICs
- All PII at rest uses encryption
- All PII in transit uses TLS 1.3+
- Logs never contain sensitive data
- Backups are encrypted and access-controlled

### Access Control

- All APIs require authentication
- Row-level security enforced in Supabase
- Admin operations require MFA
- Audit logging on all sensitive actions
- Default-deny for inter-service communication

### Incident Response

If a security incident occurs:
1. Impact is immediately assessed
2. Affected users are notified within 24 hours
3. Root cause analysis is conducted
4. Patches are deployed
5. Post-incident review is documented

## Compliance

This project aligns with:
- **NIST AI RMF** (AI Risk Management Framework)
- **OWASP LLM Top 10** (Large Language Model Security)
- **OWASP ASVS** (Application Security Verification Standard)
- **SOC 2 Type II** readiness
- **Industry standards** for data protection

## Software Bill of Materials (SBOM)

An SBOM is maintained for all dependencies:
```bash
npm ls --depth=0  # View direct dependencies
npm audit         # Check for vulnerabilities
```

Generated SBOM: See `sbom.json` (generated during deployment)

## Vulnerability Disclosure

Once a patch is released:
1. Security advisory is published
2. GitHub security alerts are issued
3. Users are guided to update
4. Credit is given to reporter (if desired)

## PGP Key

For enhanced security, you may encrypt sensitive reports using:
```
Coming soon - PGP key will be available for enhanced encryption
```

## Questions?

Email **security@jaysgraphicarts.org** for security policy questions.

---

**Last Updated:** March 2026

Thank you for helping keep JGA Enterprise OS secure! 🔒
