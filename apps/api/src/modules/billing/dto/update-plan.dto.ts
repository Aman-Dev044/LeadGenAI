import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdatePlanDto {
  @IsNotEmpty()
  @IsEnum(['free', 'starter', 'professional', 'enterprise'])
  plan: string;
}
