import type { Metadata } from 'next';
import { RotateCcw } from 'lucide-react';
import { LegalPage, type LegalSection } from '@/components/legal/legal-page';
import { BRAND, COMPANY } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Refunds & Cancellation Policy',
  description:
    'How to cancel a LeadBells subscription, when a refund is given, and how long it takes to reach your account.',
  alternates: { canonical: '/refunds' },
  openGraph: {
    type: 'article',
    url: '/refunds',
    title: `Refunds & Cancellation Policy | ${BRAND.name}`,
    description: 'Cancellation, refunds and how long a refund takes.',
  },
};

const LAST_UPDATED = '14 October 2026';

const sections: LegalSection[] = [
  {
    id: 'summary',
    title: 'In short',
    body: (
      <div className="rounded-2xl border bg-card p-6">
        <ul className="ml-5 list-disc space-y-2 text-foreground">
          <li>
            <strong>Try before you pay.</strong> Every workspace gets 14 days of the full product free, with no card.
          </li>
          <li>
            <strong>Cancel any time</strong> from Billing. You keep the Service until the end of the period you have
            already paid for.
          </li>
          <li>
            <strong>Paid subscriptions are generally non-refundable</strong> once the period has started - the free
            trial is there so you can decide first.
          </li>
          <li>
            <strong>We do refund genuine mistakes</strong> - a duplicate charge, a charge after cancellation, or a
            failure on our side that we could not fix.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'trial',
    title: '1. The free trial',
    body: (
      <>
        <p>
          Every new workspace starts with a <strong>14-day free trial</strong> of the complete product, including AI
          calls to try on your own leads. No card is taken and nothing is charged.
        </p>
        <p>
          If you do nothing when the trial ends, the workspace simply locks. You are never charged automatically at the
          end of a trial.
        </p>
      </>
    ),
  },
  {
    id: 'cancellation',
    title: '2. How to cancel',
    body: (
      <>
        <p>Cancel yourself, in under a minute:</p>
        <ol className="ml-5 list-decimal space-y-1.5">
          <li>
            Sign in and open <strong>Billing</strong>.
          </li>
          <li>
            Choose <strong>Cancel subscription</strong>.
          </li>
          <li>Confirm. You receive an e-mail acknowledging the cancellation.</li>
        </ol>
        <p>
          You can also write to{' '}
          <a href={`mailto:${COMPANY.email}`} className="font-semibold text-primary hover:underline">
            {COMPANY.email}
          </a>{' '}
          from the e-mail address registered on the workspace and we will cancel it for you.
        </p>
        <p>
          <strong>What happens next:</strong> the subscription stops renewing. Your workspace keeps working normally
          until the end of the period you have already paid for. Nothing is deleted on the cancellation date.
        </p>
      </>
    ),
  },
  {
    id: 'when-refunded',
    title: '3. When we refund',
    body: (
      <>
        <p>We refund in these situations:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Duplicate payment</strong> - you were charged twice for the same period. We refund the extra charge
            in full.
          </li>
          <li>
            <strong>Charged after cancelling</strong> - a renewal went through after you had already cancelled. Refunded
            in full.
          </li>
          <li>
            <strong>Wrong amount charged</strong> - we refund the difference.
          </li>
          <li>
            <strong>A failure on our side</strong> - the Service was materially unusable for an extended period because
            of a fault we could not resolve. We refund the affected part of the period.
          </li>
          <li>
            <strong>Charged despite never using it</strong> - a yearly plan was paid for and the workspace was not used
            at all, and you tell us within <strong>7 days</strong> of the charge. We refund in full.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'when-not-refunded',
    title: '4. When we do not refund',
    body: (
      <>
        <p>So there are no surprises, these are not refundable:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            A period that has already started and been used. The 14-day trial exists so you can evaluate the product
            before paying.
          </li>
          <li>
            Part of a month or year after you decide to stop mid-period - the Service stays available until the period
            ends instead.
          </li>
          <li>
            Usage already consumed - AI calls placed, WhatsApp messages sent, numbers rented on your behalf.
          </li>
          <li>Charges from your own provider accounts, where you use your own AI, telephony or messaging keys.</li>
          <li>Accounts suspended or terminated for breaching our Terms.</li>
          <li>Taxes already paid to the government on your behalf, such as GST, where they cannot be reclaimed.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'how-to-request',
    title: '5. How to request a refund',
    body: (
      <>
        <p>
          Write to{' '}
          <a href={`mailto:${COMPANY.email}`} className="font-semibold text-primary hover:underline">
            {COMPANY.email}
          </a>{' '}
          with:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Your workspace name</li>
          <li>The invoice number or payment reference</li>
          <li>What went wrong, in a line or two</li>
        </ul>
        <p>
          We acknowledge within <strong>2 working days</strong> and decide within <strong>7 working days</strong>. If we
          decline, we will tell you why.
        </p>
      </>
    ),
  },
  {
    id: 'timeline',
    title: '6. How long a refund takes',
    body: (
      <>
        <p>
          Approved refunds are sent back to the <strong>original payment method</strong>. We cannot refund to a
          different card, account or wallet.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-semibold text-foreground">Step</th>
                <th className="py-2 text-left font-semibold text-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 pr-4">We approve and initiate the refund</td>
                <td className="py-2">Within 7 working days of your request</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">Payment gateway processes it</td>
                <td className="py-2">1 to 3 working days</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">Your bank credits it</td>
                <td className="py-2">5 to 10 working days</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-semibold text-foreground">Typically in your account</td>
                <td className="py-2 font-semibold text-foreground">Within 10 to 14 working days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The last step is the bank&rsquo;s, not ours. If 14 working days pass and you still cannot see it, write to us
          with the payment reference and we will chase it with the gateway.
        </p>
      </>
    ),
  },
  {
    id: 'plan-changes',
    title: '7. Upgrades and downgrades',
    body: (
      <>
        <p>
          <strong>Upgrading</strong> takes effect immediately. You pay the difference for the remainder of the current
          period.
        </p>
        <p>
          <strong>Downgrading</strong> takes effect at the start of the next period, so you keep what you have already
          paid for. Downgrades are not refunded as cash.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: '8. Questions',
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
        <p className="mt-2 text-xs">{COMPANY.supportHours}</p>
      </div>
    ),
  },
];

export default function RefundsPage() {
  return (
    <LegalPage
      icon={RotateCcw}
      eyebrow="Refunds & Cancellation"
      title="Refunds & Cancellation Policy"
      intro="How to cancel, when we refund, and how long the money takes to reach you. Written so there is nothing to argue about later."
      lastUpdated={LAST_UPDATED}
      sections={sections}
    />
  );
}
