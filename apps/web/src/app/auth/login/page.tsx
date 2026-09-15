'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Sparkles, Loader2, Eye, EyeOff, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

type RoleTab = 'admin' | 'staff';

interface LoginFormData {
  email: string;
  password: string;
  tenantSlug?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [roleTab, setRoleTab] = useState<RoleTab>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Read ?next= at submit time (avoids a Suspense boundary requirement for useSearchParams during prerender)
  const getNextPath = () => {
    if (typeof window === 'undefined') return '/dashboard';
    const n = new URLSearchParams(window.location.search).get('next') || '';
    return n.startsWith('/dashboard') ? n : '/dashboard';
  };

  const loginSchema = useMemo(() => {
    return z
      .object({
        email: z.string().email('Invalid email'),
        password: z.string().min(1, 'Password is required'),
        tenantSlug: z.string().optional(),
      })
      .superRefine((data, ctx) => {
        if (roleTab === 'admin' && (!data.tenantSlug || !data.tenantSlug.trim())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Organization slug is required',
            path: ['tenantSlug'],
          });
        }
      });
  }, [roleTab]);

  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        email: data.email.trim(),
        password: data.password,
        loginType: roleTab,
      };

      if (roleTab === 'admin' && data.tenantSlug) {
        payload.tenantSlug = data.tenantSlug.trim().toLowerCase();
      }

      const res: any = await api.post('/auth/login', payload);
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken, res.data.tenant);
      const isOwner = res.data.user?.role === 'SUPER_ADMIN';
      toast.success(isOwner ? 'Welcome, platform owner' : `Welcome back, ${res.data.user?.firstName || 'User'}!`);
      const next = getNextPath();
      router.push(isOwner && next === '/dashboard' ? '/dashboard/admin' : next);
    } catch (err: any) {
      if (err?.data?.code === 'EMAIL_NOT_VERIFIED') {
        const details = err.data.details || {};
        toast.info('Please verify your email first. We sent you a 6-digit code.');
        const params = new URLSearchParams({
          email: details.email || data.email.trim(),
          tenant: details.tenantSlug || data.tenantSlug?.trim().toLowerCase() || '',
        });
        router.push(`/auth/verify-email?${params.toString()}`);
        return;
      }
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Card className="w-full shadow-float border-border/70">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-md shadow-primary/30">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
          <CardDescription>
            {roleTab === 'admin'
              ? 'Sign in to workspace or platform console'
              : 'Sign in for Sales Managers & Reps'}
          </CardDescription>

          {/* iOS Liquid Glass Segmented Switcher: Admin / Staff */}
          <div className="relative mx-auto mt-4 flex w-full max-w-[270px] p-1.5 rounded-full bg-slate-200/85 dark:bg-slate-800/90 border border-slate-300/70 dark:border-slate-700/80 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.08)] backdrop-blur-md">
            <div
              className={cn(
                'absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-full bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.14),0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]',
                roleTab === 'admin' ? 'left-1.5' : 'left-[calc(50%+1.5px)]',
              )}
            />
            <button
              type="button"
              onClick={() => {
                setRoleTab('admin');
                clearErrors();
              }}
              className={cn(
                'relative z-10 flex-1 py-1.5 text-[13px] rounded-full flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer select-none',
                roleTab === 'admin'
                  ? 'text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium',
              )}
            >
              <ShieldCheck
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  roleTab === 'admin' ? 'text-primary scale-110' : 'text-slate-500',
                )}
              />
              <span>Admin</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab('staff');
                clearErrors();
              }}
              className={cn(
                'relative z-10 flex-1 py-1.5 text-[13px] rounded-full flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer select-none',
                roleTab === 'staff'
                  ? 'text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium',
              )}
            >
              <Users
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  roleTab === 'staff' ? 'text-primary scale-110' : 'text-slate-500',
                )}
              />
              <span>Staff</span>
            </button>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Organization field with fluid animated collapse/expand */}
            <div
              className={cn(
                'overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]',
                roleTab === 'admin' ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0 -mb-4 pointer-events-none',
              )}
            >
              <div className="space-y-2 pb-1">
                <Label htmlFor="tenantSlug">Organization</Label>
                <Input
                  id="tenantSlug"
                  placeholder="your-org-slug"
                  tabIndex={roleTab === 'admin' ? 0 : -1}
                  {...register('tenantSlug')}
                />
                {errors.tenantSlug && <p className="text-sm text-destructive">{errors.tenantSlug.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {roleTab === 'admin' ? 'Sign In as Admin' : 'Sign In as Staff'}
            </Button>

            {roleTab === 'admin' ? (
              <p className="text-sm text-muted-foreground text-center">
                Don't have an account?{' '}
                <Link href="/auth/register" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Staff accounts are assigned by your workspace administrator.
              </p>
            )}

            <p className="text-[11px] text-muted-foreground text-center pt-2 border-t border-border/50">
              By signing in, you acknowledge LeadAI's{' '}
              <Link href="/privacy" className="text-primary font-medium underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
