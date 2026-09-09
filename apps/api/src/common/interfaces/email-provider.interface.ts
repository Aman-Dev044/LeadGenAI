export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
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
