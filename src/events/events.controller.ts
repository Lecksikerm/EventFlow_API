import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventsService } from './events.service';
import { EventStatus } from './enums/event-status.enum';

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // Declared before ':id' so "stats" is not parsed as an event id.
  @Get('stats')
  @ApiOperation({ summary: 'Get event counts by status' })
  getStats() {
    return this.eventsService.getStats();
  }

  @Get()
  @ApiOperation({ summary: 'List recent events, optionally filtered by status' })
  @ApiQuery({ name: 'status', enum: EventStatus, required: false })
  findAll(@Query('status') status?: EventStatus) {
    return this.eventsService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one event' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findOne(id);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed event' })
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.retry(id);
  }
}
