import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class RecordConsentDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;

  @IsNotEmpty()
  @IsString()
  visitorId: string;

  @IsNotEmpty()
  @IsString()
  consentType: string;

  @IsBoolean()
  granted: boolean;
}
