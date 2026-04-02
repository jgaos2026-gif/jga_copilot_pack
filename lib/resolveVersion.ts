// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

import {
  DEFAULT_JGA_VERSION,
  JgaVersion,
  VersionSource,
  isJgaVersion,
} from "../config/jgaVersion";

export interface ResolveVersionInput {
  routeVersion?: string | null;
  hostname?: string | null;
  environmentDefault?: string | null;
}

export interface ResolveVersionResult {
  version: JgaVersion;
  source: VersionSource;
}

const HOSTNAME_VERSION_MAP: Record<string, JgaVersion> = {
  "jaysgraphicarts.com": "production",
  "www.jaysgraphicarts.com": "production",
  "staging.jaysgraphicarts.com": "staging",
  "beta.jaysgraphicarts.com": "beta",
  "legacy.jaysgraphicarts.com": "legacy",
};

export function resolveJgaVersion(
  input: ResolveVersionInput
): ResolveVersionResult {
  const routeVersion = input.routeVersion?.trim().toLowerCase();
  if (routeVersion && isJgaVersion(routeVersion)) {
    return { version: routeVersion, source: "route" };
  }

  const hostname = input.hostname?.trim().toLowerCase();
  if (hostname && HOSTNAME_VERSION_MAP[hostname]) {
    return { version: HOSTNAME_VERSION_MAP[hostname], source: "hostname" };
  }

  const environmentDefault = input.environmentDefault?.trim().toLowerCase();
  if (environmentDefault && isJgaVersion(environmentDefault)) {
    return { version: environmentDefault, source: "environment" };
  }

  return { version: DEFAULT_JGA_VERSION, source: "fallback" };
}
