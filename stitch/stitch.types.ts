export type StitchLinkType = 'owns' | 'triggers' | 'depends_on' | 'governed_by' | 'pays' | 'reviews';

export interface StitchLink {
  linkId: string; // UUID
  linkType: StitchLinkType;
  sourceId: string; // brickId
  targetId: string; // brickId
  createdAt: string; // ISO 8601
  metadata?: Record<string, unknown>;
}

export interface StitchLinkCreateInput {
  linkType: StitchLinkType;
  sourceId: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}
