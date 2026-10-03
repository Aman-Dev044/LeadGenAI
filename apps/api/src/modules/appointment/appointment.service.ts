import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateAppointmentDto, UpdateAppointmentDto, RescheduleAppointmentDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { EventBusService, PlatformEvents } from '../../common/events';
import { AppointmentEmailService } from './appointment-email.service';
import { GoogleCalendarService } from '../calendar/google-calendar.service';

function cleanAttendeeName(name?: string): string {
  if (!name) return 'Visitor';
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  const cleaned: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i].toLowerCase() === words[i - 1].toLowerCase()) {
      continue;
    }
    cleaned.push(words[i]);
  }
  return cleaned.join(' ');
}

@Injectable()
export class AppointmentService {
  constructor(
    @InjectModel('Appointment') private readonly appointmentModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    private readonly bus: EventBusService,
    private readonly emails: AppointmentEmailService,
    private readonly google: GoogleCalendarService,
  ) {}

  /** Short name for conflict messages. */
  private async userName(userId?: string): Promise<string> {
    if (!userId || !/^[a-f\d]{24}$/i.test(userId)) return 'the salesperson';
    const u: any = await this.userModel.findById(userId).select('firstName lastName').lean();
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'the salesperson' : 'the salesperson';
  }

  /**
   * The salesperson's Google Calendar has the final say on whether a slot is
   * free: a conflict there blocks the booking just like one in our own table.
   */
  private async assertGoogleFree(tenantId: string, assignedTo: string | undefined, start: Date, end: Date, ignoreEventId?: string) {
    const clash = await this.google.conflictFor(tenantId, assignedTo, start, end, ignoreEventId);
    if (clash) {
      const who = await this.userName(assignedTo);
      throw new BadRequestException(
        `Time slot conflicts with "${clash.title || 'an event'}" in ${who}'s Google Calendar`,
      );
    }
  }

  async create(tenantId: string, dto: CreateAppointmentDto & { bookedBy?: string }) {
    // Resolve assignedTo if missing or set to tenantId
    let assignedTo = dto.assignedTo;
    if (!assignedTo || assignedTo === tenantId) {
      const salesperson: any = await this.userModel.findOne({
        tenantId,
        isActive: true,
        role: { $in: ['SALESPERSON', 'SALES_MANAGER', 'ADMIN'] },
      }).sort({ role: 1 }).lean();
      if (salesperson?._id) {
        assignedTo = salesperson._id.toString();
      }
    }

    // Check for double-booking
    const conflict = await this.appointmentModel.findOne({
      tenantId,
      assignedTo,
      status: { $in: ['scheduled', 'confirmed'] },
      $or: [
        {
          startTime: { $lt: new Date(dto.endTime) },
          endTime: { $gt: new Date(dto.startTime) },
        },
      ],
    });

    if (conflict) {
      throw new BadRequestException('Time slot conflicts with an existing appointment');
    }
    await this.assertGoogleFree(tenantId, assignedTo, new Date(dto.startTime), new Date(dto.endTime));

    const cleanedAttendee = dto.attendee ? {
      ...dto.attendee,
      name: cleanAttendeeName(dto.attendee.name),
    } : undefined;

    const title = dto.title
      ? dto.title.replace(/Meeting with (.+)/i, (_, n) => `Meeting with ${cleanAttendeeName(n)}`)
      : `Meeting with ${cleanedAttendee?.name || 'Visitor'}`;

    const appointment = await this.appointmentModel.create({
      tenantId,
      ...dto,
      title,
      assignedTo: assignedTo || dto.assignedTo,
      attendee: cleanedAttendee,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      bookedBy: ['ai', 'user', 'widget', 'api'].includes(dto.bookedBy || '') ? dto.bookedBy : 'user',
    });
    this.bus.emit(PlatformEvents.APPOINTMENT_CREATED, { tenantId, appointment });
    this.emails.notify('confirmation', tenantId, appointment);
    void this.google.upsertEvent(appointment);
    return appointment;
  }

  async findAll(tenantId: string, paginationDto: PaginationDto, filters?: any) {
    const query: any = {};
    if (tenantId && tenantId !== 'all') {
      query.tenantId = tenantId;
    }
    if (filters?.status) query.status = filters.status;
    if (filters?.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters?.from) query.startTime = { $gte: new Date(filters.from) };
    if (filters?.to) {
      query.startTime = { ...query.startTime, $lte: new Date(filters.to) };
    }

    const paginated = await paginate(this.appointmentModel, query, {
      ...paginationDto,
      sortBy: 'startTime',
      sortOrder: 'asc',
    });

    const userIds = [...new Set((paginated.data || []).map((a: any) => a.assignedTo).filter(Boolean))];
    if (userIds.length > 0) {
      const users = await this.userModel.find({ _id: { $in: userIds } }).select('firstName lastName email role').lean();
      const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
      paginated.data = (paginated.data || []).map((a: any) => {
        const plain = typeof a.toObject === 'function' ? a.toObject() : a;
        return {
          ...plain,
          assignedUser: userMap.get(String(plain.assignedTo)) || null,
        };
      });
    }

    return paginated;
  }

  async findById(tenantId: string, appointmentId: string) {
    const filter: any = { _id: appointmentId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const appointment = await this.appointmentModel.findOne(filter);
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async update(tenantId: string, appointmentId: string, dto: UpdateAppointmentDto, actorId?: string) {
    // Outcome changes have their own flows (rescue, calendar, activity log)
    if (dto.status === 'no_show') return this.markNoShow(tenantId, appointmentId, actorId || 'user');
    if (dto.status === 'completed') return this.complete(tenantId, appointmentId, actorId || 'user');
    if (dto.status === 'cancelled') return this.cancel(tenantId, appointmentId, dto.cancellationReason);

    const updateData: any = { ...dto };
    if (dto.startTime) updateData.startTime = new Date(dto.startTime);
    if (dto.endTime) updateData.endTime = new Date(dto.endTime);

    const filter: any = { _id: appointmentId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;

    const appointment = await this.appointmentModel.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true },
    );
    if (!appointment) throw new NotFoundException('Appointment not found');
    this.bus.emit(PlatformEvents.APPOINTMENT_UPDATED, { tenantId: appointment.tenantId || tenantId, appointment });
    if (['scheduled', 'confirmed'].includes(appointment.status)) void this.google.upsertEvent(appointment);
    return appointment;
  }

  async cancel(tenantId: string, appointmentId: string, reason?: string) {
    const filter: any = { _id: appointmentId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;

    const appointment = await this.appointmentModel.findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      },
      { new: true },
    );
    if (!appointment) throw new NotFoundException('Appointment not found');
    const targetTenant = appointment.tenantId || tenantId;
    this.bus.emit(PlatformEvents.APPOINTMENT_UPDATED, { tenantId: targetTenant, appointment });
    this.emails.notify('cancellation', targetTenant, appointment, { reason });
    void this.google.deleteEvent(appointment);
    return appointment;
  }

  /** The meeting happened. */
  async complete(tenantId: string, appointmentId: string, markedBy = 'user', notes?: string) {
    const filter: any = { _id: appointmentId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const appointment = await this.appointmentModel.findOne(filter);
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.status === 'completed') return appointment;
    appointment.status = 'completed';
    appointment.completedAt = new Date();
    if (notes) appointment.description = [appointment.description, notes].filter(Boolean).join('\n');
    await appointment.save();
    const targetTenant = appointment.tenantId || tenantId;
    this.bus.emit(PlatformEvents.APPOINTMENT_UPDATED, { tenantId: targetTenant, appointment });
    this.bus.emit(PlatformEvents.APPOINTMENT_COMPLETED, { tenantId: targetTenant, appointment, markedBy });
    if (appointment.leadId && /^[a-f\d]{24}$/i.test(appointment.leadId)) {
      await this.activityModel
        .create({
          tenantId: targetTenant,
          leadId: appointment.leadId,
          type: 'note_added',
          description: `Meeting held: ${appointment.title}${notes ? ` - ${notes}` : ''}`,
          performedBy: /^[a-f\d]{24}$/i.test(markedBy) ? markedBy : undefined,
          newValue: { appointmentId: String(appointment._id) },
        })
        .catch(() => undefined);
    }
    return appointment;
  }

  /**
   * The lead did not turn up. Marked by the salesperson, or by the reminder
   * sweep when nobody said otherwise. CallingService picks up the event and
   * runs the rescue: a "we missed you" WhatsApp and an AI call to fix a new time.
   */
  async markNoShow(tenantId: string, appointmentId: string, markedBy = 'user') {
    const filter: any = { _id: appointmentId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const appointment = await this.appointmentModel.findOne(filter);
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (!['scheduled', 'confirmed'].includes(appointment.status)) return appointment;
    appointment.status = 'no_show';
    appointment.noShowAt = new Date();
    await appointment.save();
    const targetTenant = appointment.tenantId || tenantId;
    this.bus.emit(PlatformEvents.APPOINTMENT_UPDATED, { tenantId: targetTenant, appointment });
    this.bus.emit(PlatformEvents.APPOINTMENT_NO_SHOW, { tenantId: targetTenant, appointment, markedBy });
    if (appointment.leadId && /^[a-f\d]{24}$/i.test(appointment.leadId)) {
      await this.activityModel
        .create({
          tenantId: targetTenant,
          leadId: appointment.leadId,
          type: 'note_added',
          description: `No-show: ${appointment.title} (${markedBy === 'auto' ? 'nobody marked it done after the meeting time' : 'marked by the team'})`,
          performedBy: /^[a-f\d]{24}$/i.test(markedBy) ? markedBy : undefined,
          newValue: { appointmentId: String(appointment._id) },
        })
        .catch(() => undefined);
    }
    return appointment;
  }

  /** What the no-show rescue did, for the appointment row. */
  async recordRescue(appointmentId: string, patch: Record<string, any>) {
    const set: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) set[`rescue.${k}`] = v;
    await this.appointmentModel.updateOne({ _id: appointmentId }, { $set: set });
  }

  /** Latest meetings for a lead (any status) - context for the AI agent. */
  async recentForLead(tenantId: string, leadId: string, limit = 3) {
    return this.appointmentModel
      .find({ tenantId, leadId })
      .sort({ startTime: -1 })
      .limit(limit)
      .select('title startTime endTime status rescheduledCount noShowAt meetingLink conferenceLink assignedTo')
      .lean();
  }

  /** Open (or missed) meeting for a lead - what an AI reschedule call should move. */
  async openForLead(tenantId: string, leadId: string) {
    return this.appointmentModel
      .findOne({ tenantId, leadId, status: { $in: ['scheduled', 'confirmed', 'no_show'] } })
      .sort({ startTime: -1 })
      .lean();
  }

  /**
   * Move an appointment to a new slot. Works for scheduled, confirmed, cancelled and
   * no-show appointments (a cancelled one becomes scheduled again). Completed ones cannot move.
   */
  async reschedule(tenantId: string, appointmentId: string, dto: RescheduleAppointmentDto) {
    const filter: any = { _id: appointmentId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    const appointment = await this.appointmentModel.findOne(filter);
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.status === 'completed') {
      throw new BadRequestException('A completed appointment cannot be rescheduled');
    }

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('Invalid date/time');
    if (end <= start) throw new BadRequestException('End time must be after start time');

    // Double-booking check for the same salesperson, ignoring this appointment itself
    const conflict = await this.appointmentModel.findOne({
      _id: { $ne: appointmentId },
      tenantId,
      assignedTo: appointment.assignedTo,
      status: { $in: ['scheduled', 'confirmed'] },
      startTime: { $lt: end },
      endTime: { $gt: start },
    });
    if (conflict) throw new BadRequestException('New time slot conflicts with an existing appointment');
    await this.assertGoogleFree(tenantId, appointment.assignedTo, start, end, appointment.externalCalendarId);
    const wasNoShow = appointment.status === 'no_show';

    appointment.rescheduleHistory = [
      ...(appointment.rescheduleHistory || []),
      {
        fromStartTime: appointment.startTime,
        fromEndTime: appointment.endTime,
        toStartTime: start,
        toEndTime: end,
        reason: dto.reason,
        at: new Date(),
      },
    ];
    const previousStart = appointment.startTime;
    appointment.rescheduledCount = (appointment.rescheduledCount || 0) + 1;
    appointment.startTime = start;
    appointment.endTime = end;
    appointment.status = 'scheduled';
    appointment.cancellationReason = undefined;
    appointment.cancelledAt = undefined;
    appointment.reminderSentAt = undefined;
    // A moved meeting gets fresh reminders and a fresh outcome check
    appointment.reminders = {};
    appointment.outcomeAskedAt = undefined;
    appointment.noShowAt = undefined;
    if (wasNoShow) appointment.rescue = { ...(appointment.rescue || {}), rescheduledAt: new Date() };
    await appointment.save();

    this.bus.emit(PlatformEvents.APPOINTMENT_UPDATED, { tenantId, appointment });
    this.emails.notify('reschedule', tenantId, appointment, { previousStart, reason: dto.reason });
    void this.google.upsertEvent(appointment);
    return appointment;
  }

  /** Permanently deletes an appointment record. */
  async remove(tenantId: string, appointmentId: string) {
    const appointment = await this.appointmentModel.findOne({ _id: appointmentId, tenantId });
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.appointmentModel.deleteOne({ _id: appointmentId, tenantId });
    void this.google.deleteEvent(appointment);
    this.bus.emit(PlatformEvents.APPOINTMENT_UPDATED, { tenantId, appointment: { ...appointment.toObject(), deleted: true } });
    return { message: 'Appointment deleted' };
  }

  async getAvailableSlots(
    tenantId: string,
    assignedTo: string,
    date: string,
    durationMinutes = 30,
  ) {
    const dayStart = new Date(date);
    dayStart.setHours(9, 0, 0, 0); // Default 9 AM
    const dayEnd = new Date(date);
    dayEnd.setHours(18, 0, 0, 0); // Default 6 PM

    // Get existing appointments for the day - ours plus whatever is on the
    // salesperson's Google Calendar
    const existing: { startTime: Date; endTime: Date }[] = (await this.appointmentModel.find({
      tenantId,
      assignedTo,
      status: { $in: ['scheduled', 'confirmed'] },
      startTime: { $gte: dayStart, $lt: dayEnd },
    }).sort({ startTime: 1 }).lean()) as any;
    const googleBusy = await this.google.busyBetween(tenantId, assignedTo, dayStart, dayEnd);
    for (const b of googleBusy) existing.push({ startTime: b.start, endTime: b.end });

    // Generate available slots
    const slots: { start: Date; end: Date }[] = [];
    let cursor = dayStart.getTime();
    const slotDuration = durationMinutes * 60 * 1000;

    while (cursor + slotDuration <= dayEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + slotDuration);

      const hasConflict = existing.some(
        (apt: any) =>
          new Date(apt.startTime).getTime() < slotEnd.getTime() &&
          new Date(apt.endTime).getTime() > slotStart.getTime(),
      );

      if (!hasConflict) {
        slots.push({ start: slotStart, end: slotEnd });
      }

      cursor += slotDuration;
    }

    return slots;
  }

  async bookFromWidget(
    tenantId: string,
    data: {
      assignedTo: string;
      startTime: string;
      endTime: string;
      attendee: { name?: string; email?: string; phone?: string };
      leadId?: string;
      conversationId?: string;
    },
  ) {
    const cleanedName = cleanAttendeeName(data.attendee?.name);
    return this.create(tenantId, {
      title: `Meeting with ${cleanedName}`,
      assignedTo: data.assignedTo,
      startTime: data.startTime,
      endTime: data.endTime,
      attendee: {
        ...data.attendee,
        name: cleanedName,
      },
      leadId: data.leadId,
      conversationId: data.conversationId,
      bookedBy: 'widget',
    });
  }
}
