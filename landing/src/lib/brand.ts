/**
 * Single source of truth for everything brand-facing: the product name, the
 * taglines and the company behind it.
 *
 * Every surface (landing page, auth screens, dashboard sidebar, privacy page,
 * page metadata) reads from here, so changing a tagline is a one-line edit
 * instead of a grep-and-pray across the app.
 */

export const BRAND = {
  /** Product name, always rendered as one word. */
  name: 'LeadBells',

  /** Primary tagline. Short enough to sit next to the logo anywhere. */
  tagline: 'AI Leads Follow up, tracking & calling software',

  /** Compact variant for tight spots (collapsed sidebar, chips, badges). */
  taglineShort: 'AI follow-up & calling',

  /** One-sentence positioning used under headlines and in meta descriptions. */
  taglineLong:
    'Add a lead and the AI takes over — it calls, follows up on WhatsApp, qualifies, hands hot leads to your team, records every call and never lets a follow-up slip.',

  /** Used where the name and tagline are shown together on one line. */
  get signature() {
    return `${this.name} — ${this.tagline}`;
  },
} as const;

/**
 * The company that builds and operates the platform.
 *
 * The registered address, phone and e-mail here are not decoration: a payment
 * aggregator checks them against the live site before it will enable live keys,
 * so they are kept in one place and rendered from it everywhere.
 */
export const COMPANY = {
  name: 'Cyberbells ITES Services Pvt Ltd',
  shortName: 'Cyberbells',
  url: 'https://www.cyberbells.com',
  /** Exact string used in every footer. */
  poweredBy: 'Powered by Cyberbells ITES Services Pvt Ltd',

  /** Registered office, as it should appear on invoices and legal pages. */
  address: {
    line1: 'SCO 11, Industrial Area Phase II',
    city: 'Chandigarh',
    /** Leave empty until confirmed - a wrong PIN on a legal page is worse than none. */
    postcode: '' as string,
    country: 'India',
  },

  email: 'info.cyberbells@gmail.com',
  /** Support line. Empty = the number is simply not rendered. */
  phone: '' as string,
  /** Monday to Saturday, shown on the contact page. */
  supportHours: '10:00 - 19:00 IST, Monday to Saturday',

  /** Corporate identifiers. Empty ones are not rendered. */
  cin: '' as string,
  gstin: '' as string,

  /** One-line postal address for meta tags and invoices. */
  get addressLine() {
    return [this.address.line1, this.address.city, this.address.postcode, this.address.country]
      .filter(Boolean)
      .join(', ');
  },
} as const;
