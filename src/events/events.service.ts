import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { WebhookEvent } from './entities/webhook-event.entity';
import { EventStatus } from './enums/event-status.enum';
import { WEBHOOK_QUEUE, WEBHOOK_JOB_OPTIONS } from '../queue/queue.constants';
import { WebhookJobData } from '../queue/processors/webhook.processor';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventsRepository: Repository<WebhookEvent>,
    @InjectQueue(WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue<WebhookJobData>,
  ) {}

  findAll(status?: EventStatus): Promise<WebhookEvent[]> {
    return this.eventsRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async findOne(id: string): Promise<WebhookEvent> {
    const event = await this.eventsRepository.findOneBy({ id });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async getStats() {
    const rows: { status: EventStatus; count: string }[] = await this.eventsRepository
      .createQueryBuilder('event')
      .select('event.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.status')
      .getRawMany();

    const stats: Record<EventStatus, number> = {
      [EventStatus.PENDING]: 0,
      [EventStatus.PROCESSING]: 0,
      [EventStatus.COMPLETED]: 0,
      [EventStatus.FAILED]: 0,
    };
    for (const row of rows) {
      stats[row.status] = Number(row.count);
    }

    const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
    return { total, ...stats };
  }

  async retry(id: string): Promise<WebhookEvent> {
    const event = await this.findOne(id);
    if (event.status !== EventStatus.FAILED) {
      throw new BadRequestException('Only failed events can be retried');
    }

    // Remove the old failed job first, since BullMQ ignores a new job with an existing jobId.
    const oldJob = await this.webhookQueue.getJob(event.id);
    if (oldJob) {
      await oldJob.remove();
    }

    event.status = EventStatus.PENDING;
    event.attempts = 0;
    event.errorMessage = null;
    const saved = await this.eventsRepository.save(event);

    await this.webhookQueue.add(
      'process-webhook',
      { webhookEventId: saved.id },
      { jobId: saved.id, ...WEBHOOK_JOB_OPTIONS },
    );

    return saved;
  }
}
