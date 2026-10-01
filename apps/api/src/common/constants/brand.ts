/**
 * Brand strings the API sends out (transactional emails, default platform
 * settings). The dashboard has its own copy at `apps/web/src/lib/brand.ts` —
 * these two are the only places the wording lives, so a rename is two edits.
 */

export const BRAND = {
  name: 'LeadBells',
  tagline: 'AI Leads Follow up, tracking & calling software',
} as const;

export const COMPANY = {
  name: 'Cyberbells ITES Services Pvt Ltd',
  url: 'https://www.cyberbells.com',
} as const;

/** Footer block for every HTML email the platform sends. */
export const EMAIL_FOOTER_HTML = `
          <p style="color: #999; font-size: 12px; margin: 4px 0;">${BRAND.name} — ${BRAND.tagline}</p>
          <p style="color: #b0b0b0; font-size: 11px; margin: 0;">Powered by <a href="${COMPANY.url}" style="color: #6366F1; text-decoration: none;">${COMPANY.name}</a></p>`;

/** Plain-text equivalent, for the text/plain part of the same emails. */
export const EMAIL_FOOTER_TEXT = `${BRAND.name} — ${BRAND.tagline}
Powered by ${COMPANY.name} (${COMPANY.url})`;
