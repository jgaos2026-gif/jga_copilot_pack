import Stripe from 'stripe';

export type PaymentLinkStage = 'deposit' | 'final';

export interface CreateStripePaymentLinkInput {
  projectId: string;
  clientId?: string;
  customerEmail?: string;
  amountCents: number;
  currency: string;
  paymentStage: PaymentLinkStage;
  description?: string;
  successUrl?: string;
  stateTag: string;
  metadata?: Record<string, string>;
}

export interface StripePaymentLinkResult {
  url: string;
  paymentLinkId: string;
  processor: 'stripe';
  paymentStage: PaymentLinkStage;
}

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });

  return stripeClient;
}

/**
 * Create a Stripe Payment Link for deposit/final payment collection.
 * Uses dynamic price_data so no pre-created Price is required.
 */
export async function createStripePaymentLink(
  input: CreateStripePaymentLinkInput
): Promise<StripePaymentLinkResult> {
  const stripe = getStripeClient();

  const successUrl = input.successUrl ?? process.env.STRIPE_PAYMENT_SUCCESS_URL;
  if (!successUrl) {
    throw new Error('Missing success URL for payment link');
  }

  const amountCents = Math.max(1, Math.floor(input.amountCents));
  const currency = input.currency.toUpperCase();
  const metadata: Record<string, string> = {
    projectId: input.projectId,
    paymentStage: input.paymentStage,
    stateTag: input.stateTag,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...input.metadata,
  };

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name:
              input.description ??
              `JGA ${input.paymentStage === 'deposit' ? 'Deposit' : 'Final Payment'} for ${input.projectId}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    after_completion: {
      type: 'redirect',
      redirect: { url: successUrl },
    },
    allow_promotion_codes: false,
    payment_intent_data: {
      metadata,
    },
    metadata,
    customer_email: input.customerEmail,
  });

  return {
    url: paymentLink.url,
    paymentLinkId: paymentLink.id,
    processor: 'stripe',
    paymentStage: input.paymentStage,
  };
}
