import { Bot, MessageSquare, ShieldCheck, Sparkles, Target, Zap } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: Bot, title: 'AI sales agent', text: 'Chats with every visitor, answers from your knowledge base and captures leads 24/7.' },
  { icon: Target, title: 'Automatic scoring', text: 'Hot, warm and cold leads ranked in real time so your team calls the right people first.' },
  { icon: Zap, title: 'Follow-ups on autopilot', text: 'Email, SMS and WhatsApp sequences fire the moment a lead is created or changes status.' },
  { icon: MessageSquare, title: 'Human handoff', text: 'Jump into any conversation live when the AI decides a person should take over.' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-brand-gradient text-white lg:flex lg:flex-col lg:justify-between p-12">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-inset ring-white/30 backdrop-blur">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">LeadAI</p>
            <p className="text-xs text-white/70">Conversational lead generation</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Turn every website visit into a qualified conversation.
          </h1>
          <p className="mt-4 text-base text-white/80">
            One embeddable widget. An AI agent that knows your business. A pipeline that fills itself.
          </p>
          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">
                  <h.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-semibold">{h.title}</p>
                  <p className="text-sm text-white/75">{h.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-4 w-4" /> Multi-tenant isolation · Role-based access · Full audit trail
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md page-enter">
          <div className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md shadow-primary/30">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-bold tracking-tight">LeadAI</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
