import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupportTicketController } from './support-ticket.controller';
import { SupportTicketService } from './support-ticket.service';
import { SupportTicketSchema } from '../../schemas/support-ticket.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SupportTicket', schema: SupportTicketSchema },
    ]),
  ],
  controllers: [SupportTicketController],
  providers: [SupportTicketService],
  exports: [SupportTicketService],
})
export class SupportTicketModule {}
