import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiKeyService } from '../api-key/api-key.service';
import { AssignmentService } from '../lead/assignment.service';
import { EventBusService, PlatformEvents } from '../../common/events';

export interface IngestedLeadResult {
  success: boolean;
  leadId: string;
  isNew: boolean;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  message?: string;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectModel('Lead') private readonly leadModel: Model<any>,
    @InjectModel('LeadActivity') private readonly activityModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    private readonly apiKeyService: ApiKeyService,
    private readonly assignment: AssignmentService,
    private readonly bus: EventBusService,
  ) {}

  /**
   * Resolve a tenant from an API key (`ak_...`) or direct tenant ID.
   */
  async resolveTenant(tokenOrKey: string): Promise<any> {
    if (!tokenOrKey) {
      throw new UnauthorizedException('API key or webhook token is required');
    }

    // 1. Try API Key validation
    if (tokenOrKey.startsWith('ak_')) {
      const apiKeyDoc = await this.apiKeyService.validateKey(tokenOrKey);
      if (apiKeyDoc) {
        const tenant = await this.tenantModel.findById(apiKeyDoc.tenantId).lean();
        if (tenant) return tenant;
      }
    }

    // 2. Try direct tenant ID lookup
    try {
      const tenant = await this.tenantModel.findOne({ _id: tokenOrKey, status: { $ne: 'cancelled' } }).lean();
      if (tenant) return tenant;
    } catch {}

    // 3. Try tenant slug
    const tenantBySlug = await this.tenantModel.findOne({ slug: tokenOrKey.toLowerCase(), status: { $ne: 'cancelled' } }).lean();
    if (tenantBySlug) return tenantBySlug;

    throw new UnauthorizedException('Invalid or expired API key / Webhook token');
  }

  /**
   * Normalize flexible incoming payloads into standardized lead fields:
   * Name, Email, Phone number, Company, Source, Notes & Custom Fields.
   */
  normalizePayload(body: Record<string, any>, defaultSource = 'webhook') {
    if (!body || typeof body !== 'object') return { firstName: 'Lead', source: defaultSource, customFields: {} };

    // Standardize keys (lowercase trimmed)
    const lowerMap: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) {
        lowerMap[k.toLowerCase().replace(/[\s_-]+/g, '')] = v;
      }
    }

    // Extract Full Name / First Name / Last Name
    let firstName = body.firstName || body.first_name || lowerMap.firstname || '';
    let lastName = body.lastName || body.last_name || lowerMap.lastname || '';
    const fullName = body.name || body.fullName || body.full_name || lowerMap.name || lowerMap.fullname || '';

    if (!firstName && fullName) {
      const parts = String(fullName).trim().split(/\s+/);
      firstName = parts[0] || 'Lead';
      lastName = parts.slice(1).join(' ') || '';
    }
    if (!firstName) firstName = 'New Lead';

    // Extract Email
    const rawEmail = body.email || body.emailAddress || lowerMap.email || lowerMap.emailaddress || lowerMap['e-mail'] || '';
    const email = typeof rawEmail === 'string' && rawEmail.includes('@') ? rawEmail.trim().toLowerCase() : undefined;

    // Extract Phone Number
    const rawPhone =
      body.phone ||
      body.phoneNumber ||
      body.phone_number ||
      body.mobile ||
      body.contact ||
      lowerMap.phone ||
      lowerMap.phonenumber ||
      lowerMap.mobile ||
      lowerMap.contact ||
      lowerMap.whatsapp ||
      lowerMap.whatsappnumber ||
      '';
    const phone = rawPhone ? String(rawPhone).trim() : undefined;

    // Extract Company
    const company =
      body.company ||
      body.companyName ||
      body.company_name ||
      body.organization ||
      body.business ||
      lowerMap.company ||
      lowerMap.companyname ||
      lowerMap.organization ||
      undefined;

    // Extract Source
    const source = body.source || lowerMap.source || defaultSource;

    // Extract Notes / Message
    const notes = body.notes || body.message || body.query || body.comments || lowerMap.notes || lowerMap.message || lowerMap.query || '';

    // Collect all other attributes as customFields
    const standardKeys = new Set([
      'firstname', 'lastname', 'name', 'fullname',
      'email', 'emailaddress', 'e-mail',
      'phone', 'phonenumber', 'mobile', 'contact', 'whatsapp', 'whatsappnumber',
      'company', 'companyname', 'organization', 'business',
      'source', 'notes', 'message', 'query', 'comments',
    ]);

    const customFields: Record<string, any> = {};
    if (notes) customFields.notes = notes;

    for (const [k, v] of Object.entries(body)) {
      const cleanedKey = k.toLowerCase().replace(/[\s_-]+/g, '');
      if (!standardKeys.has(cleanedKey) && typeof v !== 'object') {
        customFields[k] = v;
      }
    }

    return {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email,
      phone,
      company: company ? String(company).trim() : undefined,
      source: String(source).toLowerCase().trim(),
      customFields,
    };
  }

  /**
   * Ingest a lead directly into the tenant's Leads CRM table.
   * Performs deduplication by email or phone.
   */
  async ingestLead(tenantId: string, rawPayload: any, defaultSource = 'webhook'): Promise<IngestedLeadResult> {
    const data = this.normalizePayload(rawPayload, defaultSource);
    const tenant = String(tenantId);

    // 1. Deduplication: Check if lead with matching email exists
    let existingLead: any = null;
    if (data.email) {
      existingLead = await this.leadModel.findOne({ tenantId: tenant, email: data.email, deletedAt: null });
    }

    // 2. Deduplication: Check if lead with matching phone exists
    if (!existingLead && data.phone) {
      existingLead = await this.leadModel.findOne({ tenantId: tenant, phone: data.phone, deletedAt: null });
    }

    if (existingLead) {
      // Update existing lead with newly provided info
      const updates: any = {
        lastActivityAt: new Date(),
      };
      if (data.firstName && data.firstName !== 'New Lead') updates.firstName = data.firstName;
      if (data.lastName && !existingLead.lastName) updates.lastName = data.lastName;
      if (data.phone && !existingLead.phone) updates.phone = data.phone;
      if (data.email && !existingLead.email) updates.email = data.email;
      if (data.company && !existingLead.company) updates.company = data.company;
      updates.customFields = { ...(existingLead.customFields || {}), ...(data.customFields || {}) };

      await this.leadModel.updateOne({ _id: existingLead._id }, { $set: updates });

      await this.activityModel.create({
        tenantId: tenant,
        leadId: existingLead._id.toString(),
        type: 'note_added',
        description: `Lead updated from external source (${data.source})`,
      });

      const updatedLead: any = await this.leadModel.findById(existingLead._id).lean();
      if (updatedLead) {
        this.bus.emit(PlatformEvents.LEAD_UPDATED, { tenantId: tenant, lead: updatedLead, changes: {} });
      }

      this.logger.log(`Updated existing lead ${existingLead._id} from source: ${data.source}`);

      const first = updatedLead?.firstName || existingLead.firstName || 'Lead';
      const last = updatedLead?.lastName || existingLead.lastName || '';

      return {
        success: true,
        leadId: existingLead._id.toString(),
        isNew: false,
        name: `${first} ${last}`.trim(),
        email: updatedLead?.email || existingLead.email,
        phone: updatedLead?.phone || existingLead.phone,
        source: data.source,
        message: 'Existing lead updated successfully',
      };
    }

    // 3. Create fresh Lead
    const newLead = await this.leadModel.create({
      tenantId: tenant,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      company: data.company,
      source: data.source,
      customFields: data.customFields,
      status: 'new',
      temperature: 'cold',
      lastActivityAt: new Date(),
    });

    await this.activityModel.create({
      tenantId: tenant,
      leadId: newLead._id.toString(),
      type: 'created',
      description: `Lead received from ${data.source}`,
    });

    // Auto-assignment
    const assigneeId = await this.assignment.pickAssignee(tenant, newLead);
    if (assigneeId) {
      newLead.assignedTo = assigneeId;
      await this.leadModel.updateOne({ _id: newLead._id }, { $set: { assignedTo: assigneeId } });
    }

    // Emit event -> Triggers AI scoring, real-time alert, follow-up drip
    this.bus.emit(PlatformEvents.LEAD_CREATED, { tenantId: tenant, lead: newLead });

    this.logger.log(`Created new lead ${newLead._id} from source: ${data.source} for tenant: ${tenant}`);

    return {
      success: true,
      leadId: newLead._id.toString(),
      isNew: true,
      name: `${newLead.firstName} ${newLead.lastName || ''}`.trim(),
      email: newLead.email,
      phone: newLead.phone,
      source: data.source,
      message: 'New lead ingested successfully',
    };
  }

  /**
   * Process Meta Lead Ads webhook payload (Facebook/Instagram Ads).
   */
  async processMetaAdsPayload(tenantId: string, payload: any): Promise<any> {
    try {
      const entries = payload?.entry || [];
      const results: any[] = [];

      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          if (change.field === 'leadgen') {
            const val = change.value || {};
            const leadData: any = {
              source: 'meta_ads',
              leadgenId: val.leadgen_id,
              formId: val.form_id,
              pageId: val.page_id,
              adId: val.ad_id,
              createdTime: val.created_time,
            };

            if (val.leadData || val.formData) {
              Object.assign(leadData, val.leadData || val.formData);
            }

            const res = await this.ingestLead(tenantId, leadData, 'meta_ads');
            results.push(res);
          }
        }
      }

      // If flat payload was posted directly
      if (results.length === 0 && payload && typeof payload === 'object' && !payload.entry) {
        return await this.ingestLead(tenantId, payload, 'meta_ads');
      }

      return { success: true, processed: results.length, results };
    } catch (err: any) {
      this.logger.error(`Error processing Meta Ads webhook: ${err.message}`);
      throw err;
    }
  }

  /**
   * Process WhatsApp Cloud API incoming message webhook.
   */
  async processWhatsAppPayload(tenantId: string, payload: any): Promise<any> {
    try {
      const entries = payload?.entry || [];
      const results: any[] = [];

      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          const contacts = value.contacts || [];
          const messages = value.messages || [];

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const contact = contacts[i] || contacts[0] || {};
            const fromNumber = msg.from || contact.wa_id;
            const profileName = contact.profile?.name || '';
            const textBody = msg.text?.body || '';

            if (fromNumber) {
              const leadData = {
                name: profileName || `WhatsApp User (${fromNumber.slice(-4)})`,
                phone: `+${fromNumber}`,
                notes: textBody,
                source: 'whatsapp',
                customFields: {
                  whatsappId: fromNumber,
                  lastMessage: textBody,
                  messageTimestamp: msg.timestamp,
                },
              };

              const res = await this.ingestLead(tenantId, leadData, 'whatsapp');
              results.push(res);
            }
          }
        }
      }

      // If flat payload
      if (results.length === 0 && payload && typeof payload === 'object' && !payload.entry) {
        return await this.ingestLead(tenantId, payload, 'whatsapp');
      }

      return { success: true, processed: results.length, results };
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp webhook: ${err.message}`);
      throw err;
    }
  }
}
