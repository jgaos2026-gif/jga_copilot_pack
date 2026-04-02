// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

import { describe, it, expect } from "vitest";
import { resolveJgaVersion } from "../lib/resolveVersion";
import { DEFAULT_JGA_VERSION, isJgaVersion } from "../config/jgaVersion";

describe("isJgaVersion", () => {
  it("returns true for each valid version", () => {
    const valid = ["production", "staging", "beta", "legacy", "development"];
    for (const v of valid) {
      expect(isJgaVersion(v)).toBe(true);
    }
  });

  it("returns false for unknown strings", () => {
    expect(isJgaVersion("alpha")).toBe(false);
    expect(isJgaVersion("")).toBe(false);
    expect(isJgaVersion("PRODUCTION")).toBe(false);
  });
});

describe("resolveJgaVersion – route source", () => {
  it("uses route version when valid", () => {
    const result = resolveJgaVersion({ routeVersion: "staging" });
    expect(result).toEqual({ version: "staging", source: "route" });
  });

  it("trims and lowercases route version", () => {
    const result = resolveJgaVersion({ routeVersion: "  Beta  " });
    expect(result).toEqual({ version: "beta", source: "route" });
  });

  it("ignores invalid route version and falls through", () => {
    const result = resolveJgaVersion({
      routeVersion: "alpha",
      hostname: "staging.jaysgraphicarts.com",
    });
    expect(result).toEqual({ version: "staging", source: "hostname" });
  });

  it("ignores null route version", () => {
    const result = resolveJgaVersion({
      routeVersion: null,
      hostname: "www.jaysgraphicarts.com",
    });
    expect(result).toEqual({ version: "production", source: "hostname" });
  });
});

describe("resolveJgaVersion – hostname source", () => {
  const cases: Array<[string, string]> = [
    ["jaysgraphicarts.com", "production"],
    ["www.jaysgraphicarts.com", "production"],
    ["staging.jaysgraphicarts.com", "staging"],
    ["beta.jaysgraphicarts.com", "beta"],
    ["legacy.jaysgraphicarts.com", "legacy"],
  ];

  it.each(cases)("maps %s → %s", (hostname, expectedVersion) => {
    const result = resolveJgaVersion({ hostname });
    expect(result).toEqual({ version: expectedVersion, source: "hostname" });
  });

  it("trims and lowercases hostname", () => {
    const result = resolveJgaVersion({ hostname: "  Beta.JaysGraphicArts.COM  " });
    expect(result).toEqual({ version: "beta", source: "hostname" });
  });

  it("ignores unknown hostname and falls through", () => {
    const result = resolveJgaVersion({
      hostname: "unknown.example.com",
      environmentDefault: "development",
    });
    expect(result).toEqual({ version: "development", source: "environment" });
  });
});

describe("resolveJgaVersion – environment source", () => {
  it("uses environment default when valid", () => {
    const result = resolveJgaVersion({ environmentDefault: "development" });
    expect(result).toEqual({ version: "development", source: "environment" });
  });

  it("trims and lowercases environment default", () => {
    const result = resolveJgaVersion({ environmentDefault: " Legacy " });
    expect(result).toEqual({ version: "legacy", source: "environment" });
  });

  it("ignores invalid environment default and falls back", () => {
    const result = resolveJgaVersion({ environmentDefault: "nightly" });
    expect(result).toEqual({
      version: DEFAULT_JGA_VERSION,
      source: "fallback",
    });
  });
});

describe("resolveJgaVersion – fallback source", () => {
  it("returns default version when no inputs are provided", () => {
    const result = resolveJgaVersion({});
    expect(result).toEqual({
      version: DEFAULT_JGA_VERSION,
      source: "fallback",
    });
  });

  it("returns default version when all inputs are null/undefined", () => {
    const result = resolveJgaVersion({
      routeVersion: null,
      hostname: null,
      environmentDefault: null,
    });
    expect(result).toEqual({
      version: DEFAULT_JGA_VERSION,
      source: "fallback",
    });
  });

  it("returns default version when all inputs are empty strings", () => {
    const result = resolveJgaVersion({
      routeVersion: "   ",
      hostname: "   ",
      environmentDefault: "   ",
    });
    expect(result).toEqual({
      version: DEFAULT_JGA_VERSION,
      source: "fallback",
    });
  });
});
