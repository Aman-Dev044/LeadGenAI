'use client';
import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Sparkles, Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

const CODE_TTL_SECONDS = 5 * 60;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const email = (searchParams.get('email') || '').trim();
  const tenantSlug = (searchParams.get('tenant') || '').trim().toLowerCase();
  const initialExpiry = searchParams.get('expiresAt');

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number>(() => {
    const parsed = initialExpiry ? Date.parse(initialExpiry) : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now() + CODE_TTL_SECONDS * 1000;
  });
  const [lastSentAt, setLastSentAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const secondsLeft = Math.ceil((expiresAt - now) / 1000);
  const expired = secondsLeft <= 0;
  const resendWait = Math.ceil((lastSentAt + RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000);
  const canResend = resendWait <= 0 && !resending;

  const missingContext = !email || !tenantSlug;

  const maskedEmail = useMemo(() => {
    if (!email.includes('@')) return email;
    const [local, domain] = email.split('@');
    const shown = local.length <= 2 ? local[0] || '' : local.slice(0, 2);
    return `${shown}${'*'.repeat(Math.max(1, Math.min(6, local.length - shown.length)))}@${domain}`;
  }, [email]);

  const submit = async (value: string) => {
    if (missingContext || loading) return;
    if (!/^\d{6}$/.test(value)) {
      toast.error('Enter the 6-digit code from your email');
      return;
    }
    setLoading(true);
    try {
      const res: any = await api.post('/auth/verify-email', { email, tenantSlug, code: value });
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken, res.data.tenant);
      toast.success('Email verified! Welcome to LeadAI.');
      router.push('/dashboard');
    } catch (err: any) {
      const apiCode = err?.data?.code as string | undefined;
      if (apiCode === 'VERIFICATION_CODE_EXPIRED' || apiCode === 'VERIFICATION_TOO_MANY_ATTEMPTS' || apiCode === 'VERIFICATION_CODE_MISSING') {
        setExpiresAt(Date.now());
      }
      toast.error(err.message || 'Verification failed');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (missingContext || !canResend) return;
    setResending(true);
    try {
      const res: any = await api.post('/auth/resend-verification', { email, tenantSlug });
      const parsed = res?.data?.expiresAt ? Date.parse(res.data.expiresAt) : NaN;
      setExpiresAt(Number.isFinite(parsed) ? parsed : Date.now() + CODE_TTL_SECONDS * 1000);
      setLastSentAt(Date.now());
      setCode('');
      toast.success('A new code has been sent to your email');
      inputRef.current?.focus();
    } catch (err: any) {
      const retry = err?.data?.details?.retryAfterSeconds;
      if (typeof retry === 'number') setLastSentAt(Date.now() - (RESEND_COOLDOWN_SECONDS - retry) * 1000);
      toast.error(err.message || 'Could not resend the code');
    } finally {
      setResending(false);
    }
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void submit(digits);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            {missingContext ? (
              'We could not find which account to verify. Please sign up or sign in again.'
            ) : (
              <>
                We sent a 6-digit code to <span className="font-medium text-foreground">{maskedEmail}</span>.
                Enter it below to activate your account.
              </>
            )}
          </CardDescription>
        </CardHeader>

        {!missingContext && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(code);
            }}
          >
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  ref={inputRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={loading}
                  className="text-center text-2xl tracking-[0.6em] font-mono h-14"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                {expired ? (
                  <span className="text-destructive">Code expired. Request a new one.</span>
                ) : (
                  <span className="text-muted-foreground">
                    Code expires in <span className="font-medium text-foreground tabular-nums">{formatClock(secondsLeft)}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={resend}
                  disabled={!canResend}
                  className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resending ? 'Sending…' : canResend ? 'Resend code' : `Resend in ${resendWait}s`}
                </button>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6 || expired}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
                Verify and continue
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Wrong email? Check the spam folder, or{' '}
                <Link href="/auth/register" className="text-primary hover:underline">sign up again</Link> with a different address.
              </p>
            </CardFooter>
          </form>
        )}

        {missingContext && (
          <CardFooter className="flex flex-col gap-2">
            <Link href="/auth/register" className="w-full">
              <Button className="w-full">Create an account</Button>
            </Link>
            <Link href="/auth/login" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Button>
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
