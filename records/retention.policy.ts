export interface RetentionPolicy {
  stateTag: string;
  financialRecordsYears: number;
  contractRecordsYears: number;
  communicationRecordsYears: number;
  taxRecordsYears: number;
  notes: string;
}

export const retentionPolicies: RetentionPolicy[] = [
  {
    stateTag: 'IL-01',
    financialRecordsYears: 7,
    contractRecordsYears: 10,
    communicationRecordsYears: 3,
    taxRecordsYears: 7,
    notes:
      'Illinois retains contracts for 10 years under 735 ILCS 5/13-206. ' +
      'ATTORNEY REVIEW REQUIRED for employment and contractor agreements.',
  },
  {
    stateTag: 'TX-44',
    financialRecordsYears: 7,
    contractRecordsYears: 4,
    communicationRecordsYears: 3,
    taxRecordsYears: 7,
    notes:
      'Texas general contract statute of limitations is 4 years (Tex. Civ. Prac. & Rem. Code § 16.004). ' +
      'ATTORNEY REVIEW REQUIRED for service contracts over $500.',
  },
  {
    stateTag: 'US-FED',
    financialRecordsYears: 7,
    contractRecordsYears: 6,
    communicationRecordsYears: 3,
    taxRecordsYears: 7,
    notes:
      'Federal IRS requirements mandate 7-year retention for tax records. ' +
      'CPA REVIEW REQUIRED before destruction of any financial records. ' +
      'ATTORNEY REVIEW REQUIRED for federal contractor compliance.',
  },
  {
    stateTag: 'CA-01',
    financialRecordsYears: 7,
    contractRecordsYears: 4,
    communicationRecordsYears: 3,
    taxRecordsYears: 7,
    notes:
      'California has additional privacy obligations under CCPA/CPRA. ' +
      'ATTORNEY REVIEW REQUIRED for any records containing personal data of CA residents.',
  },
  {
    stateTag: 'NY-01',
    financialRecordsYears: 7,
    contractRecordsYears: 6,
    communicationRecordsYears: 3,
    taxRecordsYears: 7,
    notes:
      'New York general obligation law § 17-101 imposes a 6-year contract retention period. ' +
      'ATTORNEY REVIEW REQUIRED for all service agreements.',
  },
];

export function getRetentionPolicy(stateTag: string): RetentionPolicy | undefined {
  return retentionPolicies.find((p) => p.stateTag === stateTag);
}
