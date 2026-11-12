import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueModule } from '../queue/queue.module';
import { WebhookEvent } from './entities/webhook-event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent]), QueueModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
