import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';

export class CreateWebhookEventDto {
  @ApiProperty({ example: 'evt_001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eventId: string;

  @ApiProperty({ example: 'payment.success' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;

  @ApiProperty({
    example: { customerId: 'cus_123', amount: 5000, currency: 'NGN' },
  })
  @IsObject()
  data: Record<string, any>;
}
