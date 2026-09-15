import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdatePlanDto {
  @IsNotEmpty()
  @IsEnum(['free', 'starter', 'professional', 'enterprise'])
  plan: string;

  @IsOptional()
  @IsEnum(['monthly', 'yearly'])
  interval?: 'monthly' | 'yearly';
}

