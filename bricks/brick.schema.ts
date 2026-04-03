import { z } from 'zod';
import type { Brick, BrickCreateInput, BrickUpdateInput } from './brick.types.js';

export const BrickTypeSchema = z.enum([
  'PolicyBrick',
  'ProcessBrick',
  'OpsBrick',
  'LedgerBrick',
  'ComplianceBrick',
  'ContractBrick',
  'RecordBrick',
  'AgentBrick',
]);

export const BrickLifecycleSchema = z.enum(['draft', 'active', 'suspended', 'archived']);

export const BrickSchema = z.object({
  brickId: z.string().uuid(),
  brickType: BrickTypeSchema,
  stateTag: z.string().min(1),
  lifecycle: BrickLifecycleSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()),
}) satisfies z.ZodType<Brick>;

export const BrickCreateInputSchema = z.object({
  brickType: BrickTypeSchema,
  stateTag: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<BrickCreateInput>;

export const BrickUpdateInputSchema = z.object({
  brickId: z.string().uuid(),
  lifecycle: BrickLifecycleSchema.optional(),
  description: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<BrickUpdateInput>;
