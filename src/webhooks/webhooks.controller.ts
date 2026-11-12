import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateWebhookEventDto } from './dto/create-webhook-event.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('/events')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive a webhook event' })
  async receive(@Body() dto: CreateWebhookEventDto) {
    const event = await this.webhooksService.receive(dto);
    return {
      message: 'Event received',
      eventId: event.eventId,
      status: event.status,
    };
  }
}
