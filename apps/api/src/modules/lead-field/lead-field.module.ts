import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadFieldController } from './lead-field.controller';
import { LeadFieldService } from './lead-field.service';
import { LeadFieldSchema } from '../../schemas/lead-field.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'LeadField', schema: LeadFieldSchema }]),
  ],
  controllers: [LeadFieldController],
  providers: [LeadFieldService],
  exports: [LeadFieldService],
})
export class LeadFieldModule {}
