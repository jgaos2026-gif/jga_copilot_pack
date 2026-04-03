export interface JurisdictionRule {
  stateTag: string;
  stateName: string;
  contractAddendumRequired: boolean;
  withholdingRate: number; // percentage, 0 if not applicable
  retentionYears: number;
  licensingRequired: boolean;
  notes: string; // ATTORNEY REVIEW REQUIRED where applicable
}

export const jurisdictionRules: JurisdictionRule[] = [
  {
    stateTag: 'IL-01',
    stateName: 'Illinois',
    contractAddendumRequired: true,
    withholdingRate: 4.95,
    retentionYears: 7,
    licensingRequired: true,
    notes:
      'Illinois requires an addendum for out-of-state contractors. ' +
      'State income tax withholding rate is 4.95%. ' +
      'ATTORNEY REVIEW REQUIRED for contractor classification under IL law.',
  },
  {
    stateTag: 'TX-44',
    stateName: 'Texas',
    contractAddendumRequired: false,
    withholdingRate: 0,
    retentionYears: 4,
    licensingRequired: false,
    notes:
      'Texas has no state income tax. No withholding required. ' +
      'ATTORNEY REVIEW REQUIRED for service contracts exceeding $500 or involving IP rights.',
  },
  {
    stateTag: 'US-FED',
    stateName: 'Federal (United States)',
    contractAddendumRequired: false,
    withholdingRate: 0,
    retentionYears: 7,
    licensingRequired: false,
    notes:
      'Federal regulations apply to all operations. IRS 1099 required for contractors paid > $600/year. ' +
      'CPA REVIEW REQUIRED for tax compliance. ATTORNEY REVIEW REQUIRED for federal contract compliance.',
  },
  {
    stateTag: 'CA-01',
    stateName: 'California',
    contractAddendumRequired: true,
    withholdingRate: 13.3,
    retentionYears: 7,
    licensingRequired: true,
    notes:
      'California AB5 and CCPA impose strict requirements on contractor classification and data privacy. ' +
      'ATTORNEY REVIEW REQUIRED before engaging any CA-based contractor or collecting CA resident data. ' +
      'Withholding rate reflects top marginal rate — CPA REVIEW REQUIRED for actual rate.',
  },
  {
    stateTag: 'NY-01',
    stateName: 'New York',
    contractAddendumRequired: true,
    withholdingRate: 10.9,
    retentionYears: 6,
    licensingRequired: true,
    notes:
      'New York has strict freelance worker protections under the Freelance Isn\'t Free Act. ' +
      'Written contracts required for engagements > $800. ' +
      'ATTORNEY REVIEW REQUIRED for all NY contractor agreements.',
  },
];

export function getJurisdictionRule(stateTag: string): JurisdictionRule | undefined {
  return jurisdictionRules.find((r) => r.stateTag === stateTag);
}
