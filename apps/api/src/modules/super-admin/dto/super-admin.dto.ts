import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export const TENANT_STATUSES = ['active', 'suspended', 'trial', 'cancelled'] as const;
export const TENANT_PLANS = ['free', 'starter', 'professional', 'enterprise'] as const;
export const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SALESPERSON'] as const;

// ---------------------------------------------------------------- tenants

export class ListTenantsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(TENANT_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(TENANT_PLANS)
  plan?: string;

  /** include soft-deleted tenants */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;
}

export class TenantAdminUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  firstName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class CreateTenantAdminDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug may contain lowercase letters, numbers and dashes only' })
  @MaxLength(60)
  slug?: string;

  @IsOptional()
  @IsIn(TENANT_PLANS)
  plan?: string;

  @IsOptional()
  @IsIn(TENANT_STATUSES)
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  trialDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalNotes?: string;

  @ValidateNested()
  @Type(() => TenantAdminUserDto)
  admin: TenantAdminUserDto;
}

export class UpdateTenantAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug may contain lowercase letters, numbers and dashes only' })
  @MaxLength(60)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  domain?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedOrigins?: string[];

  @IsOptional()
  @IsIn(TENANT_PLANS)
  plan?: string;

  /** When the plan changes, replace limits with the plan defaults (default true). */
  @IsOptional()
  @IsBoolean()
  applyPlanLimits?: boolean;

  @IsOptional()
  @IsIn(TENANT_STATUSES)
  status?: string;

  @IsOptional()
  @IsObject()
  limits?: Partial<{
    maxAgents: number;
    maxLeads: number;
    maxConversationsPerMonth: number;
    maxKnowledgeSources: number;
    maxUsers: number;
  }>;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalNotes?: string;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;
}

export class SuspendTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DeleteTenantDto {
  /** Must equal the tenant slug - protects against accidental deletion */
  @IsNotEmpty()
  @IsString()
  confirmSlug: string;

  /** Hard-delete every document of the tenant instead of soft-deleting. */
  @IsOptional()
  @IsBoolean()
  purge?: boolean;
}

export class ImpersonateDto {
  @IsOptional()
  @IsString()
  userId?: string;
}

// ---------------------------------------------------------------- users

export class ListUsersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsIn(ALL_ROLES)
  role?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;
}

export class UpdateUserAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsIn(ALL_ROLES)
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class AdminResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class CreateSuperAdminDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  firstName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

// ---------------------------------------------------------------- audit / usage / search

export class ListAuditQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(['success', 'failure'])
  status?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class UsageQueryDto {
  /** YYYY-MM, defaults to the current month */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period?: string;
}

export class SearchQueryDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;
}

// ---------------------------------------------------------------- settings / broadcast

export class AnnouncementDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  platformName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supportEmail?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  maintenanceMessage?: string;

  @IsOptional()
  @IsBoolean()
  signupEnabled?: boolean;

  @IsOptional()
  @IsIn(TENANT_PLANS)
  defaultPlan?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  trialDays?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnnouncementDto)
  announcement?: AnnouncementDto;

  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  planLimits?: Record<string, Record<string, number>>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  reservedSlugs?: string[];
}

export class BroadcastDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  title: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string;

  /** Only users with these roles (default: everyone) */
  @IsOptional()
  @IsArray()
  @IsIn(ALL_ROLES, { each: true })
  roles?: string[];

  /** Only these tenants (default: all active tenants) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];

  /** Only tenants on these plans */
  @IsOptional()
  @IsArray()
  @IsIn(TENANT_PLANS, { each: true })
  plans?: string[];

  /** Also send the message by email */
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
