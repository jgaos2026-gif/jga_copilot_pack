# Contributing to JGA Enterprise OS

Thank you for your interest in contributing to JGA Enterprise OS! This document outlines the guidelines for contributing to the project.

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

## Before You Start

### Understand the 8 System Laws

JGA Enterprise OS is built on 8 non-negotiable system laws. **All contributions must comply with these:**

1. **Unidirectional Public Boundary** - Public BRIC only outbound, never inbound
2. **Spine Has No Customer Data** - Policy engine isolated from PII/sensitive data
3. **System B Metadata-Only** - Capture layer cannot store customer details
4. **State BRIC Complete Isolation** - CA data ≠ TX data (separate keys, DBs, clusters)
5. **Owners Room Requires MFA + Dual-Auth** - Administrative access locked down
6. **Compliance Gate Blocks Business Calls** - Regulation violations = auto call block
7. **Stitch Brick Detects & Heals Corruption** - SHA-256 + Merkle + 3-node consensus
8. **Zero-Trust Inter-BRIC Communication** - Every call denied by default, explicit enable only

### Review Key Documentation

- [SYSTEM_README.md](../SYSTEM_README.md) - Architecture and system design
- [PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md) - Deployment standards
- [00-READ-ME-FIRST.md](../00-READ-ME-FIRST.md) - Quick overview

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/jga-enterprise-os.git
   cd jga-enterprise-os
   ```
3. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```

## Making Changes

### Code Style

- Use **TypeScript** exclusively
- Follow the existing code style and patterns
- Use descriptive variable and function names
- Keep functions small and focused
- Add comments for complex logic
- No console.log in production code

### Testing Requirements

**All contributions must include tests:**

```bash
# Run unit tests
npm run test:run

# Run specific test suite
npm run test:stitch

# Run all tests
npm run test:all
```

Minimum test coverage expectations:
- Critical business logic: 100%
- API endpoints: 100%
- State mutations: 100%
- Infrastructure: 80%

### Commit Message Guidelines

Use clear, descriptive commit messages:

```
[TYPE] Brief description (50 chars)

Detailed explanation of the change (72 chars per line).

Fixes #123
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `test:` Test additions/updates
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `chore:` Build/tooling changes
- `security:` Security fixes

Example:
```
feat: Add MFA verification to Owners Room login

Implements TOTP-based MFA with backup codes for
administrative access, complying with System Law #5.

Tests added for happy path and edge cases.
Closes #456
```

## Pull Request Process

1. **Update your branch** with latest main:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub
   - Use the provided PR template
   - Link to any related issues
   - Verify all system laws are documented
   - Request review from appropriate maintainers

4. **Address review feedback**
   - Be responsive to comments
   - Clarify design decisions when needed
   - Update code and tests as requested
   - Re-request review once changes are made

5. **Merge guidelines**
   - PRs require approval from code owners
   - All CI checks must pass
   - Squash commits into meaningful units before merge
   - Verify compliance with all 8 system laws

## Reporting Issues

### Security Issues

**Do not** open a public GitHub issue for security vulnerabilities. See [SECURITY.md](./SECURITY.md).

### Bug Reports

Use the bug report template when opening issues:
- Include clear steps to reproduce
- Describe expected vs actual behavior
- Provide environment details
- Include relevant logs or screenshots
- Reference affected System Laws if applicable

### Feature Requests

Use the feature request template:
- Clearly describe the proposed feature
- Explain the motivation and use case
- Outline acceptance criteria
- Discuss System Law compliance

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Run tests in watch mode
npm run test

# Start development server
npm run dev

# Run security audit
npm run security-audit

# Run specific test suite
npm run test:stitch
```

### Database Changes (Supabase)

If your changes involve database schema:
1. Create a migration in `supabase/migrations/`
2. Test the migration locally
3. Document schema changes in [SUPABASE.md](../docs/SUPABASE.md)
4. Include migration instructions in PR description

### Infrastructure Changes

If your changes affect infrastructure:
1. Update relevant k8s manifests in `k8s/`
2. Test in local Docker environment if possible
3. Document changes clearly
4. Request infrastructure review

## Documentation

### When to Document

Update documentation for:
- New public APIs or modules
- Configuration changes
- Architectural decisions (ADR)
- Deployment procedures
- System Law implications

### Documentation Standards

- Use clear, active voice
- Include code examples for complex features
- Keep README.md as the entry point
- Use SYSTEM_README.md for architecture
- Create ADRs in `docs/adr/` for major decisions

Example ADR filename: `docs/adr/0001-describe-decision.md`

## Legal

By contributing to JGA Enterprise OS, you agree that:
- Your contributions will be licensed under the same license as the project
- You have the right to license your contributions
- Your contributions comply with all applicable laws

## Questions?

- Open a discussion on GitHub Discussions
- Check existing issues and documentation
- Review past PRs for similar changes

## Recognition

Contributors will be recognized in:
- CONTRIBUTING.md (this file)
- Release notes
- GitHub contributor graph

Thank you for contributing! 🎉
