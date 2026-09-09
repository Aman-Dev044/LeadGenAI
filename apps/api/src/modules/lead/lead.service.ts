import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateLeadDto, UpdateLeadDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { escapeRegex } from '../../common/utils/sanitize';
import { EventBusService, PlatformEvents, LeadChanges } from '../../common/events';
import { AssignmentService } from './assignment.service';

@Injectable()
export class LeadService {
  constructor(
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    private readonly bus: EventBusService,
    private readonly assignment: AssignmentService,
  ) {}

  /** Auto-assign a freshly created lead when the tenant has assignment enabled. */
  private async autoAssign(tenantId: string, lead: any): Promise<void> {
    if (!lead || lead.assignedTo) return;
    const userId = await this.assignment.pickAssignee(tenantId, lead);
    if (!userId) return;
    lead.assignedTo = userId;
    await this.leadModel.updateOne({ _id: lead._id }, { $set: { assignedTo: userId } });
    await this.activityModel.create({
      tenantId,
      leadId: lead._id.toString(),
      type: 'assigned',
      description: 'Auto-assigned by assignment rules',
      newValue: userId,
    });
  }

  async create(tenantId: string, dto: CreateLeadDto, performedBy?: string) {
    const lead = await this.leadModel.create({
      tenantId,
      ...dto,
      lastActivityAt: new Date(),
    });

    await this.activityModel.create({
      tenantId,
      leadId: lead._id.toString(),
      type: 'created',
      description: 'Lead created',
      performedBy,
    });

    await this.autoAssign(tenantId, lead);
    this.bus.emit(PlatformEvents.LEAD_CREATED, { tenantId, lead });
    return lead;
  }

  async captureFromWidget(tenantId: string, data: any) {
    // Check if lead with same email already exists
    if (data.email) {
      const existing = await this.leadModel.findOne({
        tenantId,
        email: data.email,
        deletedAt: null,
      });

      if (existing) {
        // Update existing lead with new data
        if (data.conversationId && !existing.conversationIds.includes(data.conversationId)) {
          existing.conversationIds.push(data.conversationId);
        }
        Object.assign(existing, {
          firstName: data.firstName || existing.firstName,
          lastName: data.lastName || existing.lastName,
          phone: data.phone || existing.phone,
          company: data.company || existing.company,
          customFields: { ...(existing.customFields || {}), ...(data.customFields || {}) },
          metadata: { ...(existing.metadata || {}), ...(data.metadata || {}) },
          lastActivityAt: new Date(),
        });
        await existing.save();
        await this.linkConversation(tenantId, data.conversationId, existing._id.toString());

        await this.activityModel.create({
          tenantId,
          leadId: existing._id.toString(),
          type: 'note_added',
          description: 'Returning visitor: details updated from widget',
        });
        this.bus.emit(PlatformEvents.LEAD_UPDATED, { tenantId, lead: existing, changes: {} });
        return existing;
      }
    }

    const { firstName, lastName, email, phone, company, source, customFields, conversationId, metadata, ...rest } = data;
    const lead = await this.leadModel.create({
      tenantId,
      firstName,
      lastName,
      email,
      phone,
      company,
      source: source || 'widget',
      // Any extra captured fields (dynamic lead fields) live in customFields
      customFields: { ...rest, ...(customFields || {}) },
      metadata: metadata || {},
      conversationIds: conversationId ? [conversationId] : [],
      lastActivityAt: new Date(),
    });

    await this.activityModel.create({
      tenantId,
      leadId: lead._id.toString(),
      type: 'created',
      description: 'Lead captured from widget',
    });

    await this.linkConversation(tenantId, conversationId, lead._id.toString());
    await this.autoAssign(tenantId, lead);
    this.bus.emit(PlatformEvents.LEAD_CREATED, { tenantId, lead, conversationId });
    return lead;
  }

  private async linkConversation(tenantId: string, conversationId: string | undefined, leadId: string) {
    if (!conversationId) return;
    try {
      await this.conversationModel.updateOne({ _id: conversationId, tenantId }, { $set: { leadId } });
    } catch {
      // Conversation link is best-effort
    }
  }

  async findAll(tenantId: string, paginationDto: PaginationDto, filters?: any) {
    const query: any = { tenantId, deletedAt: null };

    if (filters?.status) query.status = filters.status;
    if (filters?.temperature) query.temperature = filters.temperature;
    if (filters?.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters?.source) query.source = filters.source;
    if (filters?.tags) query.tags = { $in: filters.tags.split(',') };

    if (paginationDto.search) {
      const safeSearch = escapeRegex(paginationDto.search);
      query.$or = [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { company: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    return paginate(this.leadModel, query, paginationDto);
  }

  async findById(tenantId: string, leadId: string) {
    const lead = await this.leadModel.findOne({
      _id: leadId,
      tenantId,
      deletedAt: null,
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async update(tenantId: string, leadId: string, dto: UpdateLeadDto, performedBy?: string) {
    const existing = await this.leadModel.findOne({
      _id: leadId,
      tenantId,
      deletedAt: null,
    });
    if (!existing) {
      throw new NotFoundException('Lead not found');
    }

    // Track status change
    if (dto.status && dto.status !== existing.status) {
      await this.activityModel.create({
        tenantId,
        leadId,
        type: 'status_changed',
        description: `Status changed from ${existing.status} to ${dto.status}`,
        oldValue: existing.status,
        newValue: dto.status,
        performedBy,
      });

      if (dto.status === 'converted') {
        dto['convertedAt'] = new Date();
      }
    }

    // Track assignment change
    if (dto.assignedTo && dto.assignedTo !== existing.assignedTo) {
      await this.activityModel.create({
        tenantId,
        leadId,
        type: 'assigned',
        description: `Lead assigned to ${dto.assignedTo}`,
        oldValue: existing.assignedTo,
        newValue: dto.assignedTo,
        performedBy,
      });
    }

    const lead = await this.leadModel.findOneAndUpdate(
      { _id: leadId, tenantId },
      { $set: { ...dto, lastActivityAt: new Date() } },
      { new: true },
    );

    const changes: LeadChanges = {};
    if (dto.status && dto.status !== existing.status) changes.status = { from: existing.status, to: dto.status };
    if (dto.assignedTo && dto.assignedTo !== existing.assignedTo) changes.assignedTo = { from: existing.assignedTo, to: dto.assignedTo };
    if (lead) this.bus.emit(PlatformEvents.LEAD_UPDATED, { tenantId, lead, changes, performedBy });

    return lead;
  }

  async remove(tenantId: string, leadId: string) {
    const lead = await this.leadModel.findOneAndUpdate(
      { _id: leadId, tenantId },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    this.bus.emit(PlatformEvents.LEAD_DELETED, { tenantId, leadId });
    return { message: 'Lead deleted' };
  }

  async getActivities(tenantId: string, leadId: string) {
    return this.activityModel
      .find({ leadId, tenantId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  async addNote(tenantId: string, leadId: string, note: string, performedBy: string) {
    const lead = await this.findById(tenantId, leadId);

    await this.activityModel.create({
      tenantId,
      leadId,
      type: 'note_added',
      description: note,
      performedBy,
    });

    lead.lastActivityAt = new Date();
    await lead.save();

    return { message: 'Note added' };
  }

  async bulkAssign(tenantId: string, leadIds: string[], assignTo: string, performedBy: string) {
    await this.leadModel.updateMany(
      { _id: { $in: leadIds }, tenantId },
      { $set: { assignedTo: assignTo, lastActivityAt: new Date() } },
    );

    const activities = leadIds.map((leadId) => ({
      tenantId,
      leadId,
      type: 'assigned',
      description: `Bulk assigned to ${assignTo}`,
      newValue: assignTo,
      performedBy,
    }));
    await this.activityModel.insertMany(activities);

    const leads = await this.leadModel.find({ _id: { $in: leadIds }, tenantId }).lean();
    for (const lead of leads) {
      this.bus.emit(PlatformEvents.LEAD_UPDATED, {
        tenantId,
        lead,
        changes: { assignedTo: { to: assignTo } },
        performedBy,
      });
    }

    return { message: `${leadIds.length} leads assigned` };
  }

  // ─── CSV Export ───────────────────────────────────────────────────
  async exportToCsv(tenantId: string, filters?: any): Promise<string> {
    const query: any = { tenantId, deletedAt: null };
    if (filters?.status) query.status = filters.status;
    if (filters?.temperature) query.temperature = filters.temperature;
    if (filters?.source) query.source = filters.source;

    const leads = await this.leadModel.find(query).sort({ createdAt: -1 }).lean();

    const headers = [
      'First Name', 'Last Name', 'Email', 'Phone', 'Company',
      'Status', 'Temperature', 'Score', 'Source', 'Tags', 'Created At',
    ];

    const rows = leads.map((lead: any) => [
      this.escapeCsvField(lead.firstName || ''),
      this.escapeCsvField(lead.lastName || ''),
      this.escapeCsvField(lead.email || ''),
      this.escapeCsvField(lead.phone || ''),
      this.escapeCsvField(lead.company || ''),
      lead.status || '',
      lead.temperature || '',
      String(lead.score || 0),
      lead.source || '',
      this.escapeCsvField((lead.tags || []).join(', ')),
      lead.createdAt ? new Date(lead.createdAt).toISOString() : '',
    ]);

    return [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  // ─── CSV Import ───────────────────────────────────────────────────
  async importFromCsv(tenantId: string, csvContent: string, performedBy: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const lines = csvContent.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      return { imported: 0, skipped: 0, errors: ['CSV file is empty or has no data rows'] };
    }

    const headerLine = lines[0];
    const headers = this.parseCsvLine(headerLine).map((h) => h.toLowerCase().trim());

    // Map common header names to lead fields
    const fieldMap: Record<string, string> = {
      'first name': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName', 'name': 'firstName',
      'last name': 'lastName', 'lastname': 'lastName', 'last_name': 'lastName',
      'email': 'email', 'email address': 'email', 'e-mail': 'email',
      'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone', 'contact': 'phone',
      'company': 'company', 'company name': 'company', 'organization': 'company',
      'status': 'status',
      'temperature': 'temperature', 'temp': 'temperature',
      'source': 'source',
      'tags': 'tags',
    };

    const columnMapping: Record<number, string> = {};
    headers.forEach((header, index) => {
      if (fieldMap[header]) {
        columnMapping[index] = fieldMap[header];
      }
    });

    if (Object.keys(columnMapping).length === 0) {
      return { imported: 0, skipped: 0, errors: ['Could not map any CSV columns. Use headers like: First Name, Last Name, Email, Phone, Company, Status, Temperature, Source, Tags'] };
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const validStatuses = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'];
    const validTemps = ['hot', 'warm', 'cold'];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCsvLine(lines[i]);
        const leadData: any = {};

        for (const [colIndex, field] of Object.entries(columnMapping)) {
          const value = values[Number(colIndex)]?.trim();
          if (!value) continue;

          if (field === 'tags') {
            leadData.tags = value.split(',').map((t: string) => t.trim()).filter(Boolean);
          } else if (field === 'status') {
            leadData.status = validStatuses.includes(value.toLowerCase()) ? value.toLowerCase() : 'new';
          } else if (field === 'temperature') {
            leadData.temperature = validTemps.includes(value.toLowerCase()) ? value.toLowerCase() : 'cold';
          } else {
            leadData[field] = value;
          }
        }

        // Must have at least a name or email
        if (!leadData.firstName && !leadData.email) {
          skipped++;
          continue;
        }

        // Check for duplicate emails
        if (leadData.email) {
          const existing = await this.leadModel.findOne({
            tenantId,
            email: leadData.email.toLowerCase(),
            deletedAt: null,
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        const created = await this.leadModel.create({
          tenantId,
          ...leadData,
          source: leadData.source || 'import',
          lastActivityAt: new Date(),
        });
        await this.autoAssign(tenantId, created);
        // Listeners treat source "import" as bulk: scoring + webhooks, no per-lead alerts
        this.bus.emit(PlatformEvents.LEAD_CREATED, { tenantId, lead: created });

        imported++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    // Log import activity
    if (imported > 0) {
      await this.activityModel.create({
        tenantId,
        leadId: 'bulk_import',
        type: 'created',
        description: `CSV import: ${imported} leads imported, ${skipped} skipped`,
        performedBy,
      });
    }

    return { imported, skipped, errors };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
