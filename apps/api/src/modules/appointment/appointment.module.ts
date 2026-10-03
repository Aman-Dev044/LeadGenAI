import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { AppointmentSchema } from '../../schemas/appointment.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { UserSchema } from '../../schemas/user.schema';
import { AppointmentEmailService } from './appointment-email.service';
import { AppointmentReminderService } from './appointment-reminder.service';
import { LeadSchema } from '../../schemas/lead.schema';
import { LeadActivitySchema } from '../../schemas/lead-activity.schema';
import { CalendarModule } from '../calendar/calendar.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Lead', schema: LeadSchema },
      { name: 'LeadActivity', schema: LeadActivitySchema },
    ]),
    CalendarModule,
    NotificationModule,
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService, AppointmentEmailService, AppointmentReminderService],
  exports: [AppointmentService],
})
export class AppointmentModule {}
