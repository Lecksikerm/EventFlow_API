import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateWebhookEventDto } from './dto/create-webhook-event.dto';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { WebhooksService } from './webhooks.service';


@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('/events')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(WebhookSignatureGuard)
  @ApiHeader({ name: 'x-webhook-signature', required: true, description: 'HMAC-SHA256 of the raw body, hex-encoded' })
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
