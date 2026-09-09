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

    .widget-header button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      opacity: 0.8;
    }

    .widget-header button:hover { opacity: 1; }

    .widget-header button svg {
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

    .widget-input {
      display: flex;
      padding: 12px;
      gap: 8px;
      border-top: 1px solid #e2e8f0;
      background: white;
    }

    .widget-input input {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      padding: 8px 16px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .widget-input input:focus {
      border-color: var(--primary, #3b82f6);
    }

    .widget-input button {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--primary, #3b82f6);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }

    .widget-input button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

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
  `;
}
