import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from '../events/entities/webhook-event.entity';
import { WEBHOOK_QUEUE } from './queue.constants';
import { WebhookProcessor } from './processors/webhook.processor';

const webhookQueue = BullModule.registerQueue({ name: WEBHOOK_QUEUE });

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: Number(config.getOrThrow<string>('REDIS_PORT')),
        },
      }),
    }),
    webhookQueue,
    TypeOrmModule.forFeature([WebhookEvent]),
  ],
  providers: [WebhookProcessor],
  exports: [webhookQueue],
})
export class QueueModule {}
