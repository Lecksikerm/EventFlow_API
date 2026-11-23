import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WebhookSignatureGuard } from './webhook-signature.guard';

const SECRET = 'test-secret';
const BODY = Buffer.from(JSON.stringify({ event: 'order.created' }));

const sign = (body: Buffer) =>
  createHmac('sha256', SECRET).update(body).digest('hex');

const buildContext = (req: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

describe('WebhookSignatureGuard', () => {
  let guard: WebhookSignatureGuard;

  beforeEach(() => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue(SECRET),
    } as unknown as ConfigService;
    guard = new WebhookSignatureGuard(config);
  });

  it('allows a request with a valid signature', () => {
    const ctx = buildContext({
      headers: { 'x-webhook-signature': sign(BODY) },
      rawBody: BODY,
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects a request with no signature header', () => {
    const ctx = buildContext({ headers: {}, rawBody: BODY });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('Missing webhook signature');
  });

  it('rejects a request with no raw body', () => {
    const ctx = buildContext({
      headers: { 'x-webhook-signature': sign(BODY) },
    });

    expect(() => guard.canActivate(ctx)).toThrow('Missing webhook signature');
  });

  it('rejects a signature computed with a different body', () => {
    const ctx = buildContext({
      headers: { 'x-webhook-signature': sign(Buffer.from('tampered')) },
      rawBody: BODY,
    });

    expect(() => guard.canActivate(ctx)).toThrow('Invalid webhook signature');
  });

  it('rejects a signature of the wrong length without crashing', () => {
    const ctx = buildContext({
      headers: { 'x-webhook-signature': 'abc' },
      rawBody: BODY,
    });

    expect(() => guard.canActivate(ctx)).toThrow('Invalid webhook signature');
  });
});
