import type { Brick } from '../bricks/brick.types.js';
import type { StitchLink } from './stitch.types.js';
import type { StitchService } from './stitch.service.js';

/**
 * Seeds canonical stitch links between the 5 demo bricks.
 *
 * Expected brick order from seedBricks():
 *   [0] illinois    — PolicyBrick  IL-01  "Illinois Client Policy"
 *   [1] texasLedger — LedgerBrick  TX-44  "Texas Revenue Ledger"
 *   [2] fedContract — ContractBrick US-FED "Federal Contract Template"
 *   [3] cfoAgent    — AgentBrick   IL-01  "CFO Agent"
 *   [4] projectProc — ProcessBrick TX-44  "Project Lifecycle Process"
 */
export function seedStitchLinks(stitchService: StitchService, bricks: Brick[]): StitchLink[] {
  const [illinois, texasLedger, fedContract, cfoAgent, projectProc] = bricks;

  const links: StitchLink[] = [];

  // CFO Agent owns the Illinois Client Policy
  links.push(
    stitchService.createLink({
      linkType: 'owns',
      sourceId: cfoAgent.brickId,
      targetId: illinois.brickId,
      metadata: { note: 'CFO Agent is the policy owner for IL-01 client engagements.' },
    }),
  );

  // CFO Agent reviews the Texas Revenue Ledger
  links.push(
    stitchService.createLink({
      linkType: 'reviews',
      sourceId: cfoAgent.brickId,
      targetId: texasLedger.brickId,
      metadata: { frequency: 'weekly' },
    }),
  );

  // Project Lifecycle Process depends_on the Federal Contract Template
  links.push(
    stitchService.createLink({
      linkType: 'depends_on',
      sourceId: projectProc.brickId,
      targetId: fedContract.brickId,
      metadata: { note: 'A signed contract is required before a project may become active.' },
    }),
  );

  // Project Lifecycle Process triggers the Texas Revenue Ledger (payment events)
  links.push(
    stitchService.createLink({
      linkType: 'triggers',
      sourceId: projectProc.brickId,
      targetId: texasLedger.brickId,
      metadata: { events: ['deposit_received', 'final_payment_received'] },
    }),
  );

  // Illinois Client Policy governed_by Federal Contract Template
  links.push(
    stitchService.createLink({
      linkType: 'governed_by',
      sourceId: illinois.brickId,
      targetId: fedContract.brickId,
      metadata: { note: 'State-level policy must conform to the master federal contract template.' },
    }),
  );

  // CFO Agent pays via Texas Revenue Ledger
  links.push(
    stitchService.createLink({
      linkType: 'pays',
      sourceId: cfoAgent.brickId,
      targetId: texasLedger.brickId,
      metadata: { note: 'CFO Agent disburses contractor payments recorded in the TX-44 ledger.' },
    }),
  );

  return links;
}
