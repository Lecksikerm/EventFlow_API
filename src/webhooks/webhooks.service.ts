import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from '../events/entities/webhook-event.entity';
import { EventStatus } from '../events/enums/event-status.enum';
import { CreateWebhookEventDto } from './dto/create-webhook-event.dto';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventsRepository: Repository<WebhookEvent>,
  ) { }

  async receive(dto: CreateWebhookEventDto): Promise<WebhookEvent> {
    const event = this.eventsRepository.create({
      eventId: dto.eventId,
      type: dto.type,
      payload: dto.data,
      status: EventStatus.PENDING,
      attempts: 0,
    });
    return this.eventsRepository.save(event);
  }
}
