/**
 * Billing Service Tests
 * Validates the stub billing service and audit logging
 */

import { describe, it, expect, vi } from 'vitest';
import {
  BillingService,
  StubPaymentDriver,
  NoOpAuditLogger,
  createBillingService,
  type PaymentEvent,
} from '@/lib/billing/index';

describe('BillingService — collectDeposit', () => {
  it('returns depositConfirmed=true on success', async () => {
    const service = createBillingService();
    const result = await service.collectDeposit('proj-1', 'client-1', 5000, 'USD', 'owner-1');
    expect(result.depositConfirmed).toBe(true);
    expect(result.paymentIntentId).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('logs a deposit.confirmed audit event on success', async () => {
    const events: PaymentEvent[] = [];
    const auditLogger = {
      log: async (event: PaymentEvent) => { events.push(event); },
    };
    const service = new BillingService(new StubPaymentDriver(), auditLogger);
    await service.collectDeposit('proj-2', 'client-2', 10000, 'USD', 'owner-1');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('deposit.confirmed');
    expect(events[0].projectId).toBe('proj-2');
    expect(events[0].amountCents).toBe(10000);
  });
});

describe('BillingService — collectFinalPayment', () => {
  it('returns finalPaymentCleared=true on success', async () => {
    const service = createBillingService();
    const result = await service.collectFinalPayment('proj-1', 'client-1', 15000, 'USD', 'owner-1');
    expect(result.finalPaymentCleared).toBe(true);
    expect(result.paymentIntentId).toBeTruthy();
  });

  it('logs a final_payment.cleared audit event on success', async () => {
    const events: PaymentEvent[] = [];
    const auditLogger = {
      log: async (event: PaymentEvent) => { events.push(event); },
    };
    const service = new BillingService(new StubPaymentDriver(), auditLogger);
    await service.collectFinalPayment('proj-3', 'client-3', 20000, 'USD', 'owner-1');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('final_payment.cleared');
  });
});

describe('BillingService — issueRefund', () => {
  it('successfully refunds a captured payment', async () => {
    const driver = new StubPaymentDriver();
    const intent = await driver.createPaymentIntent('p', 'c', 5000, 'USD', 'test');
    await driver.capturePayment(intent.id);

    const service = new BillingService(driver, new NoOpAuditLogger());
    const result = await service.issueRefund(intent.id, 'proj-4', 5000, 'USD', 'owner-1');
    expect(result.success).toBe(true);
    expect(result.refundId).toBeTruthy();
  });

  it('logs a payment.refunded audit event', async () => {
    const driver = new StubPaymentDriver();
    const intent = await driver.createPaymentIntent('p', 'c', 5000, 'USD', 'test');
    await driver.capturePayment(intent.id);

    const events: PaymentEvent[] = [];
    const auditLogger = {
      log: async (event: PaymentEvent) => { events.push(event); },
    };
    const service = new BillingService(driver, auditLogger);
    await service.issueRefund(intent.id, 'proj-5', 5000, 'USD', 'owner-1');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('payment.refunded');
  });
});

describe('StubPaymentDriver', () => {
  it('returns failed status for unknown payment intent ID', async () => {
    const driver = new StubPaymentDriver();
    const status = await driver.getPaymentStatus('nonexistent-id');
    expect(status).toBe('failed');
  });

  it('captures payment and updates status to succeeded', async () => {
    const driver = new StubPaymentDriver();
    const intent = await driver.createPaymentIntent('p', 'c', 1000, 'USD', 'test');
    expect(intent.status).toBe('pending');

    const result = await driver.capturePayment(intent.id);
    expect(result.success).toBe(true);
    expect(result.status).toBe('succeeded');

    const status = await driver.getPaymentStatus(intent.id);
    expect(status).toBe('succeeded');
  });
});

describe('NoOpAuditLogger', () => {
  it('does not throw when logging an event', async () => {
    const logger = new NoOpAuditLogger();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(logger.log({
      id: 'test-id',
      type: 'payment.created',
      paymentIntentId: 'pi-1',
      projectId: 'proj-1',
      amountCents: 1000,
      currency: 'USD',
      status: 'pending',
      timestamp: Date.now(),
      actorId: 'system',
      rationale: 'test',
    })).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });
});
