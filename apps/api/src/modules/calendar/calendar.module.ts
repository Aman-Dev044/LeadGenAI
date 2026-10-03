import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalendarController } from './calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { CalendarConnectionSchema } from '../../schemas/calendar-connection.schema';
import { AppointmentSchema } from '../../schemas/appointment.schema';
import { UserSchema } from '../../schemas/user.schema';

/**
 * External calendars for the sales team (Google today). AppointmentModule
 * imports this to mirror bookings and to check free/busy before confirming.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CalendarConnection', schema: CalendarConnectionSchema },
      { name: 'Appointment', schema: AppointmentSchema },
      { name: 'User', schema: UserSchema },
    ]),
  ],
  controllers: [CalendarController],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class CalendarModule {}
