import type { StitchLink, StitchLinkCreateInput, StitchLinkType } from './stitch.types.js';

export function getOutboundLinks(linkStore: StitchLink[], brickId: string): StitchLink[] {
  return linkStore.filter((l) => l.sourceId === brickId);
}

export function getInboundLinks(linkStore: StitchLink[], brickId: string): StitchLink[] {
  return linkStore.filter((l) => l.targetId === brickId);
}

/**
 * BFS from `fromId` to `toId`, optionally restricted to a single linkType.
 * Returns the ordered list of brickIds forming the path, or null if no path exists.
 */
export function findPath(
  linkStore: StitchLink[],
  fromId: string,
  toId: string,
  linkType?: StitchLinkType,
): string[] | null {
  const relevant = linkType ? linkStore.filter((l) => l.linkType === linkType) : linkStore;

  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    if (id === toId) {
      return path;
    }

    if (visited.has(id)) {
      continue;
    }
    visited.add(id);

    const neighbours = relevant.filter((l) => l.sourceId === id).map((l) => l.targetId);
    for (const neighbour of neighbours) {
      if (!visited.has(neighbour)) {
        queue.push({ id: neighbour, path: [...path, neighbour] });
      }
    }
  }

  return null;
}

/**
 * Returns true if adding the proposed `governed_by` link would form a cycle.
 * Only considers existing `governed_by` edges plus the proposed one.
 */
export function detectCircularDependency(
  linkStore: StitchLink[],
  proposedLink: StitchLinkCreateInput,
): boolean {
  // A cycle exists if we can already reach sourceId from targetId via governed_by edges.
  // Adding source -> target would then close the loop.
  const governedByLinks = linkStore.filter((l) => l.linkType === 'governed_by');

  // Check whether targetId can reach sourceId (i.e. adding source->target closes a loop).
  const path = findPath(governedByLinks, proposedLink.targetId, proposedLink.sourceId, 'governed_by');
  return path !== null;
}
