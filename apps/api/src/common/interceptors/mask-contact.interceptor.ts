import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Roles that may read records but must never see how to contact a lead.
 * VIEWER is the workspace's "view only" member: leads, pipeline and
 * appointments are visible, e-mail addresses and phone numbers are not.
 */
const MASKED_ROLES = new Set(['VIEWER']);

export const HIDDEN = 'Hidden';

/** Keys whose value IS a contact detail (compared without case or punctuation). */
const CONTACT_KEYS = new Set([
  'email',
  'emailaddress',
  'secondaryemail',
  'contactemail',
  'organizeremail',
  'attendeeemail',
  'phone',
  'phonenumber',
  'contactnumber',
  'contactphone',
  'mobile',
  'mobilenumber',
  'altphone',
  'alternatephone',
  'secondaryphone',
  'whatsapp',
  'whatsappnumber',
  'tonumber',
  'fromnumber',
  'callerid',
  'recipient',
  'visitorid',
  'waid',
  'salespersonphone',
]);

/**
 * Keys whose value is an identifier, link or token - never redacted, because a
 * long digit run inside them is not a phone number and mangling it would break
 * navigation, recordings and webhooks.
 */
const VERBATIM_KEY = /(id|ids|key|token|secret|url|uri|link|href|slug|hash|sid|path|version|type|status|provider|model|timezone|currency|code)$/;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?<!\d)(\+?\d[\d\s().-]{7,}\d)(?!\d)/g;
/** Dates and times also look like long digit runs - never redact those. */
const DATE_LIKE = /\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}:\d{2}/;

const normalise = (key: string) => key.toLowerCase().replace(/[^a-z]/g, '');

function redactText(value: string): string {
  return value.replace(EMAIL_RE, HIDDEN).replace(PHONE_RE, (match) => {
    if (DATE_LIKE.test(match)) return match;
    const digits = (match.match(/\d/g) || []).length;
    return digits >= 10 && digits <= 15 ? HIDDEN : match;
  });
}

function maskValue(value: any): any {
  if (value === null || value === undefined || value === '') return value;
  if (Array.isArray(value)) return value.map(maskValue);
  return HIDDEN;
}

/** Whether a free-text string under this key may be scanned for contact details. */
function scannable(key: string, value: string): boolean {
  if (!value || value.length < 6) return false;
  if (VERBATIM_KEY.test(normalise(key))) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (/^[A-Fa-f0-9]{24}$/.test(value)) return false; // Mongo id
  if (/^[A-Za-z0-9_-]{22,}$/.test(value)) return false; // opaque token / external id
  return true;
}

/**
 * Walks a value, carrying the key it sits under so strings inside arrays
 * (`keyPoints`, `objections`, ...) are scanned too.
 */
function maskNode(value: any, key: string, selfId: string, depth: number): any {
  if (value === null || value === undefined || depth > 12) return value;
  if (Array.isArray(value)) return value.map((v) => maskNode(v, key, selfId, depth + 1));
  if (typeof value === 'string') return scannable(key, value) ? redactText(value) : value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  return maskObject(value, selfId, depth + 1);
}

function maskObject(input: any, selfId: string, depth: number): any {
  // Mongoose documents and lean results alike
  const plain: Record<string, any> = typeof input.toObject === 'function' ? input.toObject() : { ...input };

  // The signed-in user's own record keeps its contact details (they need their profile)
  const isSelf = !!selfId && String(plain._id || '') === selfId;

  for (const [key, value] of Object.entries(plain)) {
    if (!isSelf && CONTACT_KEYS.has(normalise(key))) {
      plain[key] = maskValue(value);
      continue;
    }
    plain[key] = maskNode(value, key, selfId, depth);
  }
  return plain;
}

function maskDeep(input: any, selfId: string): any {
  return maskNode(input, 'root', selfId, 0);
}

/**
 * Strips e-mail addresses and phone numbers out of every response for roles
 * that must not see them. Runs on the finished payload, so it covers lead
 * lists, lead detail, the pipeline, appointments, activities and anything
 * added later - a new endpoint cannot forget to mask.
 */
@Injectable()
export class MaskContactInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const role = request?.user?.role;
    if (!role || !MASKED_ROLES.has(role)) return next.handle();

    // Sign-in and profile routes must still return the person's own details
    const path: string = request?.route?.path || request?.url || '';
    if (/\/auth\//.test(path)) return next.handle();

    const selfId = String(request.user.userId || request.user.sub || request.user._id || '');
    return next.handle().pipe(map((data) => maskDeep(data, selfId)));
  }
}
