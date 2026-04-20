import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createStripePaymentLink } from '@/lib/billing/stripe-payment-link';
import { createServerClient } from '@/lib/supabase';

const requestSchema = z.object({
  project_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  state_tag: z.string().min(2).max(10).default('IL-01'),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  payment_stage: z.enum(['deposit', 'final']),
  description: z.string().max(200).optional(),
  customer_email: z.string().email().optional(),
  success_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const amountCents = Math.round(body.amount * 100);

    const paymentLink = await createStripePaymentLink({
      projectId: body.project_id,
      clientId: body.client_id,
      customerEmail: body.customer_email,
      amountCents,
      currency: body.currency,
      paymentStage: body.payment_stage,
      description: body.description,
      successUrl: body.success_url,
      stateTag: body.state_tag,
      metadata: body.metadata,
    });

    const supabase = createServerClient();
    const paymentStageForLedger = body.payment_stage === 'deposit' ? 'deposit_sent' : 'final_sent';

    const { error: insertError } = await supabase.from('transactions').insert({
      project_id: body.project_id,
      amount: body.amount,
      currency: body.currency.toUpperCase(),
      payment_stage: paymentStageForLedger,
      processor: 'stripe',
      processor_reference: paymentLink.paymentLinkId,
      state_tag: body.state_tag,
      allocation_breakdown: body.metadata ?? {},
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({ payment_stage: paymentStageForLedger })
      .eq('id', body.project_id);

    if (projectUpdateError) {
      return NextResponse.json({ error: projectUpdateError.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        url: paymentLink.url,
        payment_link_id: paymentLink.paymentLinkId,
        processor: paymentLink.processor,
        payment_stage: paymentStageForLedger,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create payment link';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
