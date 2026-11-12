import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { WebhookEvent } from '../../events/entities/webhook-event.entity';
import { EventStatus } from '../../events/enums/event-status.enum';
import { WEBHOOK_QUEUE } from '../queue.constants';

export interface WebhookJobData {
  webhookEventId: string;
}

@Processor(WEBHOOK_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventsRepository: Repository<WebhookEvent>,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const event = await this.eventsRepository.findOneByOrFail({
      id: job.data.webhookEventId,
    });

    await this.eventsRepository.update(event.id, {
      status: EventStatus.PROCESSING,
      attempts: event.attempts + 1,
    });

    await this.handle(event);

    await this.eventsRepository.update(event.id, {
      status: EventStatus.COMPLETED,
      processedAt: new Date(),
      errorMessage: null,
    });

    this.logger.log(`Completed ${event.type} (${event.eventId})`);
  }

  private async handle(event: WebhookEvent): Promise<void> {
    switch (event.type) {
      case 'payment.success':
        // Real payment handling goes here (e.g. mark the order as paid).
        this.logger.log(`Processing payment for customer ${event.payload.customerId}`);
        return;
      case 'user.created':
        this.logger.log(`Processing new user ${event.payload.email ?? event.payload.customerId}`);
        return;
      case 'subscription.cancelled':
        this.logger.log(`Processing cancellation for ${event.payload.customerId}`);
        return;
      default:
        this.logger.warn(`No handler for event type ${event.type}`);
    }
  }
}
