'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
  tenantSlug: z.string().min(1, 'Organization slug is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  // Read ?next= at submit time (avoids a Suspense boundary requirement for useSearchParams during prerender)
  const getNextPath = () => {
    if (typeof window === 'undefined') return '/dashboard';
    const n = new URLSearchParams(window.location.search).get('next') || '';
    return n.startsWith('/dashboard') ? n : '/dashboard';
  };

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res: any = await api.post('/auth/login', { ...data, tenantSlug: data.tenantSlug.trim().toLowerCase(), email: data.email.trim() });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken, res.data.tenant);
      const isOwner = res.data.user?.role === 'SUPER_ADMIN';
      toast.success(isOwner ? 'Welcome, platform owner' : 'Welcome back!');
      const next = getNextPath();
      router.push(isOwner && next === '/dashboard' ? '/dashboard/admin' : next);
    } catch (err: any) {
      if (err?.data?.code === 'EMAIL_NOT_VERIFIED') {
        const details = err.data.details || {};
        toast.info('Please verify your email first. We sent you a 6-digit code.');
        const params = new URLSearchParams({
          email: details.email || data.email.trim(),
          tenant: details.tenantSlug || data.tenantSlug.trim().toLowerCase(),
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your LeadAI account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantSlug">Organization</Label>
              <Input id="tenantSlug" placeholder="your-org-slug" {...register('tenantSlug')} />
              {errors.tenantSlug && <p className="text-sm text-destructive">{errors.tenantSlug.message}</p>}
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
              <Input id="password" type="password" placeholder="********" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Don't have an account?{' '}
              <Link href="/auth/register" className="text-primary hover:underline">Sign up</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
