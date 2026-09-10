import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { EMAIL_PROVIDER } from '../../providers/email/email.module';
import { PlatformSettingsService } from '../platform/platform-settings.service';

describe('AuthService', () => {
  let service: AuthService;
  let tenantModel: any;
  let userModel: any;
  let refreshTokenModel: any;
  let jwtService: JwtService;
  let emailProvider: any;

  const mockTenant = {
    _id: 'tenant-id-123',
    name: 'Test Org',
    slug: 'test-org',
    status: 'active',
    save: jest.fn(),
  };

  const mockUser = {
    _id: 'user-id-123',
    tenantId: 'tenant-id-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
    password: '$2b$12$hashedpassword',
    role: 'ADMIN',
    isActive: true,
    lastLoginAt: null,
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken('Tenant'),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getModelToken('User'),
          useValue: {
            findOne: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: getModelToken('RefreshToken'),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            updateOne: jest.fn(),
            updateMany: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                'jwt.accessSecret': 'test-access-secret-32-chars-long!!',
                'jwt.refreshSecret': 'test-refresh-secret-32-chars-long!',
                'jwt.accessExpiresIn': '15m',
                'jwt.refreshExpiresIn': '7d',
                'app.url': 'http://localhost:3000',
              };
              return config[key];
            }),
          },
        },
        {
          provide: EMAIL_PROVIDER,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
          },
        },
        {
          provide: PlatformSettingsService,
          useValue: {
            isSignupEnabled: () => true,
            isMaintenance: () => false,
            maintenanceMessage: () => 'maintenance',
            isSlugReserved: () => false,
            defaultPlan: () => 'free',
            trialDays: () => 14,
            limitsForPlan: () => ({ maxAgents: 1, maxLeads: 100, maxConversationsPerMonth: 500, maxKnowledgeSources: 5, maxUsers: 2 }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    tenantModel = module.get(getModelToken('Tenant'));
    userModel = module.get(getModelToken('User'));
    refreshTokenModel = module.get(getModelToken('RefreshToken'));
    jwtService = module.get<JwtService>(JwtService);
    emailProvider = module.get(EMAIL_PROVIDER);
  });

  describe('register', () => {
    it('should register a new tenant and admin user and email a verification code instead of tokens', async () => {
      tenantModel.findOne.mockResolvedValue(null);
      tenantModel.create.mockResolvedValue(mockTenant);
      userModel.create.mockResolvedValue(mockUser);
      userModel.updateOne.mockResolvedValue({});
      emailProvider.sendEmail.mockResolvedValue({ success: true, messageId: 'x' });

      const result: any = await service.register({
        tenantName: 'Test Org',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'StrongPass@123',
      });

      expect(result.requiresVerification).toBe(true);
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      expect(result.user.email).toBe('john@test.com');
      expect(result.tenant.slug).toBe('test-org');
      expect(result.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
      expect(userModel.create).toHaveBeenCalledWith(expect.objectContaining({ pendingEmailVerification: true }));
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        expect.objectContaining({
          $set: expect.objectContaining({ emailVerificationCode: expect.any(String), emailVerificationAttempts: 0 }),
        }),
      );
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'john@test.com', subject: expect.stringMatching(/^\d{6} is your verification code$/) }),
      );
    });

    it('should throw ConflictException if tenant slug exists', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);

      await expect(
        service.register({
          tenantName: 'Test Org',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          password: 'StrongPass@123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('email verification', () => {
    const crypto = require('crypto');
    const sha = (c: string) => crypto.createHash('sha256').update(c).digest('hex');

    it('login is blocked with EMAIL_NOT_VERIFIED while the signup is pending', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      const hashedPassword = await bcrypt.hash('StrongPass@123', 12);
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          password: hashedPassword,
          pendingEmailVerification: true,
          emailVerificationExpires: new Date(Date.now() + 60_000),
          emailVerificationSentAt: new Date(),
        }),
      });

      const attempt = service.login({ email: 'john@test.com', password: 'StrongPass@123', tenantSlug: 'test-org' });
      await expect(attempt).rejects.toThrow(ForbiddenException);
      await attempt.catch((e: any) => {
        expect(e.getResponse()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED', details: { email: 'john@test.com', tenantSlug: 'test-org' } });
      });
      expect(refreshTokenModel.create).not.toHaveBeenCalled();
    });

    it('verifyEmail with the right code marks the user verified and returns tokens', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          pendingEmailVerification: true,
          emailVerificationCode: sha('123456'),
          emailVerificationExpires: new Date(Date.now() + 60_000),
          emailVerificationAttempts: 0,
        }),
      });
      userModel.updateOne.mockResolvedValue({});
      refreshTokenModel.create.mockResolvedValue({});

      const result: any = await service.verifyEmail('john@test.com', 'test-org', '123456');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: mockUser._id },
        expect.objectContaining({ $set: expect.objectContaining({ pendingEmailVerification: false, emailVerifiedAt: expect.any(Date) }) }),
      );
    });

    it('verifyEmail rejects a wrong code and counts the attempt', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          pendingEmailVerification: true,
          emailVerificationCode: sha('123456'),
          emailVerificationExpires: new Date(Date.now() + 60_000),
          emailVerificationAttempts: 1,
        }),
      });
      userModel.updateOne.mockResolvedValue({});

      await expect(service.verifyEmail('john@test.com', 'test-org', '654321')).rejects.toThrow(BadRequestException);
      expect(userModel.updateOne).toHaveBeenCalledWith({ _id: mockUser._id }, { $inc: { emailVerificationAttempts: 1 } });
    });

    it('verifyEmail rejects an expired code', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          pendingEmailVerification: true,
          emailVerificationCode: sha('123456'),
          emailVerificationExpires: new Date(Date.now() - 1_000),
          emailVerificationAttempts: 0,
        }),
      });

      const attempt = service.verifyEmail('john@test.com', 'test-org', '123456');
      await expect(attempt).rejects.toThrow(BadRequestException);
      await attempt.catch((e: any) => expect(e.getResponse().code).toBe('VERIFICATION_CODE_EXPIRED'));
    });

    it('resendVerification enforces the 60s cooldown and then issues a new code', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          pendingEmailVerification: true,
          emailVerificationSentAt: new Date(),
        }),
      });
      await expect(service.resendVerification('john@test.com', 'test-org')).rejects.toThrow(BadRequestException);

      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          pendingEmailVerification: true,
          emailVerificationSentAt: new Date(Date.now() - 120_000),
        }),
      });
      userModel.updateOne.mockResolvedValue({});
      const result: any = await service.resendVerification('john@test.com', 'test-org');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(emailProvider.sendEmail).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      const hashedPassword = await bcrypt.hash('StrongPass@123', 12);
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          password: hashedPassword,
          save: jest.fn(),
        }),
      });
      refreshTokenModel.create.mockResolvedValue({});

      const result = await service.login({
        tenantSlug: 'test-org',
        email: 'john@test.com',
        password: 'StrongPass@123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('john@test.com');
    });

    it('should throw UnauthorizedException for invalid tenant', async () => {
      tenantModel.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          tenantSlug: 'nonexistent',
          email: 'john@test.com',
          password: 'wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for suspended tenant', async () => {
      tenantModel.findOne.mockResolvedValue({ ...mockTenant, status: 'suspended' });

      await expect(
        service.login({
          tenantSlug: 'test-org',
          email: 'john@test.com',
          password: 'StrongPass@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          password: await bcrypt.hash('CorrectPass@123', 12),
          save: jest.fn(),
        }),
      });

      await expect(
        service.login({
          tenantSlug: 'test-org',
          email: 'john@test.com',
          password: 'WrongPass@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          isActive: false,
        }),
      });

      await expect(
        service.login({
          tenantSlug: 'test-org',
          email: 'john@test.com',
          password: 'StrongPass@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token and send email', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      userModel.findOne.mockResolvedValue({
        ...mockUser,
        save: jest.fn(),
      });

      const result = await service.forgotPassword('john@test.com', 'test-org');

      expect(result.message).toContain('reset link has been sent');
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@test.com',
          subject: 'Password Reset Request',
        }),
      );
    });

    it('should not reveal if tenant does not exist', async () => {
      tenantModel.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword('john@test.com', 'nonexistent');
      expect(result.message).toContain('reset link has been sent');
    });

    it('should not reveal if user does not exist', async () => {
      tenantModel.findOne.mockResolvedValue(mockTenant);
      userModel.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@test.com', 'test-org');
      expect(result.message).toContain('reset link has been sent');
    });
  });

  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      const hashedPassword = await bcrypt.hash('OldPass@123', 12);
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          password: hashedPassword,
          save: jest.fn(),
        }),
      });
      refreshTokenModel.updateMany.mockResolvedValue({});

      const result = await service.changePassword('user-id-123', {
        currentPassword: 'OldPass@123',
        newPassword: 'NewPass@456',
      });

      expect(result.message).toBe('Password changed successfully');
    });

    it('should throw BadRequestException for wrong current password', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          password: await bcrypt.hash('CorrectPass@123', 12),
          save: jest.fn(),
        }),
      });

      await expect(
        service.changePassword('user-id-123', {
          currentPassword: 'WrongPass@123',
          newPassword: 'NewPass@456',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException for invalid refresh token', async () => {
      refreshTokenModel.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      refreshTokenModel.findOne.mockResolvedValue({
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      refreshTokenModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.logout('valid-refresh-token');
      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      userModel.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-id-123');
      expect(result.email).toBe('john@test.com');
      expect(result.firstName).toBe('John');
    });

    it('should throw BadRequestException for non-existent user', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
