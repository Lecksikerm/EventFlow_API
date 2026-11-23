import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QueryFailedError } from 'typeorm';
import { WebhooksService } from './webhooks.service';
import { EventStatus } from '../events/enums/event-status.enum';
import { WEBHOOK_JOB_OPTIONS } from '../queue/queue.constants';

const DTO = { eventId: 'evt_123', type: 'order.created', data: { amount: 42 } };

const uniqueViolation = () =>
  new QueryFailedError('INSERT ...', [], {
    code: '23505',
    name: 'error',
    message: 'duplicate key value violates unique constraint',
  } as any);

describe('WebhooksService.receive', () => {
  let service: WebhooksService;
  let repo: Record<string, jest.Mock<any>>;
  let queue: { add: jest.Mock<any> };

  beforeEach(() => {
    repo = {
      create: jest.fn((data: object) => data),
      save: jest.fn(),
      findOneByOrFail: jest.fn(),
    };
    queue = { add: jest.fn() };

    service = new WebhooksService(repo as any, queue as any);
  });

  it('saves a new event and enqueues exactly one job for it', async () => {
    repo.save.mockImplementation(async (e: any) => ({ ...e, id: 'uuid-1' }));
    queue.add.mockResolvedValue({});

    const result = await service.receive(DTO);

    expect(result.isDuplicate).toBe(false);
    expect(result.event.id).toBe('uuid-1');
    expect(result.event.status).toBe(EventStatus.PENDING);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'process-webhook',
      { webhookEventId: 'uuid-1' },
      { jobId: 'uuid-1', ...WEBHOOK_JOB_OPTIONS },
    );
  });

  it('returns the existing event and does not enqueue when the event_id already exists', async () => {
    const existing = { id: 'uuid-old', eventId: 'evt_123', status: EventStatus.PENDING };
    repo.save.mockRejectedValue(uniqueViolation());
    repo.findOneByOrFail.mockResolvedValue(existing);

    const result = await service.receive(DTO);

    expect(result.isDuplicate).toBe(true);
    expect(result.event).toBe(existing);
    expect(repo.findOneByOrFail).toHaveBeenCalledWith({ eventId: 'evt_123' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rethrows database errors that are not unique violations', async () => {
    const other = new QueryFailedError('SELECT 1', [], {
      code: '08006',
      name: 'error',
      message: 'connection failure',
    } as any);
    repo.save.mockRejectedValue(other);

    await expect(service.receive(DTO)).rejects.toBe(other);
    expect(repo.findOneByOrFail).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
