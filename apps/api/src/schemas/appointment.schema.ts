import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AppointmentDocument = HydratedDocument<Appointment>;

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  leadId: string;

  @Prop({ index: true })
  conversationId: string;

  @Prop({ required: true })
  assignedTo: string;

  @Prop({ required: true })
  title: string;

  @Prop({ type: String })
  description: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ type: String, default: 'Asia/Kolkata' })
  timezone: string;

  @Prop({
    type: String,
    enum: ['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'scheduled',
  })
  status: string;

  @Prop({
    type: {
      name: String,
      email: String,
      phone: String,
    },
  })
  attendee: {
    name?: string;
    email?: string;
    phone?: string;
  };

  @Prop({ type: String })
  meetingLink: string;

  @Prop({ type: String })
  location: string;

  @Prop({
    type: String,
    enum: ['internal', 'google', 'outlook', 'calendly'],
    default: 'internal',
  })
  calendarProvider: string;

  @Prop({ type: String })
  externalCalendarId: string;

  @Prop({ type: String })
  cancellationReason: string;

  @Prop()
  cancelledAt: Date;

  @Prop({ default: 0 })
  rescheduledCount: number;

  @Prop({
    type: [{
      fromStartTime: Date,
      fromEndTime: Date,
      toStartTime: Date,
      toEndTime: Date,
      reason: String,
      at: Date,
    }],
    default: [],
  })
  rescheduleHistory: {
    fromStartTime: Date;
    fromEndTime: Date;
    toStartTime: Date;
    toEndTime: Date;
    reason?: string;
    at: Date;
  }[];

  @Prop()
  reminderSentAt: Date;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

AppointmentSchema.index({ tenantId: 1, assignedTo: 1, startTime: 1 });
AppointmentSchema.index({ tenantId: 1, status: 1 });
AppointmentSchema.index({ tenantId: 1, leadId: 1 });
