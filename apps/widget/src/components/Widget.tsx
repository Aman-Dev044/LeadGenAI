import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

interface WidgetProps {
  agentId: string;
  apiUrl: string;
  position: 'bottom-right' | 'bottom-left';
}

interface Message {
  _id: string;
  sender: 'visitor' | 'bot' | 'agent' | 'system';
  content: string;
  createdAt: string;
  type?: string;
}

interface LeadField {
  field: string;
  label: string;
  type: string;
  required: boolean;
}

interface AgentConfig {
  name: string;
  welcomeMessage: string;
  widgetConfig: {
    primaryColor: string;
    headerText: string;
    placeholder: string;
    avatarUrl?: string;
  };
  leadCaptureFields: (LeadField | string)[];
}

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_BACKOFF_MS = 30000;
const SEND_TIMEOUT_MS = 45000;
const LEAD_FORM_AFTER_VISITOR_MESSAGES = 3;

/** Synthesize a pleasant ~1-sec message notification chime */
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // Cheerful two-tone chime (D5 -> A5 -> D6)
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.2);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.8);
  } catch {}
}

// Simple markdown to HTML converter (no external deps needed)
function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).replace(/^\w*\n/, '');
    return `<pre><code>${code}</code></pre>`;
  });

  // Inline code (`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Headers (### h3, ## h2, # h1)
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Unordered lists (- item or * item)
  html = html.replace(/^[\s]*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists (1. item)
  html = html.replace(/^[\s]*\d+\. (.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> not already in <ul> into <ol>
  html = html.replace(/(?<!<\/ul>)((?:<li>.*<\/li>\n?)+)/g, (match, p1) => {
    // Only wrap if not already wrapped by <ul>
    return `<ol>${p1}</ol>`;
  });

  // Line breaks: double newline = paragraph break, single newline = <br>
  html = html
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Don't wrap if already block-level element
      if (/^<(h[1-6]|ul|ol|pre|blockquote)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  return html;
}

/** Page context sent with the conversation so leads carry source / UTM data. */
function getVisitorContext() {
  const params = new URLSearchParams(window.location.search);
  const ua = navigator.userAgent || '';
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
  const ctx: Record<string, string> = {
    url: window.location.href,
    referrer: document.referrer,
    device,
  };
  const utmKeys: Record<string, string> = {
    utm_source: 'utmSource',
    utm_medium: 'utmMedium',
    utm_campaign: 'utmCampaign',
    utm_term: 'utmTerm',
    utm_content: 'utmContent',
  };
  for (const [param, key] of Object.entries(utmKeys)) {
    const value = params.get(param);
    if (value) ctx[key] = value;
  }
  return ctx;
}

function storageKey(agentId: string) {
  return `leadai_conversation_${agentId}`;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function Widget({ agentId, apiUrl, position }: WidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationEnded, setConversationEnded] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadFormDismissed, setLeadFormDismissed] = useState(false);
  const [leadForm, setLeadForm] = useState<Record<string, string>>({});
  const [leadFormError, setLeadFormError] = useState<string | null>(null);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false); // true while a send is in flight
  const pollBackoffRef = useRef(POLL_INTERVAL_MS);
  const visitorId = getVisitorId();

  // ─── Helpers ──────────────────────────────────────────────────────

  const welcomeMessage = useCallback((): Message | null => {
    if (!config?.welcomeMessage) return null;
    return { _id: 'welcome', sender: 'bot', content: config.welcomeMessage, createdAt: new Date().toISOString() };
  }, [config]);

  /** Merge server messages with the local list: welcome first, dedupe by _id, drop temp/tool rows. */
  const mergeMessages = useCallback(
    (incoming: Message[], keepLocal: Message[] = []) => {
      const seen = new Set<string>();
      const out: Message[] = [];
      const welcome = welcomeMessage();
      if (welcome) {
        out.push(welcome);
        seen.add(welcome._id);
      }
      for (const m of [...incoming, ...keepLocal]) {
        if (!m || !m._id || seen.has(m._id)) continue;
        if (m.type === 'tool_result') continue;
        if (m._id === 'welcome') continue;
        if (!m.content) continue;
        seen.add(m._id);
        out.push(m);
      }
      return out;
    },
    [welcomeMessage],
  );

  const visitorMessageCount = messages.filter((m) => m.sender === 'visitor').length;

  const friendlyError = (status: number, fallback: string) => {
    if (status === 429) return 'You are sending messages too quickly. Please wait a moment.';
    if (status === 404) return 'This chat has ended. Start a new one to continue.';
    if (status >= 500) return 'The chat service is temporarily unavailable. Please try again shortly.';
    return fallback;
  };

  // ─── Config ───────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/widget/config/${agentId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Config fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setConfig(data.data || data);
      })
      .catch((err) => {
        console.error('LeadAI Widget: Failed to load config', err);
        if (!cancelled) setError('Failed to connect to chat service');
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, apiUrl]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ─── Conversation lifecycle ───────────────────────────────────────

  const loadMessages = useCallback(
    async (convId: string): Promise<boolean> => {
      const res = await fetch(`${apiUrl}/widget/conversations/${convId}/messages?agentId=${agentId}&limit=100`);
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(`Messages fetch failed: ${res.status}`);
      const data = await res.json();
      const dbMsgs: Message[] = data.data?.data || data.data || [];
      setMessages((prev) => {
        if (prev.length > 0 && dbMsgs.length > prev.length) {
          const newIncoming = dbMsgs.slice(prev.length);
          if (newIncoming.some((m) => m.sender === 'bot' || m.sender === 'agent')) {
            playNotificationChime();
          }
        }
        return mergeMessages(dbMsgs, prev.filter((m) => m._id.startsWith('temp-')));
      });
      return true;
    },
    [apiUrl, agentId, mergeMessages],
  );

  const startConversation = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/widget/conversations/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, visitorId, visitorInfo: getVisitorContext() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw Object.assign(new Error(errData.message || `Failed to start: ${res.status}`), { status: res.status });
      }
      const data = await res.json();
      const conv = data.data || data;
      const id = conv._id || conv.conversationId;
      writeStored(storageKey(agentId), id);
      setConversationId(id);
      setConversationEnded(false);
      setLeadCaptured(false);
      setLeadFormDismissed(false);
      setShowLeadForm(false);
      setMessages(mergeMessages([]));
    } catch (err: any) {
      console.error('LeadAI Widget: Failed to start conversation', err);
      setError(friendlyError(err?.status || 0, 'Could not start chat. Please try again.'));
    } finally {
      setStarting(false);
    }
  }, [apiUrl, agentId, visitorId, mergeMessages]);

  /** Resume the previous conversation on this device, or start a fresh one. */
  const ensureConversation = useCallback(async () => {
    if (conversationId || starting) return;
    const stored = readStored(storageKey(agentId));
    if (stored) {
      try {
        const ok = await loadMessages(stored);
        if (ok) {
          setConversationId(stored);
          setLeadCaptured(readStored(`${storageKey(agentId)}_lead`) === '1');
          return;
        }
      } catch (err) {
        console.warn('LeadAI Widget: could not resume conversation', err);
      }
      writeStored(storageKey(agentId), null);
    }
    await startConversation();
  }, [conversationId, starting, agentId, loadMessages, startConversation]);

  // Poll for new messages while open, visible and not sending. Backs off on errors.
  useEffect(() => {
    if (!conversationId || !isOpen || conversationEnded) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === 'visible' && !sendingRef.current) {
        try {
          const ok = await loadMessages(conversationId);
          if (!ok) {
            setConversationEnded(true);
            return;
          }
          pollBackoffRef.current = POLL_INTERVAL_MS;
        } catch {
          pollBackoffRef.current = Math.min(pollBackoffRef.current * 2, POLL_MAX_BACKOFF_MS);
        }
      }
      if (!stopped) timer = setTimeout(tick, pollBackoffRef.current);
    };

    timer = setTimeout(tick, pollBackoffRef.current);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !stopped) {
        if (timer) clearTimeout(timer);
        pollBackoffRef.current = POLL_INTERVAL_MS;
        timer = setTimeout(tick, 250);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [conversationId, isOpen, conversationEnded, loadMessages]);

  const toggleWidget = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    await ensureConversation();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const startNewChat = async () => {
    writeStored(storageKey(agentId), null);
    writeStored(`${storageKey(agentId)}_lead`, null);
    setConversationId(null);
    setMessages([]);
    await startConversation();
  };

  // ─── Sending ──────────────────────────────────────────────────────

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !conversationId || loading || conversationEnded) return;
    setInput('');
    setError(null);

    // Add visitor message optimistically
    const tempId = 'temp-' + Date.now();
    const tempMsg: Message = { _id: tempId, sender: 'visitor', content, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, tempMsg]);
    setLoading(true);
    sendingRef.current = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
      const res = await fetch(`${apiUrl}/widget/conversations/${conversationId}/visitor-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, visitorId, agentId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 404) setConversationEnded(true);
        throw Object.assign(new Error(errData.message || `Send failed: ${res.status}`), { status: res.status });
      }

      const data = await res.json();
      const result = data.data || data;
      const incoming: Message[] = [];
      if (result.visitorMessage) incoming.push(result.visitorMessage);
      if (result.botMessage) {
        incoming.push(result.botMessage);
        playNotificationChime();
      }

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m._id !== tempId && m._id !== 'welcome');
        return mergeMessages([...withoutTemp, ...incoming]);
      });

      // Ask for contact details after a few visitor messages unless already captured
      const nextVisitorCount = visitorMessageCount + 1;
      if (
        !leadCaptured &&
        !leadFormDismissed &&
        nextVisitorCount >= LEAD_FORM_AFTER_VISITOR_MESSAGES &&
        (config?.leadCaptureFields?.length || 0) > 0
      ) {
        setShowLeadForm(true);
      }
    } catch (err: any) {
      console.error('Failed to send message', err);
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setInput(content); // give the text back so the visitor can retry
      const msg = err?.name === 'AbortError' ? 'The assistant took too long to reply. Please try again.' : 'Failed to send message. Try again.';
      setError(friendlyError(err?.status || 0, msg));
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  // ─── Lead form ────────────────────────────────────────────────────

  const leadFields = (config?.leadCaptureFields || []).map((f) => {
    if (typeof f === 'string') {
      return { field: f, label: f.charAt(0).toUpperCase() + f.slice(1), type: f === 'email' ? 'email' : f === 'phone' ? 'phone' : 'text', required: f === 'email' };
    }
    return f;
  });

  const submitLeadForm = async () => {
    setLeadFormError(null);
    for (const f of leadFields) {
      const value = (leadForm[f.field] || '').trim();
      if (f.required && !value) {
        setLeadFormError(`${f.label} is required`);
        return;
      }
      if (f.type === 'email' && value && !isValidEmail(value)) {
        setLeadFormError('Please enter a valid email address');
        return;
      }
    }

    setSubmittingLead(true);
    try {
      const res = await fetch(`${apiUrl}/widget/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, visitorId, conversationId, data: leadForm }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed: ${res.status}`);
      }
      writeStored(`${storageKey(agentId)}_lead`, '1');
      setShowLeadForm(false);
      setLeadCaptured(true);
      setMessages((prev) => [
        ...prev,
        { _id: 'lead-thanks-' + Date.now(), sender: 'system', content: 'Thanks! Your details have been shared with our team.', createdAt: new Date().toISOString() },
      ]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err: any) {
      console.error('Failed to capture lead', err);
      setLeadFormError('Could not save your details. Please try again.');
    } finally {
      setSubmittingLead(false);
    }
  };

  const dismissLeadForm = () => {
    setShowLeadForm(false);
    setLeadFormDismissed(true);
  };

  // ─── Render ───────────────────────────────────────────────────────

  const primaryColor = config?.widgetConfig?.primaryColor || '#3b82f6';
  const inputDisabled = !conversationId || conversationEnded || starting;

  return (
    <div class={`widget-container ${position}`} style={{ '--primary': primaryColor } as any}>
      {isOpen && (
        <div class="widget-panel" role="dialog" aria-label={config?.widgetConfig?.headerText || 'Chat'}>
          <div class="widget-header">
            <h3>{config?.widgetConfig?.headerText || 'Chat with us'}</h3>
            <button onClick={() => setIsOpen(false)} aria-label="Close chat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="widget-messages">
            {starting && messages.length === 0 && (
              <div class="typing-indicator">
                <span /><span /><span />
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg._id} class={`message ${msg.sender}`}>
                {(msg.sender === 'bot' || msg.sender === 'agent') && msg.content ? (
                  <div class="msg-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                ) : (
                  msg.content || ''
                )}
              </div>
            ))}
            {loading && (
              <div class="typing-indicator">
                <span /><span /><span />
              </div>
            )}
            {error && <div class="message system">{error}</div>}
            {conversationEnded && (
              <div class="message system">
                This chat has ended.{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); startNewChat(); }}>Start a new chat</a>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showLeadForm && !leadCaptured && (
            <div class="lead-form">
              <h4>Share your details to continue</h4>
              {leadFields.map((f) => (
                <input
                  key={f.field}
                  type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : f.type === 'number' ? 'number' : 'text'}
                  placeholder={f.required ? `${f.label} *` : f.label}
                  value={leadForm[f.field] || ''}
                  onInput={(e) => setLeadForm({ ...leadForm, [f.field]: (e.target as HTMLInputElement).value })}
                  onKeyDown={(e) => e.key === 'Enter' && submitLeadForm()}
                />
              ))}
              {leadFormError && <div class="lead-form-error">{leadFormError}</div>}
              <button onClick={submitLeadForm} disabled={submittingLead}>
                {submittingLead ? 'Saving...' : 'Continue Chat'}
              </button>
              <button class="lead-form-skip" onClick={dismissLeadForm} disabled={submittingLead}>
                Maybe later
              </button>
            </div>
          )}

          <div class="widget-input">
            <input
              ref={inputRef}
              type="text"
              placeholder={config?.widgetConfig?.placeholder || 'Type a message...'}
              value={input}
              maxLength={2000}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={inputDisabled}
              aria-label="Message"
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading || inputDisabled} aria-label="Send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>

          <div class="powered-by">
            Powered by <a href="#" onClick={(e) => e.preventDefault()}>LeadAI</a>
          </div>
        </div>
      )}

      <button class="widget-bubble" onClick={toggleWidget} style={{ background: primaryColor }} aria-label={isOpen ? 'Close chat' : 'Open chat'}>
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

function getVisitorId(): string {
  let id = readStored('leadai_visitor_id');
  if (!id) {
    id = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    writeStored('leadai_visitor_id', id);
  }
  return id;
}
