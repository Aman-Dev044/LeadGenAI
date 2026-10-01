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

/** The company that builds and operates the platform. */
export const COMPANY = {
  name: 'Cyberbells ITES Services Pvt Ltd',
  shortName: 'Cyberbells',
  url: 'https://www.cyberbells.com',
  /** Exact string used in every footer. */
  poweredBy: 'Powered by Cyberbells ITES Services Pvt Ltd',
} as const;
