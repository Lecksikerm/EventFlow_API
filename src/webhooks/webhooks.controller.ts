import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateWebhookEventDto } from './dto/create-webhook-event.dto';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(WebhookSignatureGuard)
  @ApiOperation({ summary: 'Receive a webhook event' })
  @ApiHeader({
    name: 'x-webhook-signature',
    required: true,
    description: 'HMAC-SHA256 of the raw body, hex-encoded',
  })
  async receive(@Body() dto: CreateWebhookEventDto) {
    const { event, isDuplicate } = await this.webhooksService.receive(dto);

    return {
      message: isDuplicate ? 'Duplicate event, already received' : 'Event received',
      eventId: event.eventId,
      status: event.status,
      duplicate: isDuplicate,
    };
  }
}
