import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
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
    it('should register a new tenant and admin user', async () => {
      tenantModel.findOne.mockResolvedValue(null);
      tenantModel.create.mockResolvedValue(mockTenant);
      userModel.create.mockResolvedValue(mockUser);
      refreshTokenModel.create.mockResolvedValue({});

      const result = await service.register({
        tenantName: 'Test Org',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'StrongPass@123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('john@test.com');
      expect(result.tenant.slug).toBe('test-org');
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
