import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { decryptSecret, encryptSecret, maskSecret } from '../../common/utils/crypto.util';
import {
  CREDENTIAL_PROVIDERS,
  CredentialProviderSpec,
  getProviderSpec,
} from './credential-providers';

/** Resolved, decrypted settings for one service. Server-side use only. */
export type ResolvedCredentials = Record<string, string>;

/** How long a decrypted set is reused before the database is consulted again. */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  /**
   * Decrypting on every call would put AES on the hot path of every AI request
   * and every email. Entries are short-lived so a key change takes effect
   * quickly, and `invalidate` clears them the moment a tenant saves.
   */
  private readonly cache = new Map<string, { value: ResolvedCredentials; expiresAt: number }>();

  constructor(
    @InjectModel('TenantCredential') private readonly model: Model<any>,
    private readonly configService: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.configService.get<string>('encryption.key') || '';
  }

  // Reading - server side

  /**
   * Settings for one service, with each field falling back to the platform's
   * own environment variable when the tenant has not set it.
   *
   * This is the only path that ever produces plaintext, and it is never exposed
   * through a controller.
   */
  async resolve(tenantId: string, providerId: string): Promise<ResolvedCredentials> {
    const spec = getProviderSpec(providerId);
    if (!spec) return {};

    const cacheKey = `${tenantId || 'platform'}:${providerId}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const envDefaults = this.envDefaults(spec);
    let resolved: ResolvedCredentials = envDefaults;

    if (tenantId && tenantId !== 'all') {
      try {
        const doc = await this.model.findOne({ tenantId, provider: providerId }).lean();
        if (doc && (doc as any).enabled !== false) {
          resolved = { ...envDefaults, ...this.decryptValues(spec, (doc as any).values || {}) };
        }
      } catch (err: any) {
        // A vault problem must not take down the feature that depends on it.
        this.logger.warn(`Credential lookup failed for ${cacheKey}: ${err?.message}`);
      }
    }

    this.cache.set(cacheKey, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
    return resolved;
  }

  /** Platform-level values, for the schedulers and anything without a tenant. */
  envDefaults(spec: CredentialProviderSpec): ResolvedCredentials {
    const out: ResolvedCredentials = {};
    for (const field of spec.fields) {
      if (!field.envKey) continue;
      const value = process.env[field.envKey];
      if (value !== undefined && value !== '') out[field.key] = value;
    }
    return out;
  }

  private decryptValues(spec: CredentialProviderSpec, stored: Record<string, string>) {
    const out: ResolvedCredentials = {};
    for (const field of spec.fields) {
      const raw = stored[field.key];
      if (raw === undefined || raw === null || raw === '') continue;
      if (field.secret) {
        const plain = decryptSecret(raw, this.encryptionKey);
        // A value we cannot decrypt (rotated ENCRYPTION_KEY) is treated as
        // absent, so the platform default takes over instead of sending garbage.
        if (plain) out[field.key] = plain;
      } else {
        out[field.key] = raw;
      }
    }
    return out;
  }

  // Reading - what a browser is allowed to see

  /**
   * The whole catalogue with each provider's current state. Secret fields come
   * back only as a mask (`••••••••3f21`); their plaintext never leaves the
   * server, so it cannot be read from the network tab or the page source.
   */
  /**
   * Whether this workspace saved its OWN value for a field (as opposed to
   * falling back to the platform's environment variable). Lets callers tell a
   * tenant-configured integration from the shared default.
   */
  async hasOwnValue(tenantId: string, providerId: string, fieldKey: string): Promise<boolean> {
    if (!tenantId || tenantId === 'all') return false;
    const doc: any = await this.model.findOne({ tenantId, provider: providerId }).select('values').lean();
    const raw = doc?.values?.[fieldKey];
    return raw !== undefined && raw !== null && raw !== '';
  }

  async describeAll(tenantId: string) {
    const docs =
      tenantId && tenantId !== 'all'
        ? await this.model.find({ tenantId }).lean()
        : [];
    const byProvider = new Map(docs.map((d: any) => [d.provider, d]));

    return {
      providers: CREDENTIAL_PROVIDERS.map((spec) =>
        this.describeOne(spec, byProvider.get(spec.id)),
      ),
    };
  }

  private describeOne(spec: CredentialProviderSpec, doc?: any) {
    const stored = (doc?.values || {}) as Record<string, string>;
    const envDefaults = this.envDefaults(spec);

    const fields = spec.fields.map((field) => {
      const raw = stored[field.key];
      const hasTenantValue = raw !== undefined && raw !== null && raw !== '';
      const hasPlatformValue = envDefaults[field.key] !== undefined;

      if (field.secret) {
        // Never the value, never the length - only whether one exists and a
        // few trailing characters so a human can tell which key is stored.
        const plain = hasTenantValue ? decryptSecret(raw, this.encryptionKey) : null;
        return {
          ...field,
          configured: hasTenantValue || hasPlatformValue,
          usingPlatformDefault: !hasTenantValue && hasPlatformValue,
          preview: plain ? maskSecret(plain) : hasPlatformValue ? '•••••••• (platform)' : '',
          value: undefined,
        };
      }

      return {
        ...field,
        configured: hasTenantValue || hasPlatformValue,
        usingPlatformDefault: !hasTenantValue && hasPlatformValue,
        // Endpoints, regions and limits are not secrets - show them as typed.
        value: hasTenantValue ? raw : (envDefaults[field.key] ?? ''),
      };
    });

    const requiredSecrets = spec.fields.filter((f) => f.secret);
    const ready =
      requiredSecrets.length === 0 ||
      requiredSecrets.every((f) => fields.find((x) => x.key === f.key)?.configured);

    return {
      id: spec.id,
      label: spec.label,
      category: spec.category,
      description: spec.description,
      docsUrl: spec.docsUrl,
      note: spec.note,
      testable: !!spec.testable,
      enabled: doc?.enabled !== false,
      configured: ready,
      usingPlatformDefaults: fields.every((f) => f.usingPlatformDefault || !f.configured),
      updatedAt: doc?.updatedAt,
      updatedBy: doc?.updatedBy,
      lastTest: doc?.lastTest || null,
      fields,
    };
  }

  // Writing

  /**
   * Saves a tenant's settings for one service.
   *
   * A secret the user did not retype arrives as an empty string and is left
   * untouched - the form never receives the old value, so it cannot send it
   * back. Sending the literal `__clear__` removes a stored secret.
   */
  async upsert(
    tenantId: string,
    providerId: string,
    values: Record<string, any>,
    updatedBy?: string,
  ) {
    const spec = getProviderSpec(providerId);
    if (!spec) throw new NotFoundException(`Unknown integration "${providerId}"`);

    const existing = await this.model.findOne({ tenantId, provider: providerId });
    const next: Record<string, string> = { ...(existing?.values || {}) };

    for (const field of spec.fields) {
      if (!(field.key in values)) continue;
      const incoming = values[field.key];

      if (incoming === '__clear__') {
        delete next[field.key];
        continue;
      }

      if (field.secret) {
        const plain = typeof incoming === 'string' ? incoming.trim() : '';
        // Blank means "leave whatever is already stored alone".
        if (!plain) continue;
        next[field.key] = encryptSecret(plain, this.encryptionKey);
        continue;
      }

      if (incoming === null || incoming === undefined || incoming === '') {
        delete next[field.key];
        continue;
      }

      if (field.type === 'number') {
        const num = Number(incoming);
        if (Number.isNaN(num)) {
          throw new BadRequestException(`${field.label} must be a number`);
        }
        if (field.min !== undefined && num < field.min) {
          throw new BadRequestException(`${field.label} must be at least ${field.min}`);
        }
        if (field.max !== undefined && num > field.max) {
          throw new BadRequestException(`${field.label} must be at most ${field.max}`);
        }
        next[field.key] = String(num);
        continue;
      }

      next[field.key] = String(incoming).trim();
    }

    const doc = await this.model.findOneAndUpdate(
      { tenantId, provider: providerId },
      {
        $set: {
          values: next,
          updatedBy,
          ...(typeof values.enabled === 'boolean' ? { enabled: values.enabled } : {}),
        },
        $setOnInsert: { tenantId, provider: providerId },
      },
      { new: true, upsert: true },
    );

    this.invalidate(tenantId, providerId);
    return this.describeOne(spec, doc.toObject ? doc.toObject() : doc);
  }

  /** Wipes a tenant's settings for one service; it falls back to the platform's. */
  async clear(tenantId: string, providerId: string) {
    const spec = getProviderSpec(providerId);
    if (!spec) throw new NotFoundException(`Unknown integration "${providerId}"`);
    await this.model.deleteOne({ tenantId, provider: providerId });
    this.invalidate(tenantId, providerId);
    return this.describeOne(spec, undefined);
  }

  async recordTest(tenantId: string, providerId: string, ok: boolean, message: string) {
    await this.model.updateOne(
      { tenantId, provider: providerId },
      { $set: { lastTest: { ok, message, checkedAt: new Date() } } },
      { upsert: true },
    );
    this.invalidate(tenantId, providerId);
  }

  /** Drop cached plaintext so the next read picks up a change immediately. */
  invalidate(tenantId: string, providerId?: string) {
    if (providerId) {
      this.cache.delete(`${tenantId}:${providerId}`);
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) this.cache.delete(key);
    }
  }
}
