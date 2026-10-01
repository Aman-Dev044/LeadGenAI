/**
 * Emits a Schema.org graph as `<script type="application/ld+json">`.
 *
 * The payload is always one of our own static objects from `structured-data.ts`
 * — never user input — and `<` is escaped so no string inside can close the
 * script tag early.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
