// ============================================================================
// BRAND CONFIG — the only file you need to edit to rename this product.
//
// Everything user-facing (page titles, sidebar wordmark, login screen, CSV
// exports, cookie names, seed data) reads from here. Change these values and
// the whole app follows.
//
// You can also override any of them at runtime with environment variables,
// which is handy if you run the same codebase for more than one org.
// ============================================================================

export const BRAND = {
  /** Short name — used in the sidebar wordmark and as the company record. */
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "Aikyaa",

  /** Full product name — used in page titles and the login screen. */
  productName: process.env.NEXT_PUBLIC_APP_PRODUCT_NAME ?? "Aikyaa.space",

  /** One-line description used in metadata. */
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
    "Operating system for managing multiple independent businesses — one team, one workspace.",

  /** Lowercase slug — used for cookie names and export filenames. */
  slug: process.env.NEXT_PUBLIC_APP_SLUG ?? "aikyaa",

  /** Email domain used for placeholder text and the seeded admin account. */
  emailDomain: process.env.NEXT_PUBLIC_APP_EMAIL_DOMAIN ?? "example.com",
} as const;

// ---------------------------------------------------------------------------
// LOCALE & CURRENCY
// Set these to whatever your team actually bills in. Nothing else is hardcoded.
// Examples: ("en-US", "USD"), ("en-GB", "GBP"), ("en-IN", "INR"), ("de-DE", "EUR")
// ---------------------------------------------------------------------------

export const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "en-US";
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "USD";

/** Symbol used for compact display (e.g. "$1.2k"). Derived from CURRENCY. */
export const CURRENCY_SYMBOL = (() => {
  try {
    return (
      new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? "$"
    );
  } catch {
    return "$";
  }
})();

/**
 * Compact-notation thresholds. The Indian numbering system uses lakh/crore
 * instead of k/M/B — set `useIndianNumbering` to true if that's your market.
 */
export const useIndianNumbering = LOCALE.endsWith("-IN");
