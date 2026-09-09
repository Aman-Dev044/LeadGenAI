import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PageViewDocument = HydratedDocument<PageView>;

@Schema({ timestamps: true })
export class PageView {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ index: true })
  visitorId: string;

  @Prop({ index: true })
  leadId: string;

  @Prop({ required: true })
  url: string;

  @Prop({ type: String })
  title: string;

  @Prop({ type: String })
  referrer: string;

  @Prop({ type: Number, default: 0 })
  duration: number;

  @Prop({ type: String })
  ip: string;

  @Prop({ type: String })
  userAgent: string;

  @Prop({
    type: {
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
      utmTerm: String,
      utmContent: String,
    },
  })
  utm: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };
}

export const PageViewSchema = SchemaFactory.createForClass(PageView);

PageViewSchema.index({ tenantId: 1, createdAt: -1 });
PageViewSchema.index({ tenantId: 1, visitorId: 1 });
