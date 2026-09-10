import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto, LoginDto, ChangePasswordDto } from './dto';
import { IEmailProvider } from '../../common/interfaces';
import { EMAIL_PROVIDER } from '../../providers/email/email.module';
import { PlatformSettingsService } from '../platform/platform-settings.service';

export interface IssueTokenOptions {
  userAgent?: string;
  ip?: string;
  /** userId of the super admin acting as this user */
  impersonatedBy?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('RefreshToken') private readonly refreshTokenModel: Model<any>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async register(dto: RegisterDto) {
    if (!this.platformSettings.isSignupEnabled()) {
      throw new ForbiddenException('Self-service signup is currently disabled. Please contact support.');
    }
    if (this.platformSettings.isMaintenance()) {
      throw new ServiceUnavailableException(this.platformSettings.maintenanceMessage());
    }

    // Check if tenant slug already exists
    const slug = dto.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug || this.platformSettings.isSlugReserved(slug)) {
      throw new ConflictException('This organization name is reserved. Please choose another.');
    }

    const existingTenant = await this.tenantModel.findOne({ slug });
    if (existingTenant) {
      throw new ConflictException('Tenant name already taken');
    }

    // Create tenant with the platform defaults chosen by the owner
    const plan = this.platformSettings.defaultPlan();
    const trialDays = this.platformSettings.trialDays();
    const tenant = await this.tenantModel.create({
      name: dto.tenantName,
      slug,
      status: 'trial',
      plan,
      limits: this.platformSettings.limitsForPlan(plan),
      trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
    });

    // Hash password and create admin user
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      tenantId: tenant._id.toString(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'ADMIN',
      phone: dto.phone,
      emailVerifiedAt: new Date(),
    });

    // Generate tokens
    const tokens = await this.generateTokens(user, tenant._id.toString());

    return {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto, userAgent?: string, ip?: string) {
    // Find tenant by slug
    const tenant = await this.tenantModel.findOne({ slug: dto.tenantSlug.toLowerCase().trim(), deletedAt: null });
    if (!tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Platform owners always sign in through the owner workspace, which can never be
    // suspended, so a suspended/closed tenant blocks everyone.
    if (tenant.status === 'suspended') {
      throw new UnauthorizedException(
        tenant.suspendedReason
          ? `Tenant account is suspended: ${tenant.suspendedReason}`
          : 'Tenant account is suspended',
      );
    }
    if (tenant.status === 'cancelled' || tenant.deletedAt) {
      throw new UnauthorizedException('Tenant account is closed');
    }

    // Find user (emails are stored lower-cased)
    const user = await this.userModel
      .findOne({ tenantId: tenant._id.toString(), email: dto.email.toLowerCase().trim(), deletedAt: null })
      .select('+password');

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    if (this.platformSettings.isMaintenance() && !isSuperAdmin) {
      throw new ServiceUnavailableException(this.platformSettings.maintenanceMessage());
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user, tenant._id.toString(), { userAgent, ip });

    return {
      user: this.publicUser(user),
      tenant: this.publicTenant(tenant),
      ...tokens,
    };
  }

  /**
   * Issue a session for `user` inside `tenantId` without a password check.
   * Used by the owner console to impersonate a tenant user; the tokens carry
   * `impersonatedBy` so the dashboard can show a banner and audit logs stay honest.
   */
  async issueTokensForUser(user: any, tenantId: string, opts: IssueTokenOptions = {}) {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }
    const tokens = await this.generateTokens(user, tenantId, opts);
    return {
      user: this.publicUser(user),
      tenant: this.publicTenant(tenant),
      impersonatedBy: opts.impersonatedBy,
      ...tokens,
    };
  }

  private publicUser(user: any) {
    return {
      id: user._id,
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    };
  }

  private publicTenant(tenant: any) {
    return {
      id: tenant._id,
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.status,
      isPlatformOwner: !!tenant.isPlatformOwner,
    };
  }

  async refreshTokens(refreshToken: string) {
    const tokenDoc = await this.refreshTokenModel.findOne({
      token: refreshToken,
      isRevoked: false,
    });

    if (!tokenDoc) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenDoc.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token (rotation)
    tokenDoc.isRevoked = true;
    tokenDoc.revokedAt = new Date();
    await tokenDoc.save();

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (user.role !== 'SUPER_ADMIN' && this.platformSettings.isMaintenance()) {
      throw new ServiceUnavailableException(this.platformSettings.maintenanceMessage());
    }

    // Generate new tokens (keep the impersonation claim alive across refreshes)
    const tokens = await this.generateTokens(user, tokenDoc.tenantId, {
      userAgent: tokenDoc.userAgent,
      ip: tokenDoc.ip,
      impersonatedBy: tokenDoc.impersonatedBy,
    });

    // Link new token to old
    tokenDoc.replacedByToken = tokens.refreshToken;
    await tokenDoc.save();

    return tokens;
  }

  async logout(refreshToken: string) {
    await this.refreshTokenModel.updateOne(
      { token: refreshToken },
      { isRevoked: true, revokedAt: new Date() },
    );
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.refreshTokenModel.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );
    return { message: 'All sessions terminated' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await bcrypt.hash(dto.newPassword, 12);
    await user.save();

    // Revoke all refresh tokens for security
    await this.refreshTokenModel.updateMany(
      { userId: user._id.toString(), isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string, tenantSlug: string) {
    const tenant = await this.tenantModel.findOne({ slug: tenantSlug });
    if (!tenant) {
      // Don't reveal tenant existence
      return { message: 'If the account exists, a reset link has been sent' };
    }

    const user = await this.userModel.findOne({
      tenantId: tenant._id.toString(),
      email,
    });

    if (!user) {
      return { message: 'If the account exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send email with reset link
    const appUrl = this.configService.get<string>('app.url') || 'http://localhost:3000';
    const resetLink = `${appUrl}/auth/reset-password?token=${resetToken}&tenant=${tenantSlug}`;

    try {
      await this.emailProvider.sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset</h2>
            <p>Hi ${user.firstName || ''},</p>
            <p>You requested a password reset. Click the button below to set a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
            <hr style="border: 1px solid #eee;" />
            <p style="color: #999; font-size: 12px;">AI Lead Generation Platform</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`);
    }

    return { message: 'If the account exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Revoke all refresh tokens
    await this.refreshTokenModel.updateMany(
      { userId: user._id.toString(), isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );

    return { message: 'Password reset successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async generateTokens(user: any, tenantId: string, opts: IssueTokenOptions = {}) {
    const { userAgent, ip, impersonatedBy } = opts;
    const payload: Record<string, any> = {
      sub: user._id.toString(),
      tenantId,
      email: user.email,
      role: user.role,
    };
    if (impersonatedBy) payload.impersonatedBy = impersonatedBy;

    // Impersonation sessions are short-lived (1h) so a forgotten tab expires by itself
    const refreshExpiry = impersonatedBy ? '1h' : this.configService.get<string>('jwt.refreshExpiry') || '7d';
    const refreshTtlMs = impersonatedBy ? 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiry') || '15m',
      }),
      this.jwtService.signAsync(
        { sub: user._id.toString(), tenantId, ...(impersonatedBy ? { impersonatedBy } : {}) },
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
          expiresIn: refreshExpiry,
        },
      ),
    ]);

    // Store refresh token
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    await this.refreshTokenModel.create({
      tenantId,
      userId: user._id.toString(),
      token: refreshToken,
      expiresAt,
      userAgent,
      ip,
      impersonatedBy,
    });

    return { accessToken, refreshToken };
  }
}
