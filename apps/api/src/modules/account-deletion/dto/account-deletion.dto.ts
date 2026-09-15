import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class SubmitDeletionRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Please select a reason for deletion' })
  reason: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Description should not exceed 1000 characters (approx 100 words)' })
  description?: string;
}

export class RequestOwnershipTransferOtpDto {
  // Empty body or confirmation flag
}

export class ExecuteOwnershipTransferDto {
  @IsString()
  @IsNotEmpty({ message: 'Verification OTP is required' })
  @Matches(/^[a-zA-Z0-9]{6}$/, { message: 'OTP must be a 6-character code' })
  otp: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @IsEmail({}, { message: 'Please provide a valid email address for the new owner' })
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}

export class RejectDeletionRequestDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class QueryDeletionRequestsDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
