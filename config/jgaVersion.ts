/**
 * JGA Version configuration.
 *
 * Defines the set of valid deployment versions, the default fallback, and
 * the discriminating sources used by resolveJgaVersion.
 */

/** All valid JGA deployment versions. */
export type JgaVersion =
  | "production"
  | "staging"
  | "beta"
  | "legacy"
  | "development";

/** Source that determined the resolved version. */
export type VersionSource = "route" | "hostname" | "environment" | "fallback";

/** Version used when no other signal is available. */
export const DEFAULT_JGA_VERSION: JgaVersion = "production";

/** Set of all valid version strings – used for O(1) membership checks. */
const VALID_JGA_VERSIONS: ReadonlySet<string> = new Set<JgaVersion>([
  "production",
  "staging",
  "beta",
  "legacy",
  "development",
]);

/**
 * Type guard: returns true if the supplied string is a valid JgaVersion.
 */
export function isJgaVersion(value: string): value is JgaVersion {
  return VALID_JGA_VERSIONS.has(value);
}
