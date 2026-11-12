import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from '../events/entities/webhook-event.entity';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent])],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSignatureGuard],
})
export class WebhooksModule {}
