import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateLeadDto, UpdateLeadDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { paginate } from '../../common/utils/paginate';
import { escapeRegex } from '../../common/utils/sanitize';
import { EventBusService, PlatformEvents, LeadChanges } from '../../common/events';
import { AssignmentService } from './assignment.service';
import { AIProviderFactory } from '../../providers/ai/ai-provider.factory';

@Injectable()
export class LeadService {
  constructor(
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    @InjectModel('Conversation') private readonly conversationModel: Model<any>,
    private readonly bus: EventBusService,
    private readonly assignment: AssignmentService,
    private readonly aiFactory: AIProviderFactory,
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

  /**
   * Salesperson scoping: when `ownerId` is set the caller may only touch leads assigned to them.
   * Managers/admins pass nothing and see the whole tenant.
   */
  private assertOwner(lead: any, ownerId?: string) {
    if (ownerId && String(lead.assignedTo || '') !== String(ownerId)) {
      throw new ForbiddenException('This lead is not assigned to you');
    }
  }

  async create(tenantId: string, dto: CreateLeadDto, performedBy?: string, ownerId?: string) {
    // A salesperson's own leads land in their pipeline unless they explicitly assign elsewhere
    if (ownerId && !dto.assignedTo) dto = { ...dto, assignedTo: ownerId } as CreateLeadDto;
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

  async findAll(tenantId: string, paginationDto: PaginationDto, filters?: any, ownerId?: string) {
    const query: any = { deletedAt: null };
    if (tenantId && tenantId !== 'all') {
      query.tenantId = tenantId;
    }

    if (filters?.status) query.status = filters.status;
    if (filters?.temperature) query.temperature = filters.temperature;
    if (filters?.assignedTo) query.assignedTo = filters.assignedTo;
    if (ownerId) query.assignedTo = ownerId;
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

  async findById(tenantId: string, leadId: string, ownerId?: string) {
    const query: any = { _id: leadId, deletedAt: null };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const lead = await this.leadModel.findOne(query);
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    this.assertOwner(lead, ownerId);
    return lead;
  }

  async update(tenantId: string, leadId: string, dto: UpdateLeadDto, performedBy?: string, ownerId?: string) {
    const query: any = { _id: leadId, deletedAt: null };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
    const existing = await this.leadModel.findOne(query);
    if (existing) this.assertOwner(existing, ownerId);
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

    const filter: any = { _id: leadId, deletedAt: null };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;

    const lead = await this.leadModel.findOneAndUpdate(
      filter,
      { $set: { ...dto, lastActivityAt: new Date() } },
      { new: true },
    );

    const changes: LeadChanges = {};
    if (dto.status && dto.status !== existing.status) changes.status = { from: existing.status, to: dto.status };
    if (dto.assignedTo && dto.assignedTo !== existing.assignedTo) changes.assignedTo = { from: existing.assignedTo, to: dto.assignedTo };
    if (lead) this.bus.emit(PlatformEvents.LEAD_UPDATED, { tenantId: lead.tenantId || tenantId, lead, changes, performedBy });

    return lead;
  }

  async remove(tenantId: string, leadId: string) {
    const filter: any = { _id: leadId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;

    const lead = await this.leadModel.findOneAndUpdate(
      filter,
      { deletedAt: new Date() },
      { new: true },
    );
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    this.bus.emit(PlatformEvents.LEAD_DELETED, { tenantId: lead.tenantId || tenantId, leadId });
    return { message: 'Lead deleted' };
  }

  async getActivities(tenantId: string, leadId: string, ownerId?: string) {
    if (ownerId) await this.findById(tenantId, leadId, ownerId);
    const filter: any = { leadId };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;
    return this.activityModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }

  async addNote(tenantId: string, leadId: string, note: string, performedBy: string, ownerId?: string) {
    const lead = await this.findById(tenantId, leadId, ownerId);

    await this.activityModel.create({
      tenantId: lead.tenantId || (tenantId === 'all' ? lead.tenantId : tenantId),
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
    const filter: any = { _id: { $in: leadIds } };
    if (tenantId && tenantId !== 'all') filter.tenantId = tenantId;

    await this.leadModel.updateMany(
      filter,
      { $set: { assignedTo: assignTo, lastActivityAt: new Date() } },
    );

    const leads = await this.leadModel.find(filter).lean();
    const activities = leads.map((l: any) => ({
      tenantId: l.tenantId,
      leadId: l._id.toString(),
      type: 'assigned',
      description: `Bulk assigned to ${assignTo}`,
      newValue: assignTo,
      performedBy,
    }));
    if (activities.length > 0) {
      await this.activityModel.insertMany(activities);
    }

    for (const lead of leads) {
      this.bus.emit(PlatformEvents.LEAD_UPDATED, {
        tenantId: lead.tenantId,
        lead,
        changes: { assignedTo: { to: assignTo } },
        performedBy,
      });
    }

    return { message: `${leadIds.length} leads assigned` };
  }

  // ─── CSV Export ───────────────────────────────────────────────────
  async exportToCsv(tenantId: string, filters?: any): Promise<string> {
    const query: any = { deletedAt: null };
    if (tenantId && tenantId !== 'all') query.tenantId = tenantId;
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

  /**
   * Point 3: Generate an Executive AI Dossier & Buyer Intelligence Cheat Sheet
   */
  async generateLeadDossier(tenantId: string, leadId: string, ownerId?: string) {
    const lead = await this.leadModel.findOne({ _id: leadId, tenantId, deletedAt: null });
    if (!lead) throw new NotFoundException('Lead not found');
    this.assertOwner(lead, ownerId);

    const conversations = await this.conversationModel
      .find({ tenantId, leadId: lead._id })
      .limit(3)
      .lean();

    const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Prospect';
    const email = lead.email || '';
    const domain = email.includes('@') ? email.split('@')[1].toLowerCase() : '';
    const isFreeMail = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain);
    const company = lead.company || (domain && !isFreeMail ? domain.replace(/\.[a-z]+$/, '').toUpperCase() : 'Independent Prospect');

    const contextPrompt = `
Lead Name: ${name}
Company: ${company}
Email: ${email}
Phone: ${lead.phone || 'N/A'}
Temperature: ${lead.temperature || 'cold'}
Lead Score: ${lead.score || 0}
Source: ${lead.source || 'Website'}
Custom Fields: ${JSON.stringify(lead.customFields || {})}
Prior Summary: ${lead.aiSummary || 'None'}
Prior Insights: ${JSON.stringify(lead.aiInsights || {})}
Recent Conversations: ${conversations.length}
`;

    let dossier: any = null;

    try {
      const provider = this.aiFactory.getProvider();
      const completion = await provider.chatCompletion(
        [
          {
            role: 'system',
            content: `You are an elite B2B Sales Intelligence Strategist. Given lead information, generate an executive briefing dossier in strict JSON with keys:
- companySummary (string): 2-sentence summary of what this organization/prospect does and their market context.
- estimatedSize (string): e.g. "Startup (<10)", "Growth SMB (10-50)", "Mid-Market (50-250)", or "Enterprise (250+)".
- industry (string): e.g. "SaaS / Technology", "Real Estate", "Professional Services", "E-Commerce", etc.
- buyerIntent (string): Analysis of their readiness to buy (High, Medium, Warm Discovery) with specific indicators.
- painPoints (array of strings): 2 to 3 key business pain points they are likely trying to solve.
- dealClosingPitch (string): 2-3 sentence power-pitch tailored directly to this lead for a sales rep to close the deal.
- recommendedAction (string): The single most effective immediate next step to convert this lead.

Output valid JSON only. No markdown formatting.`,
          },
          {
            role: 'user',
            content: contextPrompt,
          },
        ],
        { temperature: 0.3, maxTokens: 650 },
      );

      const cleaned = (completion.content || '').replace(/```json\n?|\n?```/g, '').trim();
      dossier = JSON.parse(cleaned);
    } catch {
      // Intelligent heuristic fallback ensures zero failures even if no AI key is active
      const isHighIntent = (lead.score && lead.score > 40) || lead.temperature === 'hot' || lead.source === 'webhook_meta' || lead.source === 'webhook_whatsapp';
      dossier = {
        companySummary: `${company} is actively exploring automated conversational AI and lead qualification infrastructure via ${lead.source || 'digital channels'}.`,
        estimatedSize: isFreeMail ? 'Emerging Business / Solopreneur (<10)' : 'SMB / Mid-Market (15-75)',
        industry: isFreeMail ? 'Direct Services / Specialist' : 'Commercial Enterprise / Tech Services',
        buyerIntent: isHighIntent
          ? 'High Intent — Actively engaging and comparing automated response tools.'
          : 'Discovery Phase — Researching lead acceleration and 24/7 capture capabilities.',
        painPoints: [
          'Slow inbound response times causing prospective leads to drop off',
          'Lack of 24/7 qualification before booking calls on sales calendar',
          'Manual follow-ups consuming too many team hours each week',
        ],
        dealClosingPitch: `Showcase how our platform answers inbound queries in under 3 seconds, automatically capturing verified phone and email details directly into their CRM. Offer a custom 15-minute live pilot with zero credit card required.`,
        recommendedAction: `Send a personalized WhatsApp voice note or message to ${name} within 30 minutes referencing their ${company} inquiry.`,
      };
    }

    dossier.generatedAt = new Date();

    await this.leadModel.updateOne(
      { _id: lead._id, tenantId },
      { $set: { dossier } },
    );

    await this.activityModel.create({
      tenantId,
      leadId: lead._id.toString(),
      type: 'note_added',
      description: 'AI Executive Dossier & Buyer Intelligence generated',
    });

    return dossier;
  }

  /**
   * Point 4: Generate a Personalized WhatsApp Voice Note Script & Launcher
   */
  async generateVoiceNoteScript(tenantId: string, leadId: string, ownerId?: string) {
    const lead = await this.leadModel.findOne({ _id: leadId, tenantId, deletedAt: null });
    if (!lead) throw new NotFoundException('Lead not found');
    this.assertOwner(lead, ownerId);

    const name = lead.firstName || 'there';
    const company = lead.company || 'your team';

    let voiceNote: any = null;

    try {
      const provider = this.aiFactory.getProvider();
      const completion = await provider.chatCompletion(
        [
          {
            role: 'system',
            content: `You are an elite sales director. Write a high-converting, human, warm, natural 30-40 second WhatsApp Voice Note script that a sales rep will record directly to this prospect.
Return strict JSON with:
- script: The exact words to speak. Conversational, charismatic, respectful of their time. Starts with "Hey ${name}, this is [Rep Name] from our team..."
- durationEstimate: estimated audio length, e.g. "35s"
- angle: strategy used, e.g. "Consultative Walkthrough Offer"
Output valid JSON only. No markdown fences.`,
          },
          {
            role: 'user',
            content: `Lead Name: ${name}
Company: ${company}
Source: ${lead.source || 'Website'}
Score: ${lead.score || 0}
Temperature: ${lead.temperature || 'warm'}
Context: ${lead.aiSummary || 'Inquired about lead capture solutions'}`,
          },
        ],
        { temperature: 0.4, maxTokens: 450 },
      );

      const cleaned = (completion.content || '').replace(/```json\n?|\n?```/g, '').trim();
      voiceNote = JSON.parse(cleaned);
    } catch {
      voiceNote = {
        script: `Hey ${name}! I noticed you were checking out our platform for ${company}. Rather than sending a boring robotic email, I wanted to record a quick personalized note. I know your calendar is packed, but we help businesses capture and qualify inbound leads automatically in under 5 seconds. If you're open to it, I can shoot over a 2-minute quick walkthrough video right here on WhatsApp, or we can jump on a rapid 10-minute demo. Let me know what works best for you!`,
        durationEstimate: '35s',
        angle: 'Warm Consultative Video/Demo Offer',
      };
    }

    voiceNote.generatedAt = new Date();

    const cleanPhone = (lead.phone || '').replace(/[^\d]/g, '');
    const introText = encodeURIComponent(
      `Hi ${name}, thanks for checking us out! I just sent you a quick personalized voice note above. Let me know when you have 30 seconds to take a listen!`,
    );
    const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${introText}` : null;

    await this.leadModel.updateOne(
      { _id: lead._id, tenantId },
      { $set: { voiceNoteScript: voiceNote } },
    );

    await this.activityModel.create({
      tenantId,
      leadId: lead._id.toString(),
      type: 'note_added',
      description: 'Personalized WhatsApp Voice Note script generated',
    });

    return {
      ...voiceNote,
      whatsappUrl,
      phone: lead.phone,
    };
  }
}
