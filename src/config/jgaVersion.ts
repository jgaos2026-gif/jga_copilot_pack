export const PUBLIC_JGA_VERSIONS = [
  "production",
  "staging",
  "beta",
  "legacy",
] as const;

export type JgaVersion = (typeof PUBLIC_JGA_VERSIONS)[number];

export type VersionSource =
  | "route"
  | "hostname"
  | "environment"
  | "fallback";

export interface JgaVersionConfig {
  key: JgaVersion;
  label: string;
  public: true;
  basePath: string;
  featureFlags: {
    newHero: boolean;
    newCheckout: boolean;
    systemBPreview: boolean;
  };
}

export const JGA_VERSION_REGISTRY: Record<JgaVersion, JgaVersionConfig> = {
  production: {
    key: "production",
    label: "Production",
    public: true,
    basePath: "/",
    featureFlags: {
      newHero: true,
      newCheckout: true,
      systemBPreview: true,
    },
  },
  staging: {
    key: "staging",
    label: "Staging",
    public: true,
    basePath: "/staging",
    featureFlags: {
      newHero: true,
      newCheckout: false,
      systemBPreview: true,
    },
  },
  beta: {
    key: "beta",
    label: "Beta",
    public: true,
    basePath: "/beta",
    featureFlags: {
      newHero: true,
      newCheckout: false,
      systemBPreview: false,
    },
  },
  legacy: {
    key: "legacy",
    label: "Legacy",
    public: true,
    basePath: "/legacy",
    featureFlags: {
      newHero: false,
      newCheckout: false,
      systemBPreview: false,
    },
  },
};

export const DEFAULT_JGA_VERSION: JgaVersion = "production";

export function isJgaVersion(value: string): value is JgaVersion {
  return (PUBLIC_JGA_VERSIONS as readonly string[]).includes(value);
}

export function getJgaVersionConfig(version: string): JgaVersionConfig {
  if (isJgaVersion(version)) {
    return JGA_VERSION_REGISTRY[version];
  }
  return JGA_VERSION_REGISTRY[DEFAULT_JGA_VERSION];
}
