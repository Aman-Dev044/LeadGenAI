export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  /**
   * Which workspace this e-mail belongs to. When that workspace saved its own
   * SMTP server, the message is sent from their address instead of the
   * platform's - so always pass it for anything a customer receives.
   */
  tenantId?: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailResult {
  messageId: string;
  success: boolean;
}

export interface IEmailProvider {
  sendEmail(options: EmailOptions): Promise<EmailResult>;
}
