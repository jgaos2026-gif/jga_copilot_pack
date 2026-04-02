// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import {
  PUBLIC_JGA_VERSIONS,
  JGA_VERSION_REGISTRY,
  DEFAULT_JGA_VERSION,
  isJgaVersion,
  getJgaVersionConfig,
} from '../src/config/jgaVersion';

describe('PUBLIC_JGA_VERSIONS', () => {
  it('contains exactly four versions', () => {
    expect(PUBLIC_JGA_VERSIONS).toHaveLength(4);
  });

  it('includes production, staging, beta, and legacy', () => {
    expect(PUBLIC_JGA_VERSIONS).toContain('production');
    expect(PUBLIC_JGA_VERSIONS).toContain('staging');
    expect(PUBLIC_JGA_VERSIONS).toContain('beta');
    expect(PUBLIC_JGA_VERSIONS).toContain('legacy');
  });
});

describe('JGA_VERSION_REGISTRY', () => {
  it('has an entry for every public version', () => {
    for (const version of PUBLIC_JGA_VERSIONS) {
      expect(JGA_VERSION_REGISTRY[version]).toBeDefined();
    }
  });

  it('every entry has the correct shape', () => {
    for (const version of PUBLIC_JGA_VERSIONS) {
      const config = JGA_VERSION_REGISTRY[version];
      expect(config.key).toBe(version);
      expect(typeof config.label).toBe('string');
      expect(config.public).toBe(true);
      expect(typeof config.basePath).toBe('string');
      expect(typeof config.featureFlags.newHero).toBe('boolean');
      expect(typeof config.featureFlags.newCheckout).toBe('boolean');
      expect(typeof config.featureFlags.systemBPreview).toBe('boolean');
    }
  });

  it('production has all feature flags enabled', () => {
    const { featureFlags } = JGA_VERSION_REGISTRY.production;
    expect(featureFlags.newHero).toBe(true);
    expect(featureFlags.newCheckout).toBe(true);
    expect(featureFlags.systemBPreview).toBe(true);
  });

  it('legacy has all feature flags disabled', () => {
    const { featureFlags } = JGA_VERSION_REGISTRY.legacy;
    expect(featureFlags.newHero).toBe(false);
    expect(featureFlags.newCheckout).toBe(false);
    expect(featureFlags.systemBPreview).toBe(false);
  });

  it('production basePath is /', () => {
    expect(JGA_VERSION_REGISTRY.production.basePath).toBe('/');
  });

  it('non-production versions have a non-root basePath', () => {
    for (const version of PUBLIC_JGA_VERSIONS) {
      if (version !== 'production') {
        expect(JGA_VERSION_REGISTRY[version].basePath).not.toBe('/');
      }
    }
  });
});

describe('DEFAULT_JGA_VERSION', () => {
  it('is "production"', () => {
    expect(DEFAULT_JGA_VERSION).toBe('production');
  });
});

describe('isJgaVersion', () => {
  it('returns true for every known version', () => {
    for (const version of PUBLIC_JGA_VERSIONS) {
      expect(isJgaVersion(version)).toBe(true);
    }
  });

  it('returns false for unknown strings', () => {
    expect(isJgaVersion('unknown')).toBe(false);
    expect(isJgaVersion('')).toBe(false);
    expect(isJgaVersion('PRODUCTION')).toBe(false);
  });
});

describe('getJgaVersionConfig', () => {
  it('returns the correct config for a known version', () => {
    for (const version of PUBLIC_JGA_VERSIONS) {
      const config = getJgaVersionConfig(version);
      expect(config.key).toBe(version);
    }
  });

  it('falls back to production config for an unknown version', () => {
    const config = getJgaVersionConfig('unknown-version');
    expect(config.key).toBe('production');
  });

  it('falls back to production config for an empty string', () => {
    const config = getJgaVersionConfig('');
    expect(config.key).toBe('production');
  });
});
