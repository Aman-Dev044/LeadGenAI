import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  keyId: string;
}

/**
 * Razorpay, the way Indian businesses expect to pay: an order is created on the
 * server, the customer pays in the browser, and the signature that comes back
 * is verified here before anything is unlocked.
 *
 * Keys are the platform's (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) - this is the
 * platform charging its workspaces, not a workspace charging its customers.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  constructor(private readonly configService: ConfigService) {}

  private keyId(): string {
    return this.configService.get<string>('razorpay.keyId') || process.env.RAZORPAY_KEY_ID || '';
  }

  private keySecret(): string {
    return this.configService.get<string>('razorpay.keySecret') || process.env.RAZORPAY_KEY_SECRET || '';
  }

  isConfigured(): boolean {
    return !!(this.keyId() && this.keySecret());
  }

  /** Amount in rupees -> a Razorpay order (their API works in paise). */
  async createOrder(amountInRupees: number, receipt: string, notes: Record<string, string>): Promise<RazorpayOrder> {
    const keyId = this.keyId();
    const keySecret = this.keySecret();
    if (!keyId || !keySecret) throw new Error('Razorpay is not configured');

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amountInRupees * 100),
        currency: 'INR',
        receipt: receipt.slice(0, 40),
        notes,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json.id) {
      const msg = json?.error?.description || `HTTP ${res.status}`;
      this.logger.error(`Razorpay order failed: ${msg}`);
      throw new Error(`Could not start the payment: ${msg}`);
    }
    return { id: json.id, amount: json.amount, currency: json.currency, keyId };
  }

  /** The signature Razorpay returns after a successful payment. */
  verifyPayment(orderId: string, paymentId: string, signature: string): boolean {
    const secret = this.keySecret();
    if (!secret || !orderId || !paymentId || !signature) return false;
    const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Webhook signature (Razorpay signs the raw body with the webhook secret). */
  verifyWebhook(rawBody: string, signature: string): boolean {
    const secret = this.configService.get<string>('razorpay.webhookSecret') || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
