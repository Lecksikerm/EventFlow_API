import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
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
      attempts: job.attemptsMade + 1,
    });

    await this.handle(event);

    await this.eventsRepository.update(event.id, {
      status: EventStatus.COMPLETED,
      processedAt: new Date(),
      errorMessage: null,
    });

    this.logger.log(`Completed ${event.type} (${event.eventId})`);
  }

  // Runs after every failed attempt. Only the final failure marks the event as FAILED;
  // earlier failures stay PROCESSING while BullMQ schedules the next retry.
  @OnWorkerEvent('failed')
  async onFailed(job: Job<WebhookJobData>, error: Error): Promise<void> {
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);

    await this.eventsRepository.update(job.data.webhookEventId, {
      status: isFinalAttempt ? EventStatus.FAILED : EventStatus.PROCESSING,
      errorMessage: error.message,
    });

    if (isFinalAttempt) {
      this.logger.error(`Event ${job.data.webhookEventId} failed permanently: ${error.message}`);
    } else {
      this.logger.warn(`Attempt ${job.attemptsMade} failed, will retry: ${error.message}`);
    }
  }

  private async handle(event: WebhookEvent): Promise<void> {
    // Test hook: lets us simulate a failing handler. Remove before production use.
    if (event.payload.simulateFailure === true) {
      throw new Error('Simulated handler failure');
    }

    switch (event.type) {
      case 'payment.success':
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
