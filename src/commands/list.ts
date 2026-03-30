import pc from "picocolors";
import {
	createStripeClient,
	fetchRateCardRates,
	getRequiredEnv,
	handleStripeError,
} from "../lib/stripe.js";

export async function runList(): Promise<void> {
	const apiKey = getRequiredEnv("STRIPE_SECRET_KEY");
	const rateCardId = getRequiredEnv("STRIPE_RATE_CARD_ID");

	const stripe = createStripeClient(apiKey);

	console.log(`\nFetching rates for Rate Card: ${pc.dim(rateCardId)}\n`);

	try {
		const rows: {
			id: string;
			metered_item: string;
			unit_amount: string;
			markup: string;
			original_price: string;
			created: string;
		}[] = [];

		const rates = await fetchRateCardRates(stripe, rateCardId);

		for (const rate of rates) {
			rows.push({
				id: rate.id,
				metered_item:
					rate.metered_item?.display_name ?? rate.metered_item?.id ?? "-",
				unit_amount: rate.unit_amount ?? "-",
				markup: rate.metadata?.markup_percentage ?? "-",
				original_price: rate.metadata?.original_price_per_million_tokens ?? "-",
				created: rate.created,
			});
		}

		if (rows.length === 0) {
			console.log(pc.yellow("No rates found."));
			return;
		}

		console.table(rows);
	} catch (error) {
		handleStripeError(error);
	}
}
