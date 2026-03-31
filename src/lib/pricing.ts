/**
 * Per-million-token price → per-token unit amount string for Stripe.
 *
 * Stripe Rate Card rates accept a decimal string (e.g. "0.00000055").
 * We apply the markup percentage and convert from price-per-million
 * to price-per-single-token.
 */
export function calculateUnitAmount(
	pricePerMillionTokens: number,
	markupPercent: number,
): string {
	const withMarkup = pricePerMillionTokens * (1 + markupPercent / 100);
	const perToken = withMarkup / 1_000_000;
	return perToken.toFixed(20).replace(/0+$/, "").replace(/\.$/, ".0");
}
