import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsNotEmpty()
  @IsEnum(['free', 'starter', 'professional', 'enterprise'])
  plan: string;

  @IsOptional()
  @IsEnum(['razorpay', 'stripe'])
  paymentProvider?: string;

  @IsOptional()
  @IsString()
  paymentToken?: string;
}
