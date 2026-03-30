import pc from "picocolors";
import Stripe from "stripe";

export function createStripeClient(apiKey: string): Stripe {
	return new Stripe(apiKey);
}

interface V2ListPage {
	data: Stripe.V2.Billing.RateCardRate[];
	next_page_url: string | null;
}

async function fetchV2ListPage(
	stripe: Stripe,
	url: string,
): Promise<V2ListPage> {
	const resp: unknown = await stripe.rawRequest("GET", url);
	return resp as V2ListPage;
}

/**
 * Fetch all Rate Card Rates with manual pagination.
 *
 * Works around a bug in the Stripe SDK where `autoPagingEach` loses
 * path parameters (e.g. `rate_card_id`) when fetching subsequent pages.
 */
export async function fetchRateCardRates(
	stripe: Stripe,
	rateCardId: string,
): Promise<Stripe.V2.Billing.RateCardRate[]> {
	const items: Stripe.V2.Billing.RateCardRate[] = [];

	let url: string | null = `/v2/billing/rate_cards/${rateCardId}/rates`;
	while (url) {
		const page = await fetchV2ListPage(stripe, url);
		items.push(...page.data);
		url = page.next_page_url;
	}

	return items;
}

export function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		console.error(
			pc.red(`Error: Missing required environment variable: ${name}`),
		);
		process.exit(1);
	}
	return value;
}

export function handleStripeError(error: unknown): never {
	if (error instanceof Stripe.errors.StripeError) {
		console.error(pc.red(`\nStripe API error: ${error.message}`));
		if (error.requestId) {
			console.error(pc.dim(`  Request ID: ${error.requestId}`));
		}
	} else if (error instanceof Error) {
		console.error(pc.red(`\nError: ${error.message}`));
	} else {
		console.error(pc.red("\nAn unknown error occurred."));
	}
	process.exit(1);
}
