/**
 * Turns numbers, prices, dates and phone numbers into words the TTS engine
 * reads the way a person says them.
 *
 * Without this "₹25,000" comes out as "two five zero zero zero" and
 * "+91 98765 43210" as one long number. Applied to everything the assistant
 * is given to say before the call (context, first message) - the model is
 * also told to speak numbers in words for anything it produces live.
 */

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return below100(r);
  return r ? `${ONES[h]} hundred ${below100(r)}` : `${ONES[h]} hundred`;
}

/**
 * Indian system: lakh / crore, which is how prices are said on a call in
 * India. "25000" -> "twenty five thousand", "150000" -> "one lakh fifty thousand".
 */
export function numberToWords(n: number, style: 'indian' | 'western' = 'indian'): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `minus ${numberToWords(-n, style)}`;
  if (n === 0) return 'zero';
  const int = Math.floor(n);
  const frac = Math.round((n - int) * 100);
  let words: string;

  if (style === 'indian') {
    const parts: string[] = [];
    const crore = Math.floor(int / 10_000_000);
    const lakh = Math.floor((int % 10_000_000) / 100_000);
    const thousand = Math.floor((int % 100_000) / 1000);
    const rest = int % 1000;
    if (crore) parts.push(`${numberToWords(crore, 'indian')} crore`);
    if (lakh) parts.push(`${below100(lakh)} lakh`);
    if (thousand) parts.push(`${below100(thousand)} thousand`);
    if (rest) parts.push(below1000(rest));
    words = parts.join(' ');
  } else {
    const parts: string[] = [];
    const billion = Math.floor(int / 1_000_000_000);
    const million = Math.floor((int % 1_000_000_000) / 1_000_000);
    const thousand = Math.floor((int % 1_000_000) / 1000);
    const rest = int % 1000;
    if (billion) parts.push(`${below1000(billion)} billion`);
    if (million) parts.push(`${below1000(million)} million`);
    if (thousand) parts.push(`${below1000(thousand)} thousand`);
    if (rest) parts.push(below1000(rest));
    words = parts.join(' ');
  }

  if (frac) words += ` point ${String(frac).padStart(2, '0').split('').map((d) => ONES[Number(d)] || 'zero').join(' ')}`;
  return words;
}

/** "9876543210" -> "nine eight seven six, five four three two one zero" - digit by digit, in groups a listener can hold. */
export function phoneToWords(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  const spoken = digits.split('').map((d) => (d === '0' ? 'zero' : ONES[Number(d)]));
  const groups: string[] = [];
  // country code first when present, then pairs/triples
  let i = 0;
  if (digits.length > 10) {
    const cc = digits.length - 10;
    groups.push(`plus ${spoken.slice(0, cc).join(' ')}`);
    i = cc;
  }
  while (i < spoken.length) {
    const take = spoken.length - i > 5 ? 5 : spoken.length - i;
    groups.push(spoken.slice(i, i + take).join(' '));
    i += take;
  }
  return groups.join(', ');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORDINAL: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 21: 'twenty first', 22: 'twenty second', 23: 'twenty third', 31: 'thirty first' };
const ordinal = (d: number) => ORDINAL[d] || `${below100(d)}th`;

/** A Date as a person says it: "Thursday, the second of October at eleven a m". */
export function dateToWords(date: Date, timeZone = 'Asia/Kolkata', withTime = true): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', day: 'numeric', month: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true,
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  const day = ordinal(Number(p.day));
  const month = MONTHS[Number(p.month) - 1];
  let out = `${p.weekday}, the ${day} of ${month}`;
  if (withTime) {
    const h = Number(p.hour);
    const m = Number(p.minute);
    const ampm = (p.dayPeriod || '').toLowerCase().replace('.', '') === 'pm' ? 'p m' : 'a m';
    out += ` at ${below100(h)}${m ? ` ${m < 10 ? 'oh ' : ''}${below100(m)}` : ''} ${ampm}`;
  }
  return out;
}

/** "11:30" / "11:30 AM" -> "eleven thirty a m" */
function clockToWords(h: number, m: number, ampm?: string): string {
  let hour = h;
  let suffix = ampm ? ampm.toLowerCase().replace(/\./g, '') : '';
  if (!suffix) {
    if (h === 0) { hour = 12; suffix = 'am'; }
    else if (h >= 13) { hour = h - 12; suffix = 'pm'; }
    else if (h === 12) suffix = 'pm';
  }
  return `${below100(hour)}${m ? ` ${m < 10 ? 'oh ' : ''}${below100(m)}` : ''}${suffix ? ` ${suffix === 'pm' ? 'p m' : 'a m'}` : ''}`;
}

/**
 * Rewrites every number-ish token in free text into words. Order matters:
 * phone numbers first (so they are not read as prices), then money, then
 * times, then plain numbers.
 */
export function speakable(text: string): string {
  if (!text) return text;
  let t = text;

  // Phone numbers: +91 98765 43210, 098765-43210, (+1) 217-568-1409
  t = t.replace(/(?:\+?\d[\d\s\-()]{8,}\d)/g, (m) => {
    const digits = m.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15 ? phoneToWords(m) : m;
  });

  // Money: ₹25,000 / Rs. 25000 / 25k / 1.5 lakh / $2,000
  t = t.replace(/(₹|rs\.?|inr|\$|usd)\s?([\d,]+(?:\.\d+)?)(?:\s?(k|lakh|lac|crore|cr)\b)?/gi, (_, cur, num, unit) => {
    let n = Number(num.replace(/,/g, ''));
    if (!Number.isFinite(n)) return _;
    const u = (unit || '').toLowerCase();
    if (u === 'k') n *= 1000;
    else if (u === 'lakh' || u === 'lac') n *= 100_000;
    else if (u === 'crore' || u === 'cr') n *= 10_000_000;
    const c = cur.toLowerCase();
    const name = c === '$' || c === 'usd' ? 'dollars' : 'rupees';
    return `${numberToWords(n, name === 'dollars' ? 'western' : 'indian')} ${name}`;
  });
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?(k|lakh|lac|crore|cr)\b/gi, (_, num, unit) => {
    let n = Number(num);
    const u = unit.toLowerCase();
    if (u === 'k') n *= 1000;
    else if (u === 'lakh' || u === 'lac') n *= 100_000;
    else n *= 10_000_000;
    return numberToWords(n);
  });

  // Times: 11:30 AM, 4 pm, 16:00
  t = t.replace(/\b(\d{1,2}):(\d{2})\s?(am|pm|a\.m\.|p\.m\.)?\b/gi, (_, h, m, ap) => clockToWords(Number(h), Number(m), ap));
  t = t.replace(/\b(\d{1,2})\s?(am|pm|a\.m\.|p\.m\.)\b/gi, (_, h, ap) => clockToWords(Number(h), 0, ap));

  // Percentages and plain numbers (with thousands separators)
  t = t.replace(/\b(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?%/g, (_, i, f) => `${numberToWords(Number(`${i.replace(/,/g, '')}${f || ''}`))} percent`);
  t = t.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/g, (m) => {
    const n = Number(m.replace(/,/g, ''));
    if (!Number.isFinite(n)) return m;
    // Years read as numbers are fine ("two thousand twenty six"); 4-digit years stay natural
    return numberToWords(n);
  });

  return t;
}
