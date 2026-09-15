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
    position?: string;
    whatsappEnabled?: boolean;
    whatsappNumber?: string;
    whatsappDefaultMessage?: string;
    proactivePromptEnabled?: boolean;
    proactiveDelaySeconds?: number;
    proactiveMessage?: string;
    exitIntentEnabled?: boolean;
    exitIntentMessage?: string;
    defaultVoiceName?: string;
    defaultVoiceRate?: number;
    defaultVoicePitch?: number;
  };
  leadCaptureFields: (LeadField | string)[];
}

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_BACKOFF_MS = 30000;
const SEND_TIMEOUT_MS = 45000;
const LEAD_FORM_AFTER_VISITOR_MESSAGES = 3;
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes auto-reset

export interface HistoryItem {
  id: string;
  preview: string;
  updatedAt: number;
  messageCount: number;
}

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

/** Fetch and cache client geolocation via ipwho.is with fallback to timezone */
let cachedGeoData: Record<string, any> | null = null;

function initGeoLocation() {
  try {
    const raw = sessionStorage.getItem('leadai_geo') || localStorage.getItem('leadai_geo');
    if (raw) {
      cachedGeoData = JSON.parse(raw);
      return;
    }
  } catch {}

  if (typeof fetch !== 'undefined') {
    fetch('https://ipwho.is/')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success !== false && (data.city || data.country)) {
          cachedGeoData = {
            city: data.city || '',
            region: data.region || '',
            country: data.country || '',
            countryCode: data.country_code || '',
            ip: data.ip || '',
            timezone: data.timezone?.id || '',
          };
          try {
            sessionStorage.setItem('leadai_geo', JSON.stringify(cachedGeoData));
            localStorage.setItem('leadai_geo', JSON.stringify(cachedGeoData));
          } catch {}
        }
      })
      .catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  initGeoLocation();
}

/** Page context sent with the conversation so leads carry source / UTM data. */
function getVisitorContext() {
  const params = new URLSearchParams(window.location.search);
  const ua = navigator.userAgent || '';
  const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {}

  const ctx: Record<string, string> = {
    url: window.location.href,
    referrer: document.referrer,
    device,
    timezone: tz,
  };

  if (!cachedGeoData) {
    try {
      const raw = sessionStorage.getItem('leadai_geo') || localStorage.getItem('leadai_geo');
      if (raw) cachedGeoData = JSON.parse(raw);
    } catch {}
  }

  if (cachedGeoData) {
    if (cachedGeoData.city) ctx.city = cachedGeoData.city;
    if (cachedGeoData.region) ctx.region = cachedGeoData.region;
    if (cachedGeoData.country) ctx.country = cachedGeoData.country;
    if (cachedGeoData.countryCode) ctx.countryCode = cachedGeoData.countryCode;
    if (cachedGeoData.ip) ctx.ip = cachedGeoData.ip;
    if (cachedGeoData.timezone && !ctx.timezone) ctx.timezone = cachedGeoData.timezone;
  }

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

function lastActiveKey(agentId: string) {
  return `leadai_last_active_${agentId}`;
}

function historyKey(agentId: string) {
  return `leadai_history_${agentId}`;
}

function getLocalHistory(agentId: string): HistoryItem[] {
  try {
    const raw = localStorage.getItem(historyKey(agentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(agentId: string, items: HistoryItem[]) {
  try {
    localStorage.setItem(historyKey(agentId), JSON.stringify(items.slice(0, 30)));
  } catch {}
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>(() => getLocalHistory(agentId));
  const [autoResetNotice, setAutoResetNotice] = useState(false);

  // Voice Mode & In-Browser Speech Recognition & TTS
  const [voiceMode, setVoiceMode] = useState<boolean>(() => readStored('leadai_voice_mode') === '1');
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => readStored('leadai_voice_uri') || '');
  const [selectedVoiceRate, setSelectedVoiceRate] = useState<number>(() => {
    const s = readStored('leadai_voice_rate');
    return s ? parseFloat(s) : 1.0;
  });
  const [selectedVoicePitch, setSelectedVoicePitch] = useState<number>(() => {
    const s = readStored('leadai_voice_pitch');
    return s ? parseFloat(s) : 1.0;
  });

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');
  const sendMessageRef = useRef<((text?: string) => Promise<void>) | null>(null);

  // Proactive Screen-Aware Nudge & Exit-Intent Interceptor
  const [showNudge, setShowNudge] = useState(false);
  const [showExitIntent, setShowExitIntent] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false); // true while a send is in flight
  const pollBackoffRef = useRef(POLL_INTERVAL_MS);
  const visitorId = getVisitorId();

  // Load available browser voices reliably
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const populateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        setAvailableVoices(v);
      }
    };
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }, []);

  // ─── Voice TTS Engine with Custom Voice, Pitch, and Rate ─────────────

  const speakText = useCallback(
    (
      text: string,
      msgId?: string,
      overrideVoiceURI?: string,
      overrideRate?: number,
      overridePitch?: number,
    ) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      if (msgId && speakingMessageId === msgId) {
        setSpeakingMessageId(null);
        return;
      }
      const clean = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`.*?`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_~#]/g, '')
        .trim();
      if (!clean) return;

      const utter = new SpeechSynthesisUtterance(clean);
      const rate = overrideRate !== undefined ? overrideRate : (selectedVoiceRate || config?.widgetConfig?.defaultVoiceRate || 1.0);
      const pitch = overridePitch !== undefined ? overridePitch : (selectedVoicePitch || config?.widgetConfig?.defaultVoicePitch || 1.0);
      utter.rate = rate;
      utter.pitch = pitch;

      if (msgId) setSpeakingMessageId(msgId);
      utter.onend = () => setSpeakingMessageId(null);
      utter.onerror = () => setSpeakingMessageId(null);

      const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
      const targetVoice = overrideVoiceURI || selectedVoiceURI || config?.widgetConfig?.defaultVoiceName;

      let chosenVoice: SpeechSynthesisVoice | undefined;
      if (targetVoice) {
        chosenVoice = voices.find(
          (v) => v.voiceURI === targetVoice || v.name === targetVoice || v.name.includes(targetVoice),
        );
      }

      if (!chosenVoice) {
        // Prefer natural / online neural voices
        chosenVoice =
          voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') ||
                v.name.includes('Online') ||
                v.name.includes('Google') ||
                v.name.includes('Samantha') ||
                v.name.includes('Jenny') ||
                v.name.includes('Guy')),
          ) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
      }

      if (chosenVoice) utter.voice = chosenVoice;
      window.speechSynthesis.speak(utter);
    },
    [speakingMessageId, availableVoices, selectedVoiceURI, selectedVoiceRate, selectedVoicePitch, config],
  );

  // ─── WhatsApp 1-Click Integration Helper ───────────────────────────

  const getWhatsAppUrl = (customText?: string) => {
    const rawNumber = config?.widgetConfig?.whatsappNumber || '';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    if (!cleanNumber) return '';
    const defaultMsg =
      config?.widgetConfig?.whatsappDefaultMessage ||
      `Hi! I was visiting ${typeof window !== 'undefined' ? window.location.hostname : 'your website'} and would like to get more information.`;
    const text = customText || defaultMsg;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
  };

  const handleWhatsAppClick = (customText?: string) => {
    const url = getWhatsAppUrl(customText);
    if (!url) return;
    try {
      fetch(`${apiUrl}/widget/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          conversationId,
          data: {
            source: 'whatsapp_click',
            url: typeof window !== 'undefined' ? window.location.href : '',
          },
        }),
      }).catch(() => {});
    } catch {}
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ─── Voice STT (Speech-to-Text with 2s Silence Auto-Send) ─────────

  const toggleListening = () => {
    if (isListening) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      latestTranscriptRef.current = '';
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Voice input is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const clean = transcript.trim();
        setInput(clean);
        latestTranscriptRef.current = clean;

        // Reset the 2-second silence timer on each spoken fragment
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (clean.length > 0) {
          // If user pauses speaking for 2 seconds: automatically send and clear input!
          silenceTimerRef.current = setTimeout(() => {
            const toSend = latestTranscriptRef.current.trim();
            latestTranscriptRef.current = '';
            if (recognitionRef.current) {
              try { recognitionRef.current.stop(); } catch {}
            }
            setIsListening(false);
            if (toSend && sendMessageRef.current) {
              sendMessageRef.current(toSend);
            }
          }, 2000);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        if (event.error === 'not-allowed') {
          setError('Microphone access was denied. Please allow microphone permissions.');
        }
      };

      rec.onend = () => {
        setIsListening(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        // If recognition stops and speech was ready, auto-send
        const toSend = latestTranscriptRef.current.trim();
        if (toSend && !sendingRef.current && sendMessageRef.current) {
          latestTranscriptRef.current = '';
          sendMessageRef.current(toSend);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  // ─── Proactive Screen-Aware Nudge & Exit-Intent Timers ────────────

  useEffect(() => {
    if (isOpen) {
      setShowNudge(false);
      setShowExitIntent(false);
      return;
    }

    const proactiveEnabled = config?.widgetConfig?.proactivePromptEnabled !== false;
    const delaySecs = config?.widgetConfig?.proactiveDelaySeconds || 10;
    const exitEnabled = config?.widgetConfig?.exitIntentEnabled !== false;

    // 1. Dwell time Nudge (after configurable seconds on page)
    let nudgeTimer: any = null;
    if (proactiveEnabled) {
      nudgeTimer = setTimeout(() => {
        try {
          if (!isOpen && !sessionStorage.getItem('leadai_nudge_dismissed')) {
            setShowNudge(true);
            playNotificationChime();
          }
        } catch {}
      }, delaySecs * 1000);
    }

    // Scroll depth trigger (> 50% of page)
    const handleScroll = () => {
      try {
        if (!proactiveEnabled || isOpen || sessionStorage.getItem('leadai_nudge_dismissed')) return;
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 200 && window.scrollY / totalHeight > 0.5) {
          setShowNudge(true);
          playNotificationChime();
        }
      } catch {}
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // 2. Exit-Intent Interceptor (when mouse moves to top of page/tab bar)
    const handleMouseLeave = (e: MouseEvent) => {
      try {
        if (exitEnabled && e.clientY <= 12 && !sessionStorage.getItem('leadai_exit_intent_dismissed') && !isOpen) {
          setShowExitIntent(true);
          setShowNudge(false); // supersede simple nudge
          playNotificationChime();
        }
      } catch {}
    };

    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (nudgeTimer) clearTimeout(nudgeTimer);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isOpen, config]);

  const handleOpenFromNudgeOrExit = async (prefillMessage?: string) => {
    setShowNudge(false);
    setShowExitIntent(false);
    try {
      sessionStorage.setItem('leadai_nudge_dismissed', '1');
      sessionStorage.setItem('leadai_exit_intent_dismissed', '1');
    } catch {}
    setIsOpen(true);
    await ensureConversation();
    if (prefillMessage) {
      setInput(prefillMessage);
    }
    setTimeout(() => inputRef.current?.focus(), 80);
  };

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

  const updateActivity = useCallback(() => {
    writeStored(lastActiveKey(agentId), String(Date.now()));
  }, [agentId]);

  const updateHistoryWithConversation = useCallback(
    (convId: string, msgs: Message[]) => {
      if (!convId) return;
      const meaningful = msgs.filter((m) => m && m._id !== 'welcome' && m.type !== 'tool_result' && m.content);
      if (meaningful.length === 0) return;

      const lastMsg = meaningful[meaningful.length - 1];
      const preview = (lastMsg?.content || 'Conversation').slice(0, 80).trim();

      setHistoryList((prev) => {
        const existing = prev.filter((item) => item.id !== convId);
        const updated: HistoryItem = {
          id: convId,
          preview: preview || 'New conversation',
          updatedAt: Date.now(),
          messageCount: meaningful.length,
        };
        const nextList = [updated, ...existing];
        saveLocalHistory(agentId, nextList);
        return nextList;
      });
    },
    [agentId],
  );

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
      if (dbMsgs.length > 0) {
        updateHistoryWithConversation(convId, dbMsgs);
      }
      return true;
    },
    [apiUrl, agentId, mergeMessages, updateHistoryWithConversation],
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
      writeStored(lastActiveKey(agentId), String(Date.now()));
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

  /** Resume the previous conversation on this device, or start a fresh one if 10 min inactive. */
  const ensureConversation = useCallback(async () => {
    if (conversationId || starting) return;
    const stored = readStored(storageKey(agentId));
    const lastActiveStr = readStored(lastActiveKey(agentId));
    const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
    const isTimedOut = lastActive > 0 && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS;

    if (stored) {
      if (isTimedOut) {
        // 10 minutes exceeded: archive old conversation & start fresh
        try {
          await loadMessages(stored);
        } catch {}
        writeStored(storageKey(agentId), null);
        writeStored(lastActiveKey(agentId), String(Date.now()));
        setAutoResetNotice(true);
        await startConversation();
        return;
      }
      try {
        const ok = await loadMessages(stored);
        if (ok) {
          setConversationId(stored);
          updateActivity();
          setLeadCaptured(readStored(`${storageKey(agentId)}_lead`) === '1');
          return;
        }
      } catch (err) {
        console.warn('LeadAI Widget: could not resume conversation', err);
      }
      writeStored(storageKey(agentId), null);
    }
    await startConversation();
  }, [conversationId, starting, agentId, loadMessages, startConversation, updateActivity]);

  // Inactivity timeout monitor: auto-reset active conversation after 10 minutes of inactivity
  useEffect(() => {
    if (!isOpen || !conversationId || conversationEnded) return;

    const timer = setInterval(() => {
      const lastActiveStr = readStored(lastActiveKey(agentId));
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;
      if (lastActive > 0 && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
        // 10 minutes elapsed without activity
        if (messages.length > 0) {
          updateHistoryWithConversation(conversationId, messages);
        }
        writeStored(storageKey(agentId), null);
        writeStored(lastActiveKey(agentId), String(Date.now()));
        setConversationId(null);
        setAutoResetNotice(true);
        startConversation();
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [isOpen, conversationId, conversationEnded, messages, agentId, updateHistoryWithConversation, startConversation]);

  // Synchronize conversation history from backend when history panel is opened
  useEffect(() => {
    if (!showHistory) return;
    fetch(`${apiUrl}/widget/conversations?agentId=${agentId}&visitorId=${visitorId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const convs = data?.data || data || [];
        if (Array.isArray(convs) && convs.length > 0) {
          setHistoryList((prev) => {
            const map = new Map<string, HistoryItem>();
            for (const item of prev) map.set(item.id, item);
            for (const c of convs) {
              const id = c._id;
              if (!map.has(id)) {
                map.set(id, {
                  id,
                  preview: c.summary || c.visitorInfo?.notes || 'Chat conversation',
                  updatedAt: new Date(c.updatedAt || c.createdAt).getTime(),
                  messageCount: 1,
                });
              }
            }
            const merged = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
            saveLocalHistory(agentId, merged);
            return merged;
          });
        }
      })
      .catch(() => {});
  }, [showHistory, apiUrl, agentId, visitorId]);

  const resumeConversation = async (selectedId: string) => {
    if (selectedId === conversationId) {
      setShowHistory(false);
      return;
    }
    setStarting(true);
    setError(null);
    setAutoResetNotice(false);
    try {
      const ok = await loadMessages(selectedId);
      if (ok) {
        writeStored(storageKey(agentId), selectedId);
        updateActivity();
        setConversationId(selectedId);
        setConversationEnded(false);
        setShowHistory(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setError('Could not load that conversation.');
      }
    } catch (err) {
      console.error('Failed to resume conversation', err);
      setError('Failed to load past conversation.');
    } finally {
      setStarting(false);
    }
  };

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
    if (conversationId && messages.length > 0) {
      updateHistoryWithConversation(conversationId, messages);
    }
    writeStored(storageKey(agentId), null);
    writeStored(`${storageKey(agentId)}_lead`, null);
    writeStored(lastActiveKey(agentId), String(Date.now()));
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
    setAutoResetNotice(false);
    await startConversation();
  };

  // ─── Sending ──────────────────────────────────────────────────────

  const sendMessage = async (overrideContent?: string) => {
    const content = (typeof overrideContent === 'string' ? overrideContent : input).trim();
    if (!content || !conversationId || loading || conversationEnded) return;
    setInput('');
    latestTranscriptRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setError(null);
    updateActivity();

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
        if (voiceMode && result.botMessage.content) {
          speakText(result.botMessage.content, result.botMessage._id);
        }
      }

      // Sync lead status from backend
      let isAlreadyCaptured = leadCaptured;
      if (result.leadCaptured) {
        isAlreadyCaptured = true;
        setLeadCaptured(true);
        setShowLeadForm(false);
        writeStored(`${storageKey(agentId)}_lead`, '1');
      }

      if (result.visitorInfo) {
        const vi = result.visitorInfo;
        const fullName = vi.firstName ? `${vi.firstName} ${vi.lastName || ''}`.trim() : '';
        setLeadForm((prev) => ({
          ...prev,
          name: prev.name || fullName,
          email: prev.email || vi.email || '',
          phone: prev.phone || vi.phone || '',
          company: prev.company || vi.company || '',
        }));
      }

      updateActivity();
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m._id !== tempId && m._id !== 'welcome');
        const nextMsgs = mergeMessages([...withoutTemp, ...incoming]);
        updateHistoryWithConversation(conversationId, nextMsgs);
        return nextMsgs;
      });

      // Only prompt for details if not already captured in chat or form
      const botText = (result.botMessage?.content || '').toLowerCase();
      const botAskedForContact =
        botText.includes('contact information') ||
        botText.includes('share your details') ||
        botText.includes('email and phone') ||
        botText.includes('phone number as well') ||
        botText.includes('provide your phone') ||
        botText.includes('provide your email');

      const nextVisitorCount = visitorMessageCount + 1;
      const shouldPrompt =
        !isAlreadyCaptured &&
        !leadFormDismissed &&
        (config?.leadCaptureFields?.length || 0) > 0 &&
        (botAskedForContact || nextVisitorCount >= LEAD_FORM_AFTER_VISITOR_MESSAGES);

      if (shouldPrompt) {
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

  sendMessageRef.current = sendMessage;

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
    if (!conversationId) return;
    setLeadFormError(null);

    const fields = leadFields;
    for (const f of fields) {
      const val = (leadForm[f.field] || '').trim();
      if (f.required && !val) {
        setLeadFormError(`${f.label} is required`);
        return;
      }
      if (val && f.type === 'email' && !isValidEmail(val)) {
        setLeadFormError('Please enter a valid email address');
        return;
      }
    }

    setSubmittingLead(true);
    try {
      const res = await fetch(`${apiUrl}/widget/conversations/${conversationId}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: leadForm,
          visitorId,
          agentId,
          source: 'widget_form',
          ...getVisitorContext(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save details');
      }

      setLeadCaptured(true);
      setShowLeadForm(false);
      writeStored(`${storageKey(agentId)}_lead`, '1');
      updateActivity();
    } catch (err: any) {
      setLeadFormError(err.message || 'Failed to submit. Please try again.');
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
            <h3>{showHistory ? 'Chat History' : (config?.widgetConfig?.headerText || 'Chat with us')}</h3>
            <div class="widget-header-actions">
              {config?.widgetConfig?.whatsappEnabled && config?.widgetConfig?.whatsappNumber && (
                <button
                  class="widget-whatsapp-header-btn"
                  onClick={() => handleWhatsAppClick()}
                  title="Chat with us on WhatsApp"
                  aria-label="Chat on WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.001.572 1.73.818 2.806.818 3.18 0 5.767-2.587 5.767-5.766.001-3.182-2.585-5.769-5.767-5.769zm10.165 5.767c0 5.619-4.574 10.193-10.196 10.193-1.758 0-3.417-.459-4.88-1.261l-5.62 1.474 1.502-5.474c-.902-1.536-1.398-3.324-1.398-5.176 0-5.62 4.574-10.194 10.196-10.194 5.622 0 10.196 4.574 10.196 10.194z" />
                  </svg>
                </button>
              )}

              <button
                class={`widget-header-btn ${showVoiceSettings ? 'active' : ''}`}
                onClick={() => setShowVoiceSettings((prev) => !prev)}
                title="Customize AI Voice, Pitch & Speed"
                aria-label="Voice Settings"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              <button
                class={`widget-header-btn ${voiceMode ? 'active' : ''}`}
                onClick={() => {
                  const next = !voiceMode;
                  setVoiceMode(next);
                  writeStored('leadai_voice_mode', next ? '1' : '0');
                  if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    setSpeakingMessageId(null);
                  }
                }}
                title={voiceMode ? 'Voice Mode Active (Bot reads aloud) - Click to Mute' : 'Voice Mode Off - Click to enable Voice Readout'}
                aria-label="Toggle Voice Mode"
              >
                {voiceMode ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>

              <button
                class={`widget-header-btn ${showHistory ? 'active' : ''}`}
                onClick={() => {
                  setShowHistory((prev) => !prev);
                  updateActivity();
                }}
                title="Conversation History (10m auto-reset)"
                aria-label="Conversation History"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </button>
              <button class="widget-header-btn" onClick={() => setIsOpen(false)} aria-label="Close chat" title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Voice Settings Overlay Modal */}
          {showVoiceSettings && (
            <div class="widget-voice-overlay">
              <div class="widget-voice-card">
                <div class="widget-voice-header">
                  <h4>
                    <span>🎙️</span>
                    <span>AI Voice & Speech Settings</span>
                  </h4>
                  <button
                    class="widget-voice-close"
                    onClick={() => setShowVoiceSettings(false)}
                    aria-label="Close"
                  >
                    &times;
                  </button>
                </div>

                <div class="widget-voice-field">
                  <label>Choose Voice</label>
                  <select
                    class="widget-voice-select"
                    value={selectedVoiceURI}
                    onChange={(e: any) => {
                      const val = e.target.value;
                      setSelectedVoiceURI(val);
                      writeStored('leadai_voice_uri', val);
                    }}
                  >
                    <option value="">Default (Auto Natural Voice)</option>
                    {availableVoices.map((v) => (
                      <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div class="widget-voice-field">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <label style="margin: 0;">Speech Speed / Rate</label>
                    <span class="widget-voice-slider-val">{selectedVoiceRate.toFixed(1)}x</span>
                  </div>
                  <div class="widget-voice-slider-wrap">
                    <input
                      type="range"
                      min="0.7"
                      max="1.4"
                      step="0.1"
                      class="widget-voice-slider"
                      value={selectedVoiceRate}
                      onInput={(e: any) => {
                        const val = parseFloat(e.target.value);
                        setSelectedVoiceRate(val);
                        writeStored('leadai_voice_rate', String(val));
                      }}
                    />
                  </div>
                </div>

                <div class="widget-voice-field">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <label style="margin: 0;">Voice Pitch</label>
                    <span class="widget-voice-slider-val">{selectedVoicePitch.toFixed(1)}x</span>
                  </div>
                  <div class="widget-voice-slider-wrap">
                    <input
                      type="range"
                      min="0.7"
                      max="1.3"
                      step="0.1"
                      class="widget-voice-slider"
                      value={selectedVoicePitch}
                      onInput={(e: any) => {
                        const val = parseFloat(e.target.value);
                        setSelectedVoicePitch(val);
                        writeStored('leadai_voice_pitch', String(val));
                      }}
                    />
                  </div>
                </div>

                <div class="widget-voice-actions">
                  <button
                    class="widget-voice-preview-btn"
                    onClick={() => {
                      speakText(
                        'Hello! This is a preview of my voice. How do I sound?',
                        undefined,
                        selectedVoiceURI,
                        selectedVoiceRate,
                        selectedVoicePitch,
                      );
                    }}
                  >
                    <span>▶</span> Test Voice
                  </button>
                  <button
                    class="widget-voice-save-btn"
                    onClick={() => setShowVoiceSettings(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {showHistory ? (
            <div class="widget-history-view">
              <div class="widget-history-subhead">
                <span>Past Sessions</span>
                <button
                  class="widget-history-new-btn"
                  onClick={startNewChat}
                  title="Start a new chat"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Chat
                </button>
              </div>
              <div class="widget-history-tip">
                Conversations auto-reset after 10 minutes of inactivity. Click any conversation below to resume where you left off.
              </div>
              <div class="widget-history-list">
                {historyList.length === 0 ? (
                  <div class="widget-history-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p>No previous conversations</p>
                    <span>Your conversations will be saved here automatically before auto-resetting.</span>
                  </div>
                ) : (
                  historyList.map((item) => {
                    const isActive = item.id === conversationId;
                    return (
                      <div
                        key={item.id}
                        class={`widget-history-card ${isActive ? 'active' : ''}`}
                        onClick={() => resumeConversation(item.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <div class="widget-history-card-header">
                          <span class="widget-history-time">{formatRelativeTime(item.updatedAt)}</span>
                          {isActive && <span class="widget-history-badge">Active</span>}
                        </div>
                        <div class="widget-history-preview">{item.preview}</div>
                        <div class="widget-history-card-footer">
                          <span class="widget-history-count">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                            </svg>
                            {item.messageCount} {item.messageCount === 1 ? 'message' : 'messages'}
                          </span>
                          <span class="widget-history-resume-action">
                            {isActive ? 'Continue →' : 'Resume →'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <>
              {autoResetNotice && (
                <div class="widget-reset-notice">
                  <span>Chat reset after 10m inactivity. Previous chat saved to 🕒 history.</span>
                  <button onClick={() => setAutoResetNotice(false)} aria-label="Dismiss">&times;</button>
                </div>
              )}

              <div class="widget-messages">
                {starting && messages.length === 0 && (
                  <div class="typing-indicator">
                    <span /><span /><span />
                  </div>
                )}
                {messages.map((msg) => (
                  <div key={msg._id} class={`message ${msg.sender}`}>
                    {(msg.sender === 'bot' || msg.sender === 'agent') && msg.content ? (
                      <div class="msg-content-wrapper">
                        <div class="msg-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        <button
                          class={`msg-tts-btn ${speakingMessageId === msg._id ? 'speaking' : ''}`}
                          onClick={() => speakText(msg.content, msg._id)}
                          title={speakingMessageId === msg._id ? 'Stop voice' : 'Listen with AI voice'}
                          aria-label="Listen with AI voice"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                        </button>
                      </div>
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

                {config?.widgetConfig?.whatsappEnabled && config?.widgetConfig?.whatsappNumber && (
                  <div class="widget-whatsapp-chat-card">
                    <div>
                      <p>💬 Prefer chatting on WhatsApp?</p>
                      <span style="font-size: 10.5px; color: #15803d;">Connect with our representative directly</span>
                    </div>
                    <button
                      class="widget-whatsapp-btn"
                      style="padding: 5px 10px; font-size: 11px;"
                      onClick={() => handleWhatsAppClick()}
                    >
                      Open WhatsApp
                    </button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {showLeadForm && !leadCaptured && (
                <div class="lead-form">
                  <div class="lead-form-header">
                    <h4>Share your details</h4>
                    <button class="lead-form-close" onClick={dismissLeadForm} aria-label="Dismiss">&times;</button>
                  </div>
                  <p class="lead-form-desc">Help us get back to you with the best response.</p>
                  {leadFormError && <div class="lead-form-error">{leadFormError}</div>}
                  {leadFields.map((f) => (
                    <div key={f.field} class="lead-form-field">
                      <label>{f.label}{f.required && ' *'}</label>
                      <input
                        type={f.type === 'phone' ? 'tel' : f.type}
                        value={leadForm[f.field] || ''}
                        onInput={(e) => setLeadForm((prev) => ({ ...prev, [f.field]: (e.target as HTMLInputElement).value }))}
                        placeholder={`Enter your ${f.label.toLowerCase()}`}
                        required={f.required}
                      />
                    </div>
                  ))}
                  <div class="lead-form-actions">
                    <button class="lead-form-submit" onClick={submitLeadForm} disabled={submittingLead}>
                      {submittingLead ? 'Saving...' : 'Submit'}
                    </button>
                    <button class="lead-form-skip" onClick={dismissLeadForm}>Skip for now</button>
                  </div>
                </div>
              )}

              {leadCaptured && (
                <div class="lead-captured-banner">
                  <span>✓ Details saved. We'll be in touch!</span>
                </div>
              )}

              <div class="widget-input-area">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    isListening
                      ? 'Listening... Speak clearly...'
                      : (config?.widgetConfig?.placeholder || 'Type a message...')
                  }
                  value={input}
                  onInput={(e) => setInput((e.target as HTMLInputElement).value)}
                  onKeyDown={handleKeyDown}
                  disabled={inputDisabled}
                  aria-label="Message input"
                />

                <button
                  class={`widget-voice-btn ${isListening ? 'listening' : ''}`}
                  onClick={toggleListening}
                  disabled={inputDisabled}
                  title={isListening ? 'Stop listening' : 'Talk with Voice (Speech-to-Text)'}
                  aria-label={isListening ? 'Stop listening' : 'Voice Input'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>

                <button
                  class="widget-send-btn"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || inputDisabled || loading}
                  aria-label="Send message"
                  style={{ background: primaryColor }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>

              <div class="powered-by">
                Powered by <a href="#" onClick={(e) => e.preventDefault()}>LeadAI</a>
              </div>
            </>
          )}
        </div>
      )}

      {showExitIntent && !isOpen && (
        <div class="widget-exit-intent-card">
          <button
            class="widget-exit-close"
            onClick={() => {
              setShowExitIntent(false);
              try { sessionStorage.setItem('leadai_exit_intent_dismissed', '1'); } catch {}
            }}
            aria-label="Close"
          >
            &times;
          </button>
          <div class="widget-exit-badge">⚡ INSTANT ASSISTANCE</div>
          <h4 class="widget-exit-title">Wait! Before you leave...</h4>
          <p class="widget-exit-body">
            {config?.widgetConfig?.exitIntentMessage ||
              'Get an instant AI quote, answers to your questions, or custom pricing in under 15 seconds.'}
          </p>
          <div class="widget-exit-actions">
            <button
              class="widget-exit-primary-btn"
              onClick={() => handleOpenFromNudgeOrExit('Hi! Before I leave, could you give me quick pricing and service options?')}
            >
              💬 Talk to AI Assistant Now
            </button>
            {config?.widgetConfig?.whatsappEnabled && config?.widgetConfig?.whatsappNumber && (
              <button
                class="widget-whatsapp-btn"
                style="width: 100%; border-radius: 9px; padding: 9px 14px;"
                onClick={() => {
                  setShowExitIntent(false);
                  handleWhatsAppClick('Hi! I was checking your website before leaving and wanted to ask a quick question.');
                }}
              >
                📱 Chat on WhatsApp Instead
              </button>
            )}
            <button
              class="widget-exit-secondary-btn"
              onClick={() => {
                setShowExitIntent(false);
                try { sessionStorage.setItem('leadai_exit_intent_dismissed', '1'); } catch {}
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {showNudge && !showExitIntent && !isOpen && (
        <div class="widget-nudge-bubble">
          <button
            class="widget-nudge-close"
            onClick={() => {
              setShowNudge(false);
              try { sessionStorage.setItem('leadai_nudge_dismissed', '1'); } catch {}
            }}
            aria-label="Dismiss"
          >
            &times;
          </button>
          <div class="widget-nudge-header">
            <span class="widget-nudge-dot" />
            <span class="widget-nudge-title">AI Assistant Online</span>
          </div>
          <p class="widget-nudge-text">
            {config?.widgetConfig?.proactiveMessage ||
              '👋 Hi there! Have any questions or need a personalized quote? I\'m here to help!'}
          </p>
          <div class="widget-nudge-actions">
            <button
              class="widget-nudge-cta"
              onClick={() => handleOpenFromNudgeOrExit()}
            >
              Chat with AI →
            </button>
            {config?.widgetConfig?.whatsappEnabled && config?.widgetConfig?.whatsappNumber && (
              <button
                class="widget-nudge-wa"
                onClick={() => {
                  setShowNudge(false);
                  handleWhatsAppClick('Hi! I saw your chat prompt on the website and wanted to connect on WhatsApp.');
                }}
                title="Chat on WhatsApp"
              >
                📱 WhatsApp
              </button>
            )}
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
