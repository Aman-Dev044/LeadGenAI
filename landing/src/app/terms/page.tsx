import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { LegalPage, type LegalSection } from '@/components/legal/legal-page';
import { BRAND, COMPANY } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'The agreement between you and Cyberbells ITES Services Pvt Ltd for the use of LeadBells - subscriptions, AI calling, acceptable use and liability.',
  alternates: { canonical: '/terms' },
  openGraph: {
    type: 'article',
    url: '/terms',
    title: `Terms & Conditions | ${BRAND.name}`,
    description: 'The agreement that governs your use of LeadBells.',
  },
};

const LAST_UPDATED = '14 October 2026';

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: '1. Who this agreement is between',
    body: (
      <>
        <p>
          These Terms govern your use of <strong>{BRAND.name}</strong> (&ldquo;the Service&rdquo;), operated by{' '}
          <strong>{COMPANY.name}</strong>, registered at {COMPANY.addressLine} (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
        </p>
        <p>
          By creating a workspace, signing in, or using the Service in any way, you accept these Terms on behalf of
          yourself and the organization you represent. If you do not accept them, do not use the Service.
        </p>
        <p>
          You must be at least 18 years old and legally able to enter into a contract. If you are accepting on behalf
          of a company, you confirm you are authorised to bind that company.
        </p>
      </>
    ),
  },
  {
    id: 'service',
    title: '2. What the Service does',
    body: (
      <>
        <p>
          {BRAND.name} captures sales leads and works them automatically. Depending on your plan, it may place AI voice
          calls, answer incoming calls, reply on WhatsApp and website chat, book meetings, send reminders, score leads,
          and store recordings, transcripts and summaries in your workspace.
        </p>
        <p>
          We may add, change or withdraw individual features. Where a change materially reduces what a paid plan
          includes, we will tell you before it takes effect.
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: '3. Your account and your team',
    body: (
      <>
        <p>
          One person creates the workspace and becomes its administrator. That administrator adds the rest of the team
          and assigns each person a role. You are responsible for every action taken under your workspace, including by
          people you invite.
        </p>
        <p>
          Keep your passwords confidential and do not share logins. Tell us immediately if you believe an account has
          been compromised. We may suspend an account we reasonably believe is being used without authorisation.
        </p>
      </>
    ),
  },
  {
    id: 'trial-and-plans',
    title: '4. Free trial, plans and payment',
    body: (
      <>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            Every new workspace gets a <strong>14-day free trial</strong> with the full product and a limited number of
            AI calls. No card is required.
          </li>
          <li>
            When the trial ends the workspace is locked until a plan is purchased. Nothing is deleted while it is
            locked.
          </li>
          <li>
            Plans are billed in advance, in Indian Rupees. <strong>All prices exclude 18% GST</strong>, which is added
            at checkout.
          </li>
          <li>
            A yearly subscription is charged for ten months - two months are free. Yearly is paid as a single upfront
            amount.
          </li>
          <li>
            Payments are processed by our payment partner. We do not see or store your card details.
          </li>
          <li>
            Monthly plans renew automatically until cancelled. You can change or cancel a plan at any time from
            Billing.
          </li>
          <li>
            If a payment fails we may retry it and, after notice, suspend the workspace until payment succeeds.
          </li>
        </ul>
        <p>
          Refunds and cancellations are covered separately in our{' '}
          <a href="/refunds" className="font-semibold text-primary hover:underline">
            Refunds &amp; Cancellation Policy
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: 'usage-limits',
    title: '5. Plan limits and fair use',
    body: (
      <>
        <p>
          Each plan includes a monthly allowance - AI calls, WhatsApp messages, team members and leads. Allowances reset
          each billing period and unused allowance does not carry forward.
        </p>
        <p>
          When an allowance is exhausted, the related feature pauses until the next period or until you upgrade. We will
          not silently charge you for going over.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: '6. Acceptable use - what you must not do',
    body: (
      <>
        <p>You agree not to use the Service to:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            Call or message people who have not consented, or who are registered on the DND / NCPR list, where consent
            is required by law.
          </li>
          <li>Send unsolicited promotional messages, spam, or anything you are not licensed to send.</li>
          <li>Impersonate another person, business or government body, or misrepresent who is calling.</li>
          <li>Upload or transmit anything unlawful, defamatory, obscene, or infringing someone else&rsquo;s rights.</li>
          <li>Attempt to breach, probe or disrupt the Service, or access another customer&rsquo;s workspace.</li>
          <li>Resell, white-label or redistribute the Service without a written agreement with us.</li>
          <li>Use the Service to build a competing product, or to train a model on our outputs.</li>
        </ul>
        <p>
          We may suspend or terminate a workspace that breaches this section, without refund, and may report unlawful
          activity to the authorities.
        </p>
      </>
    ),
  },
  {
    id: 'telecom-compliance',
    title: '7. Calling, recording and telecom compliance',
    body: (
      <>
        <p>
          <strong>You are the caller.</strong> {BRAND.name} places calls on your instruction and under your business
          name. You are responsible for complying with the telecom and consumer-protection rules that apply to you -
          including TRAI regulations, DND / NCPR scrubbing, DLT registration for promotional traffic, and any consent
          or disclosure your industry requires.
        </p>
        <p>
          Calls may be recorded and transcribed so that summaries, scoring and follow-ups can be produced. You are
          responsible for telling the people you call that the call is recorded where the law requires it. You can turn
          recording off in settings.
        </p>
        <p>
          Numbers, carriers and messaging providers are third parties. Their availability, rates and policies are
          outside our control.
        </p>
      </>
    ),
  },
  {
    id: 'ai',
    title: '8. How the AI behaves, and its limits',
    body: (
      <>
        <p>
          The agent answers from material you give it - your website, your knowledge base, your instructions. It is
          instructed to stay inside that material and to offer a human when a question is not covered.
        </p>
        <p>
          <strong>AI output can still be wrong.</strong> We do not warrant that every answer, summary, score or
          transcription is accurate. Do not rely on the Service alone for legal, financial, medical or safety-critical
          decisions. Review what the AI commits to on your behalf.
        </p>
        <p>
          You are responsible for the instructions and material you give the agent, and for what it therefore says to
          your customers.
        </p>
      </>
    ),
  },
  {
    id: 'your-data',
    title: '9. Your data stays yours',
    body: (
      <>
        <p>
          You own your leads, conversations, recordings, documents and everything else you put into the Service. We
          process it to run the Service for you, and for nothing else.
        </p>
        <p>
          <strong>We do not train public or foundational AI models on your data.</strong> Workspaces are isolated from
          one another at the database level.
        </p>
        <p>
          You can export your data or request deletion at any time from Settings. How we handle personal data is set out
          in full in our{' '}
          <a href="/privacy" className="font-semibold text-primary hover:underline">
            Privacy Policy
          </a>
          , which forms part of these Terms.
        </p>
      </>
    ),
  },
  {
    id: 'third-party-keys',
    title: '10. Your own provider accounts',
    body: (
      <p>
        You may point the Service at your own accounts with AI, telephony, messaging, e-mail and storage providers. When
        you do, their terms and their charges apply directly to you, and your usage is billed by them, not by us. Keys
        you save are encrypted before storage and are never returned to a browser.
      </p>
    ),
  },
  {
    id: 'availability',
    title: '11. Availability and support',
    body: (
      <>
        <p>
          We aim to keep the Service available at all times, but we do not guarantee uninterrupted operation. Planned
          maintenance will be announced in advance where practical.
        </p>
        <p>
          Support is available by e-mail and from the Support Tickets page inside the workspace, during the hours shown
          on our{' '}
          <a href="/contact" className="font-semibold text-primary hover:underline">
            contact page
          </a>
          . Priority support is included on higher plans.
        </p>
      </>
    ),
  },
  {
    id: 'ip',
    title: '12. Our intellectual property',
    body: (
      <p>
        The Service, its software, design, documentation and brand belong to {COMPANY.name}. You get a limited,
        non-exclusive, non-transferable right to use it while your subscription is active. Nothing here transfers
        ownership of anything to you.
      </p>
    ),
  },
  {
    id: 'liability',
    title: '13. Liability',
    body: (
      <>
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential loss, loss of profit, loss of
          business, loss of goodwill, or loss of data not caused by us.
        </p>
        <p>
          <strong>
            Our total liability in any twelve-month period is limited to the amount you actually paid us for the Service
            in that period.
          </strong>
        </p>
        <p>
          Nothing in these Terms limits liability that cannot be limited by law, including liability for fraud or for
          death or personal injury caused by negligence.
        </p>
      </>
    ),
  },
  {
    id: 'termination',
    title: '14. Ending the agreement',
    body: (
      <>
        <p>
          You may cancel at any time from Billing. Your workspace keeps working until the end of the period you have
          already paid for.
        </p>
        <p>
          We may suspend or end your access if you breach these Terms, if payment fails after notice, or if we are
          required to by law.
        </p>
        <p>
          After an account is closed, you may export your data for <strong>30 days</strong>. After that we delete it,
          except where we must keep records - invoices, for example - to meet a legal obligation.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: '15. Changes to these Terms',
    body: (
      <p>
        We may update these Terms. The date at the top of this page always shows when they last changed. For material
        changes we will notify workspace administrators by e-mail or in the dashboard before they take effect.
        Continuing to use the Service after that constitutes acceptance.
      </p>
    ),
  },
  {
    id: 'law',
    title: '16. Governing law',
    body: (
      <p>
        These Terms are governed by the laws of India. The courts at <strong>Chandigarh, India</strong> have exclusive
        jurisdiction over any dispute arising from them. We will always try to resolve a dispute informally first -
        write to us before you escalate.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '17. How to reach us',
    body: (
      <div className="rounded-2xl border bg-card p-6">
        <p className="font-semibold text-foreground">{COMPANY.name}</p>
        <p className="mt-1 text-sm">{COMPANY.addressLine}</p>
        <p className="mt-2 text-sm">
          <a href={`mailto:${COMPANY.email}`} className="font-semibold text-primary hover:underline">
            {COMPANY.email}
          </a>
          {COMPANY.phone && (
            <>
              {' · '}
              <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} className="font-semibold text-primary hover:underline">
                {COMPANY.phone}
              </a>
            </>
          )}
        </p>
      </div>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      icon={Scale}
      eyebrow="Terms & Conditions"
      title="Terms & Conditions"
      intro={`The agreement between you and ${COMPANY.shortName} for the use of ${BRAND.name}. Please read it before you create a workspace.`}
      lastUpdated={LAST_UPDATED}
      sections={sections}
    />
  );
}
