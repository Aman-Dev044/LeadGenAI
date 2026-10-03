import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CalendarConnectionDocument = HydratedDocument<CalendarConnection>;

/**
 * One user's connected external calendar (Google for now). The refresh token
 * is encrypted at rest with the platform ENCRYPTION_KEY; the short-lived access
 * token is cached in plain text because it expires within the hour anyway.
 */
@Schema({ timestamps: true })
export class CalendarConnection {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: String, enum: ['google'], default: 'google' })
  provider: string;

  /** Google account e-mail the calendar belongs to. */
  @Prop({ type: String })
  email: string;

  /** Which calendar events are written to (`primary` unless the user picks another). */
  @Prop({ type: String, default: 'primary' })
  calendarId: string;

  @Prop({ type: String })
  refreshTokenEnc: string;

  @Prop({ type: String })
  accessToken: string;

  @Prop()
  accessTokenExpiresAt: Date;

  @Prop({ type: String })
  scope: string;

  /** Last sync problem, cleared on the next successful call. */
  @Prop({ type: String })
  lastError: string;

  @Prop()
  lastSyncedAt: Date;
}

export const CalendarConnectionSchema = SchemaFactory.createForClass(CalendarConnection);

CalendarConnectionSchema.index({ tenantId: 1, userId: 1, provider: 1 }, { unique: true });
