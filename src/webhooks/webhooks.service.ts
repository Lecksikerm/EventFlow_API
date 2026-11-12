import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { QueryFailedError, Repository } from 'typeorm';
import { WebhookEvent } from '../events/entities/webhook-event.entity';
import { EventStatus } from '../events/enums/event-status.enum';
import { WEBHOOK_QUEUE } from '../queue/queue.constants';
import { WebhookJobData } from '../queue/processors/webhook.processor';
import { CreateWebhookEventDto } from './dto/create-webhook-event.dto';

// PostgreSQL error code for unique_violation
const UNIQUE_VIOLATION = '23505';

export interface ReceiveResult {
  event: WebhookEvent;
  isDuplicate: boolean;
}

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventsRepository: Repository<WebhookEvent>,
    @InjectQueue(WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue<WebhookJobData>,
  ) {}

  async receive(dto: CreateWebhookEventDto): Promise<ReceiveResult> {
    const event = this.eventsRepository.create({
      eventId: dto.eventId,
      type: dto.type,
      payload: dto.data,
      status: EventStatus.PENDING,
      attempts: 0,
    });

    let saved: WebhookEvent;
    try {
      saved = await this.eventsRepository.save(event);
    } catch (error) {
      // The database rejected the insert because this event_id already exists.
      if (error instanceof QueryFailedError && (error as any).driverError?.code === UNIQUE_VIOLATION) {
        const existing = await this.eventsRepository.findOneByOrFail({ eventId: dto.eventId });
        return { event: existing, isDuplicate: true };
      }
      throw error;
    }

    // Using the event's id as the job id means BullMQ also refuses a second job for it.
    await this.webhookQueue.add(
      'process-webhook',
      { webhookEventId: saved.id },
      { jobId: saved.id },
    );

    return { event: saved, isDuplicate: false };
  }
}
