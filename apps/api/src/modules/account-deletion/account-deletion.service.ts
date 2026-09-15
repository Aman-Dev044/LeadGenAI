import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EMAIL_PROVIDER } from '../../providers/email/email.module';
import type { IEmailProvider } from '../../common/interfaces/email-provider.interface';
import { NotificationGateway } from '../../gateways/notification.gateway';
import {
  SubmitDeletionRequestDto,
  ExecuteOwnershipTransferDto,
  RejectDeletionRequestDto,
  QueryDeletionRequestsDto,
} from './dto/account-deletion.dto';

const OTP_TTL_MS = 2 * 60 * 1000; // 2 minutes

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel('AccountDeletionRequest') private readonly deletionRequestModel: Model<any>,
    @InjectModel('Tenant') private readonly tenantModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('RefreshToken') private readonly refreshTokenModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * Submit an account deletion request (Admin or Salesperson).
   */
  async submitDeletionRequest(user: any, dto: SubmitDeletionRequestDto) {
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin accounts cannot be submitted for deletion via this workflow.');
    }

    const userId = String(user._id || user.id || user.userId || user.sub);

    // Check if there is already an active pending request
    const existing = await this.deletionRequestModel.findOne({
      userId,
      status: 'pending',
    });

    if (existing) {
      throw new ConflictException('You already have a pending deletion request under review.');
    }

    const tenant = await this.tenantModel.findById(user.tenantId);
    if (!tenant) {
      throw new NotFoundException('Organization not found.');
    }

    // Count how many users would be affected if admin deletes workspace
    let affectedUsersCount = 1;
    if (user.role === 'ADMIN') {
      affectedUsersCount = await this.userModel.countDocuments({
        tenantId: String(user.tenantId),
        deletedAt: null,
      });
    }

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    const isOrgAdmin = user.role === 'ADMIN';
    const targetAudience = isOrgAdmin ? 'SUPER_ADMIN' : 'TENANT_ADMIN';

    const request = await this.deletionRequestModel.create({
      tenantId: String(user.tenantId),
      userId,
      userEmail: user.email.toLowerCase(),
      userName,
      userRole: user.role,
      tenantName: tenant.name,
      reason: dto.reason,
      description: dto.description.trim(),
      status: 'pending',
      targetAudience,
      cascadeTenantDeletion: isOrgAdmin,
      affectedUsersCount,
    });

    if (isOrgAdmin) {
      // 1. Notify Platform Super Admins in real-time
      try {
        const superAdmins = await this.userModel.find({
          role: 'SUPER_ADMIN',
          deletedAt: null,
          isActive: true,
        });

        const notificationTitle = `Organization Deletion Request: ${tenant.name}`;
        const notificationBody = `Admin ${userName} requested deletion for organization "${tenant.name}" (${affectedUsersCount} users affected). Reason: ${dto.reason}`;

        for (const sa of superAdmins) {
          await this.notificationModel.create({
            tenantId: String(sa.tenantId),
            userId: String(sa._id),
            title: notificationTitle,
            body: notificationBody,
            type: 'deletion_request',
            status: 'pending',
            channel: 'in_app',
            recipient: sa.email,
            data: {
              requestId: String(request._id),
              userRole: user.role,
              tenantName: tenant.name,
              reason: dto.reason,
              description: dto.description,
            },
          });
          this.notificationGateway.sendToUser(String(sa._id), 'notification', {
            title: notificationTitle,
            body: notificationBody,
            requestId: String(request._id),
          });
        }

        // Broadcast global superadmin event
        this.notificationGateway.server?.emit('superadmin:deletion-request', {
          requestId: String(request._id),
          userName,
          userRole: user.role,
          tenantName: tenant.name,
          reason: dto.reason,
          description: dto.description,
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch superadmin notifications: ${err.message}`);
      }
    } else {
      // 2. Notify Tenant Admin(s) in real-time
      try {
        const tenantAdmins = await this.userModel.find({
          tenantId: String(user.tenantId),
          role: 'ADMIN',
          deletedAt: null,
          isActive: true,
        });

        const notificationTitle = `Staff Deletion Request: ${userName}`;
        const notificationBody = `Staff member ${userName} (${user.role}) has requested account deletion. Reason: ${dto.reason}`;

        for (const admin of tenantAdmins) {
          await this.notificationModel.create({
            tenantId: String(user.tenantId),
            userId: String(admin._id),
            title: notificationTitle,
            body: notificationBody,
            type: 'deletion_request',
            status: 'pending',
            channel: 'in_app',
            recipient: admin.email,
            data: {
              requestId: String(request._id),
              userId: request.userId,
              userName,
              userEmail: user.email,
              userRole: user.role,
              reason: dto.reason,
              description: dto.description,
            },
          });
          this.notificationGateway.sendToUser(String(admin._id), 'notification', {
            title: notificationTitle,
            body: notificationBody,
            requestId: String(request._id),
          });
        }

        // Emit to tenant room so admin dashboard refreshes in real-time
        this.notificationGateway.sendToTenant(String(user.tenantId), 'admin:staff-deletion-request', {
          requestId: String(request._id),
          userId: request.userId,
          userName,
          userEmail: user.email,
          userRole: user.role,
          reason: dto.reason,
          description: dto.description,
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch tenant admin notifications: ${err.message}`);
      }
    }

    return request;
  }

  /**
   * Get active pending deletion request for the current user.
   */
  async getMyRequest(user: any) {
    const userId = String(user._id || user.id || user.userId || user.sub);
    return this.deletionRequestModel.findOne({
      userId,
      status: 'pending',
    }).sort({ createdAt: -1 });
  }

  /**
   * Cancel an active pending deletion request.
   */
  async cancelMyRequest(user: any) {
    const userId = String(user._id || user.id || user.userId || user.sub);
    const request = await this.deletionRequestModel.findOneAndUpdate(
      { userId, status: 'pending' },
      { $set: { status: 'cancelled' } },
      { new: true },
    );
    if (!request) {
      throw new NotFoundException('No pending deletion request found to cancel.');
    }
    return { success: true, message: 'Deletion request has been cancelled.' };
  }

  /**
   * Request OTP for Ownership Transfer (Current Admin only).
   * Generates a 6-character code valid for 2 minutes and emails it to current admin.
   */
  async requestOwnershipTransferOtp(user: any) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only organization administrators can transfer ownership.');
    }

    const currentAdmin = await this.userModel.findById(user._id || user.id || user.userId || user.sub);
    if (!currentAdmin) {
      throw new NotFoundException('Admin user not found.');
    }

    // Generate 6-char alphanumeric OTP (clear characters, omitting confusing 0, O, 1, I)
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let otp = '';
    for (let i = 0; i < 6; i++) {
      otp += chars.charAt(crypto.randomInt(0, chars.length));
    }

    const otpHash = crypto.createHash('sha256').update(otp.toUpperCase()).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.userModel.updateOne(
      { _id: currentAdmin._id },
      {
        $set: {
          ownershipTransferOtpHash: otpHash,
          ownershipTransferOtpExpires: expiresAt,
        },
      },
    );

    const tenant = await this.tenantModel.findById(currentAdmin.tenantId);
    const orgName = tenant?.name || 'your organization';

    // Send high-priority verification email
    const subject = `[Action Required] Verification Code for Ownership Transfer - ${orgName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Ownership Transfer Verification</h1>
          <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">Organization: ${orgName}</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${currentAdmin.firstName || 'Administrator'}</strong>,</p>
          <p style="font-size: 14px; color: #475569;">
            We received a request to transfer the ownership and administrator privileges of <strong>${orgName}</strong> to another person.
          </p>
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin: 0 0 8px; font-weight: 600;">Your 6-Character Verification Code</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; font-family: 'Courier New', monospace;">${otp}</div>
            <p style="font-size: 12px; color: #ef4444; margin: 8px 0 0; font-weight: 600;">⏳ Valid for 2 minutes only</p>
          </div>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 13px; color: #991b1b; font-weight: 500;">
              <strong>Security Warning:</strong> Once ownership is transferred, your administrator access will be permanently revoked. All sales team members and company data will remain safely active under the new owner.
            </p>
          </div>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
            If you did not initiate this transfer, please change your password immediately and contact support.
          </p>
        </div>
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
          LeadGen AI Secure Identity Service &bull; Automated Security Message
        </div>
      </div>
    `;

    await this.emailProvider.sendEmail({
      to: currentAdmin.email,
      subject,
      html,
      text: `Your LeadGen AI Ownership Transfer OTP is: ${otp}. Valid for 2 minutes.`,
    });

    return {
      success: true,
      message: `A 6-character verification code has been sent to ${currentAdmin.email}. It expires in 2 minutes.`,
      expiresInSeconds: 120,
    };
  }

  /**
   * Execute Ownership Transfer with OTP verification.
   * Transfers ownership to new owner, deactivates old admin, leaves other salespersons unaffected.
   */
  async executeOwnershipTransfer(user: any, dto: ExecuteOwnershipTransferDto) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only organization administrators can transfer ownership.');
    }

    const currentAdmin = await this.userModel
      .findById(user._id || user.id || user.userId || user.sub)
      .select('+ownershipTransferOtpHash');

    if (!currentAdmin) {
      throw new NotFoundException('Current administrator not found.');
    }

    // Verify OTP expiry
    if (
      !currentAdmin.ownershipTransferOtpExpires ||
      new Date() > new Date(currentAdmin.ownershipTransferOtpExpires)
    ) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    // Verify OTP code hash
    const providedOtpHash = crypto
      .createHash('sha256')
      .update(dto.otp.trim().toUpperCase())
      .digest('hex');

    if (providedOtpHash !== currentAdmin.ownershipTransferOtpHash) {
      throw new BadRequestException('Invalid verification code. Please check your email.');
    }

    const targetEmail = dto.email.trim().toLowerCase();
    if (targetEmail === currentAdmin.email.toLowerCase()) {
      throw new BadRequestException('Target email cannot be identical to your current email.');
    }

    const tenant = await this.tenantModel.findById(currentAdmin.tenantId);
    if (!tenant) {
      throw new NotFoundException('Organization not found.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Check if user already exists inside this tenant
    const existingTenantUser = await this.userModel.findOne({
      tenantId: String(currentAdmin.tenantId),
      email: targetEmail,
    });

    let newOwnerUser: any;

    if (existingTenantUser) {
      // Promote existing team member to ADMIN
      existingTenantUser.role = 'ADMIN';
      existingTenantUser.firstName = dto.firstName.trim();
      existingTenantUser.lastName = dto.lastName.trim();
      if (dto.phone) existingTenantUser.phone = dto.phone.trim();
      existingTenantUser.password = hashedPassword;
      existingTenantUser.isActive = true;
      existingTenantUser.deletedAt = null;
      existingTenantUser.emailVerifiedAt = new Date();
      await existingTenantUser.save();
      newOwnerUser = existingTenantUser;
    } else {
      // Create new admin user in this workspace
      newOwnerUser = await this.userModel.create({
        tenantId: String(currentAdmin.tenantId),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: targetEmail,
        phone: dto.phone?.trim() || '',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        emailVerifiedAt: new Date(),
      });
    }

    // Deactivate old admin and clear OTP
    await this.userModel.updateOne(
      { _id: currentAdmin._id },
      {
        $set: {
          isActive: false,
          deletedAt: new Date(),
        },
        $unset: {
          ownershipTransferOtpHash: 1,
          ownershipTransferOtpExpires: 1,
        },
      },
    );

    // Terminate old admin sessions
    await this.refreshTokenModel.deleteMany({ userId: String(currentAdmin._id) });

    // Send confirmation emails
    const orgName = tenant.name;

    // 1. Email to former admin
    try {
      await this.emailProvider.sendEmail({
        to: currentAdmin.email,
        subject: `Ownership of ${orgName} Successfully Transferred`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #10b981; padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Ownership Transferred Successfully</h1>
            </div>
            <div style="padding: 28px 24px; color: #1e293b; line-height: 1.6;">
              <p>Hello <strong>${currentAdmin.firstName || 'User'}</strong>,</p>
              <p>The ownership of <strong>${orgName}</strong> has been successfully transferred to <strong>${targetEmail}</strong>.</p>
              <p>Your previous administrator account has been safely deactivated. All sales personnel, leads, and organizational configurations continue running seamlessly under the new administrator.</p>
              <p style="color: #64748b; font-size: 13px; margin-top: 24px;">Thank you for using LeadGen AI.</p>
            </div>
          </div>
        `,
        text: `Ownership of ${orgName} has been transferred to ${targetEmail}. Your account has been safely deactivated.`,
      });
    } catch (e) {
      this.logger.warn(`Failed to send transfer email to old admin: ${e.message}`);
    }

    // 2. Email to new owner
    try {
      await this.emailProvider.sendEmail({
        to: targetEmail,
        subject: `Welcome to ${orgName} - You are now Organization Owner`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px;">You're Now the Owner of ${orgName}</h1>
            </div>
            <div style="padding: 32px 24px; color: #1e293b; line-height: 1.6;">
              <p>Hello <strong>${dto.firstName}</strong>,</p>
              <p>Administrator privileges and workspace ownership for <strong>${orgName}</strong> have been transferred to you by ${currentAdmin.email}.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 6px; font-size: 14px;"><strong>Your Login Email:</strong> ${targetEmail}</p>
                <p style="margin: 0; font-size: 14px;"><strong>Role:</strong> Workspace Administrator</p>
              </div>
              <p>You can now log in to the dashboard, manage your sales team, track leads, and customize settings.</p>
            </div>
          </div>
        `,
        text: `You are now the administrator of ${orgName}. Log in using ${targetEmail}.`,
      });
    } catch (e) {
      this.logger.warn(`Failed to send welcome email to new owner: ${e.message}`);
    }

    return {
      success: true,
      message: `Ownership has been transferred to ${targetEmail}. Your account has been deactivated.`,
      newOwnerEmail: targetEmail,
    };
  }

  // =========================================================================
  // SuperAdmin Console Handlers
  // =========================================================================

  /**
   * List deletion requests with filters (SuperAdmin only).
   */
  async listRequests(query: QueryDeletionRequestsDto) {
    const filter: Record<string, any> = {};
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.role && query.role !== 'all') {
      filter.userRole = query.role;
    }
    if (query.tenantId && query.tenantId !== 'all') {
      filter.tenantId = query.tenantId;
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [requests, total, pendingCount] = await Promise.all([
      this.deletionRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.deletionRequestModel.countDocuments(filter),
      this.deletionRequestModel.countDocuments({ status: 'pending' }),
    ]);

    return {
      requests,
      total,
      pendingCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Approve a deletion request (SuperAdmin only).
   * Sends a styled deletion confirmation email to the user.
   * If role was ADMIN: deletes/cancels tenant and cascades to all registered salespersons.
   * If role was SALESPERSON: deletes only that specific salesperson.
   */
  async approveRequest(requestId: string, superAdminUser: any) {
    const request = await this.deletionRequestModel.findById(requestId);
    if (!request) {
      throw new NotFoundException('Deletion request not found.');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException(`Request is already ${request.status}.`);
    }

    const tenant = await this.tenantModel.findById(request.tenantId);

    // 1. Execute deletion according to role
    if (request.userRole === 'ADMIN' && tenant && !tenant.isPlatformOwner) {
      // Soft-delete organization workspace
      await this.tenantModel.updateOne(
        { _id: tenant._id },
        { $set: { deletedAt: new Date(), status: 'cancelled' } },
      );

      // Deactivate all users associated with this tenant (salespersons, managers, admin)
      await this.userModel.updateMany(
        { tenantId: String(tenant._id) },
        { $set: { isActive: false, deletedAt: new Date() } },
      );

      // Invalidate all active sessions for this organization
      await this.refreshTokenModel.deleteMany({ tenantId: String(tenant._id) });

      // Inactivate any tenant agents
      try {
        if (this.connection.models['Agent']) {
          await this.connection.models['Agent'].updateMany(
            { tenantId: String(tenant._id) },
            { $set: { status: 'inactive' } },
          );
        }
      } catch (err) {
        this.logger.warn(`Could not deactivate agents for tenant ${tenant._id}: ${err.message}`);
      }
    } else {
      // Deleting a single salesperson / staff member
      await this.userModel.updateOne(
        { _id: request.userId },
        { $set: { isActive: false, deletedAt: new Date() } },
      );
      await this.refreshTokenModel.deleteMany({ userId: request.userId });
    }

    // 2. Mark request as approved
    request.status = 'approved';
    request.reviewedBy = String(superAdminUser._id || superAdminUser.id);
    request.reviewedAt = new Date();
    await request.save();

    // Real-time socket dispatches
    if (request.userRole === 'ADMIN' && tenant) {
      // Notify all users in the tenant that the workspace has been deleted
      this.notificationGateway.sendToTenant(String(tenant._id), 'tenant:deleted', {
        message: `Organization ${tenant.name} has been permanently deleted by platform administration.`,
      });
      // Global event for superadmin dashboards
      this.notificationGateway.server?.emit('superadmin:deletion-processed', {
        requestId: String(request._id),
        tenantId: String(tenant._id),
        status: 'approved',
      });
    } else {
      // Single user deleted
      this.notificationGateway.sendToUser(request.userId, 'user:account-deleted', {
        message: 'Your account has been deleted by platform administration.',
      });
      this.notificationGateway.sendToTenant(String(request.tenantId), 'staff:deletion-processed', {
        requestId: String(request._id),
        userId: request.userId,
        status: 'approved',
      });
      this.notificationGateway.server?.emit('superadmin:deletion-processed', {
        requestId: String(request._id),
        tenantId: String(request.tenantId),
        status: 'approved',
      });
    }

    // 3. Send professional confirmation email to requester
    try {
      const isOrgDeletion = request.userRole === 'ADMIN';
      const subject = isOrgDeletion
        ? `Account & Organization Deleted Successfully - ${request.tenantName}`
        : `Account Deleted Successfully - LeadGen AI`;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 24px; text-align: center;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background-color: #ef4444; border-radius: 50%; margin-bottom: 16px;">
              <span style="font-size: 28px; color: #ffffff;">✓</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Account Deleted Successfully</h1>
            <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">LeadGen AI Platform Service</p>
          </div>
          <div style="padding: 32px 24px; color: #1e293b; line-height: 1.6;">
            <p style="font-size: 15px; margin-top: 0;">Hello <strong>${request.userName}</strong>,</p>
            <p style="font-size: 14px; color: #475569;">
              ${
                isOrgDeletion
                  ? `Your request to delete your account and the organization <strong>${request.tenantName}</strong> has been processed and approved by platform administration.`
                  : `Your request to delete your salesperson account from <strong>${request.tenantName}</strong> has been processed and approved by platform administration.`
              }
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 24px 0;">
              <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Deletion Summary</h3>
              <table style="width: 100%; font-size: 14px; color: #334155; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">User Account:</td>
                  <td style="padding: 4px 0; font-weight: 600; text-align: right;">${request.userEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Role:</td>
                  <td style="padding: 4px 0; font-weight: 600; text-align: right;">${request.userRole}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Organization:</td>
                  <td style="padding: 4px 0; font-weight: 600; text-align: right;">${request.tenantName}</td>
                </tr>
                ${
                  isOrgDeletion
                    ? `<tr>
                        <td style="padding: 4px 0; color: #64748b;">Associated Staff Removed:</td>
                        <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #ef4444;">${request.affectedUsersCount} accounts</td>
                      </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Processed Date:</td>
                  <td style="padding: 4px 0; font-weight: 600; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 14px; color: #475569;">
              All sessions have been revoked. We appreciate the time you spent using LeadGen AI and thank you for your feedback.
            </p>
            <p style="font-size: 14px; color: #475569; margin-bottom: 0;">
              If you ever decide to return or require assistance in the future, our doors are always open.
            </p>
          </div>
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            LeadGen AI &bull; Smart AI-Powered Lead Conversion Platform
          </div>
        </div>
      `;

      await this.emailProvider.sendEmail({
        to: request.userEmail,
        subject,
        html,
        text: `Your LeadGen AI account and related data have been successfully deleted.`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send deletion confirmation email to ${request.userEmail}: ${err.message}`);
    }

    return {
      success: true,
      message: 'Account deletion approved and processed successfully.',
      request,
    };
  }

  /**
   * Reject a deletion request (SuperAdmin only).
   */
  async rejectRequest(requestId: string, superAdminUser: any, dto: RejectDeletionRequestDto) {
    const request = await this.deletionRequestModel.findById(requestId);
    if (!request) {
      throw new NotFoundException('Deletion request not found.');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException(`Request is already ${request.status}.`);
    }

    request.status = 'rejected';
    request.rejectionReason = dto.reason || 'Request declined by platform administration.';
    request.reviewedBy = String(superAdminUser._id || superAdminUser.id);
    request.reviewedAt = new Date();
    await request.save();

    // Real-time notification to user & tenant
    this.notificationGateway.sendToUser(request.userId, 'deletion-request:rejected', {
      requestId: String(request._id),
      reason: request.rejectionReason,
    });
    this.notificationGateway.sendToTenant(String(request.tenantId), 'deletion-request:rejected', {
      requestId: String(request._id),
      reason: request.rejectionReason,
    });
    this.notificationGateway.server?.emit('superadmin:deletion-processed', {
      requestId: String(request._id),
      status: 'rejected',
    });

    // Send notification email to requester explaining why request was rejected
    try {
      await this.emailProvider.sendEmail({
        to: request.userEmail,
        subject: `Update on your Account Deletion Request - LeadGen AI`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #3b82f6; padding: 24px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Deletion Request Update</h2>
            </div>
            <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
              <p>Hello <strong>${request.userName}</strong>,</p>
              <p>Your account deletion request for organization <strong>${request.tenantName}</strong> has been reviewed and was <strong>not approved</strong> at this time.</p>
              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0;">
                <p style="margin: 0; font-size: 14px; color: #1e293b;"><strong>Reason provided:</strong> ${request.rejectionReason}</p>
              </div>
              <p style="font-size: 14px; color: #64748b;">Your account remains active. Please contact support if you need further clarification.</p>
            </div>
          </div>
        `,
        text: `Your account deletion request was not approved: ${request.rejectionReason}`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send rejection email to ${request.userEmail}: ${err.message}`);
    }

    return {
      success: true,
      message: 'Deletion request rejected.',
      request,
    };
  }

  // =========================================================================
  // Tenant Admin Handlers (Staff Deletion Requests)
  // =========================================================================

  /**
   * List deletion requests submitted by staff members in the tenant.
   */
  async listStaffRequests(tenantId: string, query: QueryDeletionRequestsDto) {
    const filter: Record<string, any> = {
      tenantId: String(tenantId),
      targetAudience: 'TENANT_ADMIN',
    };

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.role && query.role !== 'all') {
      filter.userRole = query.role;
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [requests, total, pendingCount] = await Promise.all([
      this.deletionRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.deletionRequestModel.countDocuments(filter),
      this.deletionRequestModel.countDocuments({ tenantId: String(tenantId), targetAudience: 'TENANT_ADMIN', status: 'pending' }),
    ]);

    return {
      requests,
      total,
      pendingCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Approve a staff member's deletion request (Tenant Admin only).
   * Soft-deletes the user, revokes sessions, sends real-time socket events and confirmation email.
   */
  async approveStaffRequest(requestId: string, adminUser: any) {
    const request = await this.deletionRequestModel.findOne({
      _id: requestId,
      tenantId: String(adminUser.tenantId),
      targetAudience: 'TENANT_ADMIN',
    });

    if (!request) {
      throw new NotFoundException('Staff deletion request not found.');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException(`Request is already ${request.status}.`);
    }

    // 1. Soft-delete staff member in the tenant
    await this.userModel.updateOne(
      { _id: request.userId, tenantId: String(adminUser.tenantId) },
      { $set: { isActive: false, deletedAt: new Date() } },
    );

    // 2. Revoke all active sessions for this user
    await this.refreshTokenModel.deleteMany({ userId: request.userId });

    // 3. Mark request as approved
    request.status = 'approved';
    request.reviewedBy = String(adminUser._id || adminUser.id);
    request.reviewedAt = new Date();
    await request.save();

    // 4. Real-time socket dispatches
    // Instantly terminate user session on their active client
    this.notificationGateway.sendToUser(request.userId, 'user:account-deleted', {
      message: 'Your account has been deleted by your organization administrator.',
    });
    // Inform all admin clients in tenant to refresh their UI
    this.notificationGateway.sendToTenant(String(adminUser.tenantId), 'staff:deletion-processed', {
      requestId: String(request._id),
      userId: request.userId,
      status: 'approved',
    });

    // 5. Send confirmation email to staff member
    try {
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 24px; text-align: center;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background-color: #ef4444; border-radius: 50%; margin-bottom: 16px;">
              <span style="font-size: 28px; color: #ffffff;">✓</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Account Deleted Successfully</h1>
            <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">Organization: ${request.tenantName}</p>
          </div>
          <div style="padding: 32px 24px; color: #1e293b; line-height: 1.6;">
            <p style="font-size: 15px; margin-top: 0;">Hello <strong>${request.userName}</strong>,</p>
            <p style="font-size: 14px; color: #475569;">
              Your request to delete your account from <strong>${request.tenantName}</strong> has been approved by your organization administrator.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 24px 0;">
              <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Deletion Details</h3>
              <table style="width: 100%; font-size: 14px; color: #334155; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Account:</td>
                  <td style="padding: 4px 0; font-weight: 600; text-align: right;">${request.userEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Role:</td>
                  <td style="padding: 4px 0; font-weight: 600; text-align: right;">${request.userRole}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Organization:</td>
                  <td style="padding: 4px 0; font-weight: 600; text-align: right;">${request.tenantName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Date:</td>
                  <td style="padding: 4px 0; font-weight: 600; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 14px; color: #475569; margin-bottom: 0;">
              All active sessions have been revoked. Thank you for your contributions to ${request.tenantName}.
            </p>
          </div>
        </div>
      `;

      await this.emailProvider.sendEmail({
        to: request.userEmail,
        subject: `Account Deletion Approved - ${request.tenantName}`,
        html,
        text: `Your account in ${request.tenantName} has been successfully deleted by your organization administrator.`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send staff deletion confirmation email to ${request.userEmail}: ${err.message}`);
    }

    return {
      success: true,
      message: 'Staff account deletion approved and processed successfully.',
      request,
    };
  }

  /**
   * Reject a staff member's deletion request (Tenant Admin only).
   */
  async rejectStaffRequest(requestId: string, adminUser: any, dto: RejectDeletionRequestDto) {
    const request = await this.deletionRequestModel.findOne({
      _id: requestId,
      tenantId: String(adminUser.tenantId),
      targetAudience: 'TENANT_ADMIN',
    });

    if (!request) {
      throw new NotFoundException('Staff deletion request not found.');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException(`Request is already ${request.status}.`);
    }

    request.status = 'rejected';
    request.rejectionReason = dto.reason || 'Request declined by organization administrator.';
    request.reviewedBy = String(adminUser._id || adminUser.id);
    request.reviewedAt = new Date();
    await request.save();

    // Real-time socket dispatches
    this.notificationGateway.sendToUser(request.userId, 'deletion-request:rejected', {
      requestId: String(request._id),
      reason: request.rejectionReason,
    });
    this.notificationGateway.sendToTenant(String(adminUser.tenantId), 'staff:deletion-processed', {
      requestId: String(request._id),
      userId: request.userId,
      status: 'rejected',
    });

    // Send email to staff member
    try {
      await this.emailProvider.sendEmail({
        to: request.userEmail,
        subject: `Update on your Account Deletion Request - ${request.tenantName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #3b82f6; padding: 24px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Deletion Request Update</h2>
            </div>
            <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
              <p>Hello <strong>${request.userName}</strong>,</p>
              <p>Your account deletion request in <strong>${request.tenantName}</strong> was <strong>not approved</strong> by your organization administrator.</p>
              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0;">
                <p style="margin: 0; font-size: 14px; color: #1e293b;"><strong>Note from Admin:</strong> ${request.rejectionReason}</p>
              </div>
              <p style="font-size: 14px; color: #64748b;">Your account remains active. Please reach out to your administrator for questions.</p>
            </div>
          </div>
        `,
        text: `Your account deletion request was not approved: ${request.rejectionReason}`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send staff rejection email to ${request.userEmail}: ${err.message}`);
    }

    return {
      success: true,
      message: 'Staff deletion request rejected.',
      request,
    };
  }
}
