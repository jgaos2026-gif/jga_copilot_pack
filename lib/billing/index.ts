/**
 * JGA Enterprise OS — Billing / Payment Interface + Stub Driver
 *
 * IMPORTANT: No real payment credentials are stored here.
 * Use .env / secrets manager to provide keys at runtime.
 * See .env.example for required environment variable names.
 *
 * TODO: Replace StubPaymentDriver with a production driver
 *       (e.g. StripePaymentDriver) once credentials are provisioned.
 *       Requires CPA/attorney review before live billing operations.
 */

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Core billing types
// ---------------------------------------------------------------------------

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export type PaymentEventType =
  | 'payment.created'
  | 'payment.captured'
  | 'payment.failed'
  | 'payment.refunded'
  | 'deposit.confirmed'
  | 'final_payment.cleared';

export interface PaymentIntent {
  id: string;
  projectId: string;
  clientId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, string>;
}

export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  paymentIntentId: string;
  projectId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  timestamp: number;
  actorId: string;
  rationale: string;
}

export interface ChargeResult {
  success: boolean;
  paymentIntentId: string;
  status: PaymentStatus;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  paymentIntentId: string;
  amountCents: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Payment driver interface (implement this for each payment processor)
// ---------------------------------------------------------------------------

export interface PaymentDriver {
  /**
   * Create a payment intent for a given amount.
   * Does NOT charge the customer — returns an intent to be captured later.
   */
  createPaymentIntent(
    projectId: string,
    clientId: string,
    amountCents: number,
    currency: string,
    description: string,
    metadata?: Record<string, string>
  ): Promise<PaymentIntent>;

  /**
   * Capture (charge) a previously created payment intent.
   */
  capturePayment(paymentIntentId: string): Promise<ChargeResult>;

  /**
   * Refund a previously captured payment.
   */
  refundPayment(paymentIntentId: string, amountCents?: number): Promise<RefundResult>;

  /**
   * Retrieve the current status of a payment intent.
   */
  getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus>;
}

// ---------------------------------------------------------------------------
// Audit log interface (used by BillingService — inject at construction)
// ---------------------------------------------------------------------------

export interface BillingAuditLogger {
  log(event: PaymentEvent): Promise<void>;
}

// ---------------------------------------------------------------------------
// Stub payment driver — safe for testing / dry-run; never touches real money
// ---------------------------------------------------------------------------

export class StubPaymentDriver implements PaymentDriver {
  private intents = new Map<string, PaymentIntent>();

  async createPaymentIntent(
    projectId: string,
    clientId: string,
    amountCents: number,
    currency: string,
    description: string,
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntent> {
    const intent: PaymentIntent = {
      id: `stub_pi_${randomUUID()}`,
      projectId,
      clientId,
      amountCents,
      currency,
      status: 'pending',
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    };
    this.intents.set(intent.id, intent);
    return intent;
  }

  async capturePayment(paymentIntentId: string): Promise<ChargeResult> {
    const intent = this.intents.get(paymentIntentId);
    if (!intent) {
      return { success: false, paymentIntentId, status: 'failed', error: 'Intent not found' };
    }
    intent.status = 'succeeded';
    intent.updatedAt = Date.now();
    return { success: true, paymentIntentId, status: 'succeeded' };
  }

  async refundPayment(paymentIntentId: string, amountCents?: number): Promise<RefundResult> {
    const intent = this.intents.get(paymentIntentId);
    if (!intent) {
      return {
        success: false,
        refundId: '',
        paymentIntentId,
        amountCents: 0,
        error: 'Intent not found',
      };
    }
    intent.status = 'refunded';
    intent.updatedAt = Date.now();
    return {
      success: true,
      refundId: `stub_re_${randomUUID()}`,
      paymentIntentId,
      amountCents: amountCents ?? intent.amountCents,
    };
  }

  async getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus> {
    return this.intents.get(paymentIntentId)?.status ?? 'failed';
  }
}

// ---------------------------------------------------------------------------
// No-op audit logger (replace with real implementation in production)
// ---------------------------------------------------------------------------

export class NoOpAuditLogger implements BillingAuditLogger {
  async log(event: PaymentEvent): Promise<void> {
    // In production: write to append-only event_ledger table or audit service
    // TODO: Wire to real audit log (Stitch Brick backed) before go-live
    console.log('[BILLING AUDIT]', JSON.stringify(event));
  }
}

// ---------------------------------------------------------------------------
// BillingService: orchestrates payment operations with policy + audit logging
// ---------------------------------------------------------------------------

export class BillingService {
  constructor(
    private driver: PaymentDriver,
    private auditLogger: BillingAuditLogger
  ) {}

  /**
   * Create and immediately capture a deposit payment.
   * Logs a deposit.confirmed event on success.
   * System Law: no production work before deposit confirmed (GATE-02).
   */
  async collectDeposit(
    projectId: string,
    clientId: string,
    amountCents: number,
    currency: string,
    actorId: string
  ): Promise<{ depositConfirmed: boolean; paymentIntentId: string; error?: string }> {
    const intent = await this.driver.createPaymentIntent(
      projectId,
      clientId,
      amountCents,
      currency,
      `Deposit for project ${projectId}`
    );

    const result = await this.driver.capturePayment(intent.id);

    await this.auditLogger.log({
      id: randomUUID(),
      type: result.success ? 'deposit.confirmed' : 'payment.failed',
      paymentIntentId: intent.id,
      projectId,
      amountCents,
      currency,
      status: result.status,
      timestamp: Date.now(),
      actorId,
      rationale: result.success ? 'Deposit collected successfully' : (result.error ?? 'Capture failed'),
    });

    return {
      depositConfirmed: result.success,
      paymentIntentId: intent.id,
      error: result.error,
    };
  }

  /**
   * Capture the final payment for a project.
   * Logs a final_payment.cleared event on success.
   * System Law: no final delivery before final payment cleared (GATE-03).
   */
  async collectFinalPayment(
    projectId: string,
    clientId: string,
    amountCents: number,
    currency: string,
    actorId: string
  ): Promise<{ finalPaymentCleared: boolean; paymentIntentId: string; error?: string }> {
    const intent = await this.driver.createPaymentIntent(
      projectId,
      clientId,
      amountCents,
      currency,
      `Final payment for project ${projectId}`
    );

    const result = await this.driver.capturePayment(intent.id);

    await this.auditLogger.log({
      id: randomUUID(),
      type: result.success ? 'final_payment.cleared' : 'payment.failed',
      paymentIntentId: intent.id,
      projectId,
      amountCents,
      currency,
      status: result.status,
      timestamp: Date.now(),
      actorId,
      rationale: result.success ? 'Final payment collected successfully' : (result.error ?? 'Capture failed'),
    });

    return {
      finalPaymentCleared: result.success,
      paymentIntentId: intent.id,
      error: result.error,
    };
  }

  /**
   * Issue a refund. Logs a payment.refunded event.
   */
  async issueRefund(
    paymentIntentId: string,
    projectId: string,
    amountCents: number,
    currency: string,
    actorId: string
  ): Promise<RefundResult> {
    const result = await this.driver.refundPayment(paymentIntentId, amountCents);

    await this.auditLogger.log({
      id: randomUUID(),
      type: 'payment.refunded',
      paymentIntentId,
      projectId,
      amountCents,
      currency,
      status: 'refunded',
      timestamp: Date.now(),
      actorId,
      rationale: result.success ? 'Refund issued' : (result.error ?? 'Refund failed'),
    });

    return result;
  }
}

// ---------------------------------------------------------------------------
// Factory: returns a BillingService backed by the stub driver by default.
// Replace with real driver in production by passing a different PaymentDriver.
// ---------------------------------------------------------------------------

export function createBillingService(
  driver: PaymentDriver = new StubPaymentDriver(),
  auditLogger: BillingAuditLogger = new NoOpAuditLogger()
): BillingService {
  return new BillingService(driver, auditLogger);
}
