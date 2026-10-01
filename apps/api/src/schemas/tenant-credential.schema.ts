import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TenantCredentialDocument = HydratedDocument<TenantCredential>;

/**
 * One workspace's settings for one external service (Reddit, SerpApi, SMTP, S3,
 * Twilio, OpenAI...).
 *
 * Secret fields are stored encrypted (`crypto.util`) and are **never** returned
 * to a client - the API only ever answers with a mask. A tenant that has not
 * filled a service in falls back to the platform's own environment variables,
 * so nothing breaks on upgrade.
 */
@Schema({ timestamps: true })
export class TenantCredential {
  @Prop({ required: true, index: true })
  tenantId: string;

  /** Matches a `CREDENTIAL_PROVIDERS` id, e.g. "reddit", "serpapi", "smtp". */
  @Prop({ required: true, index: true })
  provider: string;

  /**
   * Field name -> value. Secret fields hold ciphertext; plain fields (base
   * URLs, region, engine, numeric limits) hold their literal value.
   */
  @Prop({ type: Object, default: {} })
  values: Record<string, string>;

  /** Turned off without wiping the keys, so a tenant can fall back to platform defaults. */
  @Prop({ default: true })
  enabled: boolean;

  @Prop()
  updatedBy: string;

  /** Result of the last "Test connection", so the UI can show a health dot. */
  @Prop({
    type: {
      ok: Boolean,
      message: String,
      checkedAt: Date,
    },
    default: {},
  })
  lastTest: { ok?: boolean; message?: string; checkedAt?: Date };
}

export const TenantCredentialSchema = SchemaFactory.createForClass(TenantCredential);

// One document per service per workspace.
TenantCredentialSchema.index({ tenantId: 1, provider: 1 }, { unique: true });
