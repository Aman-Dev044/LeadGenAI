import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyEmailChangeOtpDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 characters' })
  @Matches(/^[A-Za-z0-9]{6}$/, { message: 'OTP must contain only letters and numbers' })
  code: string;
}

export class RequestNewEmailOtpDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid new email address' })
  newEmail: string;
}
