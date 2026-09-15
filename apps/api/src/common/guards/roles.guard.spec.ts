import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockContext = (role: string, method = 'POST'): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role },
          method,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow access when no roles required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const context = createMockContext('SALESPERSON');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow SUPER_ADMIN for any role requirement', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN']);
    const context = createMockContext('SUPER_ADMIN');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user with matching role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN', 'SALES_MANAGER']);
    const context = createMockContext('ADMIN');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny user without matching role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN']);
    const context = createMockContext('VIEWER');

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow VIEWER for GET requests on endpoints that list VIEWER', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN', 'VIEWER']);
    const context = createMockContext('VIEWER', 'GET');

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny VIEWER for GET requests on endpoints that do not list VIEWER', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN', 'SALESPERSON']);
    const context = createMockContext('VIEWER', 'GET');

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny VIEWER for non-GET requests', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN']);
    const context = createMockContext('VIEWER', 'POST');

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
