import { z } from 'zod';
import type { StitchLink, StitchLinkCreateInput } from './stitch.types.js';

export const StitchLinkTypeSchema = z.enum([
  'owns',
  'triggers',
  'depends_on',
  'governed_by',
  'pays',
  'reviews',
]);

export const StitchLinkSchema = z.object({
  linkId: z.string().uuid(),
  linkType: StitchLinkTypeSchema,
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<StitchLink>;

export const StitchLinkCreateInputSchema = z.object({
  linkType: StitchLinkTypeSchema,
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<StitchLinkCreateInput>;
