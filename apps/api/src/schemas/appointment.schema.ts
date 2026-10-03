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

  /** Whose calendar holds the mirrored event (the assignee at sync time). */
  @Prop({ type: String })
  calendarOwnerUserId: string;

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

  /** Who created it: ai (on a call), user (dashboard), widget (visitor self-booking). */
  @Prop({ type: String, enum: ['ai', 'user', 'widget', 'api'], default: 'user' })
  bookedBy: string;

  /** When each reminder went out - the sweep never sends one twice. */
  @Prop({
    type: { dayBeforeAt: Date, hourBeforeAt: Date, salespersonAt: Date },
    _id: false,
    default: {},
  })
  reminders: { dayBeforeAt?: Date; hourBeforeAt?: Date; salespersonAt?: Date };

  /** Meeting time passed with nobody marking it done: the salesperson was asked. */
  @Prop()
  outcomeAskedAt: Date;

  @Prop()
  noShowAt: Date;

  @Prop()
  completedAt: Date;

  /** What the no-show rescue did (missed-meeting WhatsApp, AI reschedule call). */
  @Prop({ type: Object })
  rescue: { whatsappAt?: Date; callId?: string; callQueuedAt?: Date; rescheduledAt?: Date };

  /** Google Meet / conference link created with the calendar event. */
  @Prop({ type: String })
  conferenceLink: string;

  /** Last calendar sync problem; cleared when a sync succeeds. */
  @Prop({ type: String })
  calendarSyncError: string;

  @Prop()
  calendarSyncedAt: Date;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

AppointmentSchema.index({ tenantId: 1, assignedTo: 1, startTime: 1 });
AppointmentSchema.index({ tenantId: 1, status: 1 });
AppointmentSchema.index({ tenantId: 1, leadId: 1 });
AppointmentSchema.index({ status: 1, startTime: 1 });
