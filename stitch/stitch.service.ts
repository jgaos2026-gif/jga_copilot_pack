import { randomUUID } from 'crypto';
import type { StitchLink, StitchLinkCreateInput, StitchLinkType } from './stitch.types.js';
import { StitchLinkCreateInputSchema } from './stitch.schema.js';
import { detectCircularDependency, getInboundLinks, getOutboundLinks } from './stitch.graph.js';

export class StitchService {
  public readonly linkStore: StitchLink[] = [];

  constructor(private readonly brickIds: () => string[]) {}

  createLink(input: StitchLinkCreateInput): StitchLink {
    const parsed = StitchLinkCreateInputSchema.parse(input);

    const validIds = new Set(this.brickIds());

    if (!validIds.has(parsed.sourceId)) {
      throw new Error(`Source brick not found: ${parsed.sourceId}`);
    }
    if (!validIds.has(parsed.targetId)) {
      throw new Error(`Target brick not found: ${parsed.targetId}`);
    }

    if (parsed.linkType === 'governed_by' && detectCircularDependency(this.linkStore, parsed)) {
      throw new Error(
        `Adding this governed_by link would create a circular dependency: ${parsed.sourceId} -> ${parsed.targetId}`,
      );
    }

    const link: StitchLink = {
      linkId: randomUUID(),
      linkType: parsed.linkType as StitchLinkType,
      sourceId: parsed.sourceId,
      targetId: parsed.targetId,
      createdAt: new Date().toISOString(),
      metadata: parsed.metadata,
    };

    this.linkStore.push(link);
    return link;
  }

  getLinksForBrick(brickId: string): { inbound: StitchLink[]; outbound: StitchLink[] } {
    return {
      inbound: getInboundLinks(this.linkStore, brickId),
      outbound: getOutboundLinks(this.linkStore, brickId),
    };
  }

  getAllLinks(): StitchLink[] {
    return [...this.linkStore];
  }
}
