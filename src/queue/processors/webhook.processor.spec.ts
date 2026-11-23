import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { WebhookProcessor } from './webhook.processor';
import { WebhookEvent } from '../../events/entities/webhook-event.entity';
import { EventStatus } from '../../events/enums/event-status.enum';

const makeEvent = (payload: Record<string, unknown> = {}): WebhookEvent => ({
    id: 'uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    eventId: 'evt_123',
    type: 'payment.success',
    payload: { customerId: 'cus_1', ...payload },
    status: EventStatus.PENDING,
    attempts: 0,
    errorMessage: null,
    processedAt: null,
  });

const makeJob = (attemptsMade: number, attempts = 4) =>
  ({
    data: { webhookEventId: 'uuid-1' },
    attemptsMade,
    opts: { attempts },
  }) as any;

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;
  let repo: {
    findOneByOrFail: jest.MockedFunction<
      Repository<WebhookEvent>['findOneByOrFail']
    >;
    update: jest.MockedFunction<Repository<WebhookEvent>['update']>;
  };

  beforeEach(() => {
    repo = {
      findOneByOrFail: jest.fn<Repository<WebhookEvent>['findOneByOrFail']>(),
      update: jest.fn<Repository<WebhookEvent>['update']>(),
    };
    processor = new WebhookProcessor(repo as any);
  });

  describe('process', () => {
    it('marks the event PROCESSING, then COMPLETED, on success', async () => {
      repo.findOneByOrFail.mockResolvedValue(makeEvent());

      await processor.process(makeJob(0));

      expect(repo.update).toHaveBeenNthCalledWith(1, 'uuid-1', {
        status: EventStatus.PROCESSING,
        attempts: 1,
      });
      expect(repo.update).toHaveBeenNthCalledWith(
        2,
        'uuid-1',
        expect.objectContaining({
          status: EventStatus.COMPLETED,
          errorMessage: null,
        }),
      );
    });

    it('does not mark the event COMPLETED when the handler throws', async () => {
      repo.findOneByOrFail.mockResolvedValue(
        makeEvent({ simulateFailure: true }),
      );

      await expect(processor.process(makeJob(1))).rejects.toThrow(
        'Simulated handler failure',
      );

      const statuses = repo.update.mock.calls.map((call) => call[1].status);
      expect(statuses).toEqual([EventStatus.PROCESSING]);
      expect(statuses).not.toContain(EventStatus.COMPLETED);
    });
  });

  describe('onFailed', () => {
    it('keeps the event PROCESSING when a retry is still coming', async () => {
      await processor.onFailed(makeJob(2), new Error('boom'));

      expect(repo.update).toHaveBeenCalledWith('uuid-1', {
        status: EventStatus.PROCESSING,
        errorMessage: 'boom',
      });
    });

    it('marks the event FAILED only on the final attempt', async () => {
      await processor.onFailed(makeJob(4), new Error('boom'));

      expect(repo.update).toHaveBeenCalledWith('uuid-1', {
        status: EventStatus.FAILED,
        errorMessage: 'boom',
      });
    });
  });
});
