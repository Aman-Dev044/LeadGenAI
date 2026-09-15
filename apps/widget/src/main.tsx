import { render } from 'preact';
import { Widget } from './components/Widget';

(function () {
  const scriptTag = document.currentScript as HTMLScriptElement;
  if (!scriptTag) return;

  const agentId = scriptTag.getAttribute('data-agent-id');
  const apiUrl = scriptTag.getAttribute('data-api-url') || 'http://localhost:4000/api/v1';
  const position = (scriptTag.getAttribute('data-position') || 'bottom-right') as 'bottom-right' | 'bottom-left';

  if (!agentId) {
    console.error('LeadAI Widget: data-agent-id is required');
    return;
  }

  // Create container
  const container = document.createElement('div');
  container.id = 'leadai-widget-root';
  document.body.appendChild(container);

  // Create shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = getStyles();
  shadow.appendChild(styleEl);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'leadai-mount';
  shadow.appendChild(mountPoint);

  render(
    <Widget agentId={agentId} apiUrl={apiUrl} position={position} />,
    mountPoint,
  );

  // Page view tracker
  trackPageView(apiUrl, agentId);
})();

function trackPageView(apiUrl: string, agentId: string) {
  const visitorId = getOrCreateVisitorId();
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ['source', 'medium', 'campaign', 'term', 'content']) {
    const value = params.get('utm_' + key);
    if (value) utm[key] = value;
  }
  const payload = JSON.stringify({
    agentId,
    visitorId,
    url: window.location.href,
    title: document.title,
    referrer: document.referrer,
    ...(Object.keys(utm).length ? { utm } : {}),
  });
  // keepalive lets the beacon finish even if the visitor navigates away immediately
  fetch(`${apiUrl}/widget/pageview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem('leadai_visitor_id');
    if (!id) {
      id = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('leadai_visitor_id', id);
    }
    return id;
  } catch {
    return 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

function getStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .widget-container {
      position: fixed;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }

    .widget-container.bottom-right {
      bottom: 20px;
      right: 20px;
    }

    .widget-container.bottom-left {
      bottom: 20px;
      left: 20px;
    }

    .widget-bubble {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary, #3b82f6);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .widget-bubble:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    }

    .widget-bubble svg {
      width: 24px;
      height: 24px;
    }

    .widget-panel {
      position: absolute;
      bottom: 70px;
      width: 380px;
      height: 520px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.3s ease;
    }

    .widget-container.bottom-right .widget-panel {
      right: 0;
    }

    .widget-container.bottom-left .widget-panel {
      left: 0;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .widget-header {
      padding: 16px;
      color: white;
      background: var(--primary, #3b82f6);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .widget-header h3 {
      font-size: 16px;
      font-weight: 600;
    }

    .widget-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .widget-header-btn {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      opacity: 0.85;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.15s, background 0.15s;
    }

    .widget-header-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.18);
    }

    .widget-header-btn.active {
      opacity: 1;
      background: rgba(255, 255, 255, 0.28);
    }

    .widget-header-btn svg {
      width: 18px;
      height: 18px;
    }

    .widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .message.bot,
    .message.agent {
      align-self: flex-start;
      background: #f1f5f9;
      color: #1e293b;
      border-bottom-left-radius: 4px;
    }

    .message.agent {
      border-left: 3px solid var(--primary, #3b82f6);
    }

    .message.visitor {
      align-self: flex-end;
      background: var(--primary, #3b82f6);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message.system {
      align-self: center;
      background: transparent;
      color: #94a3b8;
      font-size: 12px;
      text-align: center;
    }

    .typing-indicator {
      align-self: flex-start;
      padding: 10px 14px;
      background: #f1f5f9;
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      display: flex;
      gap: 4px;
    }

    .typing-indicator span {
      width: 6px;
      height: 6px;
      background: #94a3b8;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out;
    }

    .typing-indicator span:nth-child(1) { animation-delay: 0s; }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    .widget-input,
    .widget-input-area {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      gap: 8px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      box-sizing: border-box;
      width: 100%;
    }

    .widget-input input,
    .widget-input-area input {
      flex: 1;
      min-width: 0;
      height: 40px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 0 16px;
      font-size: 13.5px;
      font-family: inherit;
      color: #1e293b;
      background: #f8fafc;
      outline: none;
      box-sizing: border-box;
      transition: all 0.2s ease;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
    }

    .widget-input input:focus,
    .widget-input-area input:focus {
      background: #ffffff;
      border-color: var(--primary, #3b82f6);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .widget-input input:disabled,
    .widget-input-area input:disabled {
      background: #f1f5f9;
      color: #94a3b8;
      cursor: not-allowed;
    }

    .widget-input input::placeholder,
    .widget-input-area input::placeholder {
      color: #94a3b8;
    }

    .widget-voice-btn {
      width: 36px;
      height: 36px;
      min-width: 36px;
      flex-shrink: 0;
      border-radius: 50%;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #64748b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 0.18s ease;
      box-sizing: border-box;
    }

    .widget-voice-btn:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #cbd5e1;
      transform: scale(1.05);
    }

    .widget-voice-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .widget-voice-btn svg {
      width: 17px;
      height: 17px;
    }

    .widget-voice-btn.listening {
      background: #ef4444 !important;
      border-color: #dc2626 !important;
      color: #ffffff !important;
      animation: pulse-red 1.2s infinite;
    }

    .widget-send-btn,
    .widget-input button {
      width: 36px;
      height: 36px;
      min-width: 36px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--primary, #3b82f6);
      color: white;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 0.18s ease;
      box-sizing: border-box;
    }

    .widget-send-btn:hover:not(:disabled),
    .widget-input button:hover:not(:disabled) {
      opacity: 0.92;
      transform: scale(1.05);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
    }

    .widget-send-btn:disabled,
    .widget-input button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .widget-send-btn svg,
    .widget-input button svg {
      width: 16px;
      height: 16px;
    }

    .lead-form {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .lead-form h4 {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }

    .lead-form input {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 14px;
      outline: none;
    }

    .lead-form input:focus {
      border-color: var(--primary, #3b82f6);
    }

    .lead-form button {
      width: 100%;
      padding: 8px;
      border-radius: 8px;
      background: var(--primary, #3b82f6);
      color: white;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .lead-form button:hover {
      opacity: 0.9;
    }

    .lead-form button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .lead-form .lead-form-skip {
      background: transparent;
      color: #64748b;
      font-weight: 400;
      padding: 4px;
    }

    .lead-form-error {
      color: #dc2626;
      font-size: 12px;
    }

    .message.system a {
      color: var(--primary, #3b82f6);
      text-decoration: underline;
    }

    .widget-reset-notice {
      background: #eff6ff;
      border-bottom: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 8px 12px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      line-height: 1.35;
      animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .widget-reset-notice span {
      flex: 1;
    }

    .widget-reset-notice button {
      background: none;
      border: none;
      color: #1e40af;
      font-size: 16px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      opacity: 0.7;
    }

    .widget-reset-notice button:hover {
      opacity: 1;
    }

    .widget-history-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #f8fafc;
    }

    .widget-history-subhead {
      padding: 12px 16px 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      background: white;
    }

    .widget-history-subhead span {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }

    .widget-history-new-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--primary, #3b82f6);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .widget-history-new-btn:hover {
      opacity: 0.9;
    }

    .widget-history-new-btn svg {
      width: 13px;
      height: 13px;
    }

    .widget-history-tip {
      font-size: 11px;
      color: #64748b;
      padding: 8px 16px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      line-height: 1.4;
    }

    .widget-history-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .widget-history-empty {
      padding: 50px 20px;
      text-align: center;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .widget-history-empty svg {
      width: 36px;
      height: 36px;
      opacity: 0.5;
    }

    .widget-history-empty p {
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }

    .widget-history-empty span {
      font-size: 11px;
      color: #94a3b8;
    }

    .widget-history-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }

    .widget-history-card:hover {
      border-color: var(--primary, #3b82f6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    .widget-history-card.active {
      border-color: var(--primary, #3b82f6);
      background: #f0f7ff;
    }

    .widget-history-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .widget-history-time {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .widget-history-badge {
      background: var(--primary, #3b82f6);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .widget-history-preview {
      font-size: 13px;
      color: #1e293b;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }

    .widget-history-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
      padding-top: 6px;
      border-top: 1px solid #f1f5f9;
    }

    .widget-history-count {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #94a3b8;
    }

    .widget-history-count svg {
      width: 12px;
      height: 12px;
    }

    .widget-history-resume-action {
      font-size: 11px;
      font-weight: 600;
      color: var(--primary, #3b82f6);
    }

    /* Mobile: full-screen panel */
    @media (max-width: 480px) {
      .widget-container.bottom-right .widget-panel,
      .widget-container.bottom-left .widget-panel {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
        bottom: 0;
        right: 0;
        left: 0;
      }
      .widget-container .widget-bubble {
        position: fixed;
        bottom: 20px;
        right: 20px;
      }
    }

    /* Markdown content styles */
    .msg-content {
      line-height: 1.5;
    }

    .msg-content p {
      margin: 0 0 8px 0;
    }

    .msg-content p:last-child {
      margin-bottom: 0;
    }

    .msg-content h2 {
      font-size: 16px;
      font-weight: 700;
      margin: 10px 0 6px 0;
    }

    .msg-content h3 {
      font-size: 15px;
      font-weight: 600;
      margin: 8px 0 4px 0;
    }

    .msg-content h4 {
      font-size: 14px;
      font-weight: 600;
      margin: 6px 0 4px 0;
    }

    .msg-content h2:first-child,
    .msg-content h3:first-child,
    .msg-content h4:first-child {
      margin-top: 0;
    }

    .msg-content strong {
      font-weight: 600;
    }

    .msg-content em {
      font-style: italic;
    }

    .msg-content ul, .msg-content ol {
      margin: 6px 0;
      padding-left: 20px;
    }

    .msg-content li {
      margin: 2px 0;
    }

    .msg-content ul li {
      list-style-type: disc;
    }

    .msg-content ol li {
      list-style-type: decimal;
    }

    .msg-content code {
      background: rgba(0,0,0,0.06);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 12px;
    }

    .msg-content pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 10px 12px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;
      font-size: 12px;
    }

    .msg-content pre code {
      background: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }

    .msg-content br {
      display: block;
      content: '';
      margin-top: 2px;
    }

    .powered-by {
      text-align: center;
      padding: 6px;
      font-size: 11px;
      color: #94a3b8;
      background: #fafafa;
    }

    .powered-by a {
      color: #64748b;
      text-decoration: none;
    }

    /* ─── Voice Mode & TTS Controls ─── */
    .widget-header-btn.active {
      background: rgba(255, 255, 255, 0.35);
      border-color: rgba(255, 255, 255, 0.6);
      color: #ffffff;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
    }

    .msg-content-wrapper {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      position: relative;
    }

    .msg-content-wrapper .msg-content {
      flex: 1;
    }

    .msg-tts-btn {
      flex-shrink: 0;
      background: rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #64748b;
      margin-top: 2px;
      transition: all 0.15s ease;
    }

    .msg-tts-btn:hover {
      background: rgba(59, 130, 246, 0.12);
      border-color: #3b82f6;
      color: #2563eb;
    }

    .msg-tts-btn.speaking {
      background: #3b82f6;
      border-color: #2563eb;
      color: #ffffff;
      animation: pulse-ring 1s infinite;
    }

    .msg-tts-btn svg {
      width: 13px;
      height: 13px;
    }

    .widget-listening-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      border-top: 1px solid #fecaca;
      border-bottom: 1px solid #fecaca;
      padding: 6px 14px;
      font-size: 12px;
      color: #b91c1c;
      font-weight: 500;
      animation: fadeIn 0.2s ease;
    }

    .widget-voice-pulse {
      width: 8px;
      height: 8px;
      background: #ef4444;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
      animation: pulse-red 1.2s infinite;
    }

    @keyframes pulse-red {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 7px rgba(239, 68, 68, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
      }
    }

    .widget-mic-btn {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #64748b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }

    .widget-mic-btn:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
      border-color: #cbd5e1;
    }

    .widget-mic-btn.listening {
      background: #ef4444;
      border-color: #dc2626;
      color: #ffffff;
      animation: pulse-red 1.2s infinite;
    }

    .widget-mic-btn svg {
      width: 17px;
      height: 17px;
    }

    /* ─── Proactive Screen-Aware Nudge Bubble ─── */
    .widget-nudge-bubble {
      position: absolute;
      bottom: 74px;
      right: 0;
      width: 290px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 14px 34px -4px rgba(15, 23, 42, 0.15), 0 4px 10px -2px rgba(15, 23, 42, 0.05);
      padding: 14px 16px;
      z-index: 999998;
      animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .widget-container.bottom-left .widget-nudge-bubble {
      right: auto;
      left: 0;
    }

    .widget-nudge-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .widget-nudge-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 0 6px #10b981;
    }

    .widget-nudge-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #059669;
    }

    .widget-nudge-close {
      position: absolute;
      top: 10px;
      right: 12px;
      background: none;
      border: none;
      font-size: 18px;
      line-height: 1;
      color: #94a3b8;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
    }

    .widget-nudge-close:hover {
      color: #334155;
      background: #f1f5f9;
    }

    .widget-nudge-text {
      font-size: 13px;
      line-height: 1.45;
      color: #334155;
      margin-bottom: 10px;
    }

    .widget-nudge-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      background: #0f172a;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.1s ease;
    }

    .widget-nudge-action:hover {
      background: #1e293b;
      transform: translateY(-1px);
    }

    /* ─── Exit-Intent Interceptor Modal/Card ─── */
    .widget-exit-intent-card {
      position: absolute;
      bottom: 74px;
      right: 0;
      width: 320px;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 18px;
      box-shadow: 0 20px 40px -6px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1);
      padding: 18px 20px;
      color: #ffffff;
      z-index: 999999;
      animation: popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .widget-container.bottom-left .widget-exit-intent-card {
      right: auto;
      left: 0;
    }

    .widget-exit-close {
      position: absolute;
      top: 12px;
      right: 14px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #94a3b8;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .widget-exit-close:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    .widget-exit-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 3px 8px;
      border-radius: 999px;
      margin-bottom: 8px;
    }

    .widget-exit-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.35;
      margin-bottom: 6px;
    }

    .widget-exit-body {
      font-size: 12.5px;
      color: #cbd5e1;
      line-height: 1.45;
      margin-bottom: 14px;
    }

    .widget-exit-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .widget-exit-primary-btn {
      width: 100%;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: #ffffff;
      border: none;
      border-radius: 9px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s ease, transform 0.1s ease;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }

    .widget-exit-primary-btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }

    .widget-exit-secondary-btn {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 11.5px;
      cursor: pointer;
      padding: 4px;
      text-decoration: underline;
      text-align: center;
    }

    .widget-exit-secondary-btn:hover {
      color: #cbd5e1;
    }

    /* ─── WhatsApp Integration Styles ─── */
    .widget-whatsapp-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #25D366;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s ease, transform 0.1s ease;
      box-shadow: 0 3px 10px rgba(37, 211, 102, 0.3);
    }
    .widget-whatsapp-btn:hover {
      background: #20bd5a;
      transform: translateY(-1px);
    }
    .widget-whatsapp-header-btn {
      background: rgba(37, 211, 102, 0.15);
      color: #25D366;
      border: 1px solid rgba(37, 211, 102, 0.3);
      border-radius: 8px;
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .widget-whatsapp-header-btn:hover {
      background: #25D366;
      color: #ffffff;
      transform: scale(1.06);
    }
    .widget-whatsapp-chat-card {
      background: #f0fdf4;
      border: 1px dashed #86efac;
      border-radius: 12px;
      padding: 10px 14px;
      margin: 8px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .widget-whatsapp-chat-card p {
      margin: 0;
      font-size: 11.5px;
      color: #166534;
      font-weight: 500;
    }

    /* ─── Voice Engine & Voice Settings Modal ─── */
    .widget-voice-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.2s ease;
    }
    .widget-voice-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
      width: 100%;
      max-width: 330px;
      padding: 18px 20px;
      color: #1e293b;
      position: relative;
    }
    .widget-voice-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .widget-voice-header h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .widget-voice-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #64748b;
      line-height: 1;
    }
    .widget-voice-close:hover {
      color: #0f172a;
    }
    .widget-voice-field {
      margin-bottom: 12px;
    }
    .widget-voice-field label {
      display: block;
      font-size: 11.5px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 5px;
    }
    .widget-voice-select {
      width: 100%;
      padding: 7px 10px;
      font-size: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
      color: #1e293b;
      outline: none;
    }
    .widget-voice-select:focus {
      border-color: #3b82f6;
      background: #ffffff;
    }
    .widget-voice-slider-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .widget-voice-slider {
      flex: 1;
      accent-color: #3b82f6;
    }
    .widget-voice-slider-val {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      width: 32px;
      text-align: right;
      font-family: monospace;
    }
    .widget-voice-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 16px;
      gap: 8px;
    }
    .widget-voice-preview-btn {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
    }
    .widget-voice-preview-btn:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .widget-voice-save-btn {
      background: #3b82f6;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 7px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .widget-voice-save-btn:hover {
      background: #2563eb;
    }

    @keyframes popIn {
      0% {
        opacity: 0;
        transform: translateY(14px) scale(0.96);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;
}
