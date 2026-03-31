import pc from "picocolors";
import type Stripe from "stripe";
import type { TokenType } from "../lib/conventions.js";
import {
	buildDisplayName,
	buildLookupKey,
	buildMeteredItemMetadata,
	buildRateMetadata,
} from "../lib/conventions.js";
import { calculateUnitAmount } from "../lib/pricing.js";
import {
	createStripeClient,
	fetchRateCardRates,
	getRequiredEnv,
	handleStripeError,
} from "../lib/stripe.js";

export interface AddOptions {
	model: string;
	inputPrice: number;
	outputPrice: number;
	markup: number;
	dryRun: boolean;
	force: boolean;
}

interface TokenConfig {
	tokenType: TokenType;
	pricePerMillionTokens: number;
}

async function createMeteredItemAndRate(
	stripe: Stripe,
	rateCardId: string,
	meterId: string,
	model: string,
	config: TokenConfig,
	markupPercent: number,
) {
	const { tokenType, pricePerMillionTokens } = config;

	const item = await stripe.v2.billing.meteredItems.create({
		display_name: buildDisplayName(model, tokenType),
		meter: meterId,
		lookup_key: buildLookupKey(model, tokenType),
		meter_segment_conditions: [
			{ dimension: "model", value: model },
			{ dimension: "token_type", value: tokenType },
		],
		unit_label: "token",
		tax_details: { tax_code: "txcd_10103000" },
		metadata: buildMeteredItemMetadata(),
	});

	console.log(pc.green(`  ✓ Metered Item created: ${item.id} (${tokenType})`));

	const unitAmount = calculateUnitAmount(pricePerMillionTokens, markupPercent);
	const rate = await stripe.v2.billing.rateCards.rates.create(rateCardId, {
		metered_item: item.id,
		unit_amount: unitAmount,
		metadata: buildRateMetadata(markupPercent, pricePerMillionTokens),
	});

	console.log(
		pc.green(`  ✓ Rate created: ${rate.id} (unit_amount: ${unitAmount})`),
	);

	return { item, rate };
}

function printDryRun(options: AddOptions) {
	const { model, inputPrice, outputPrice, markup } = options;

	console.log(
		`\n${pc.yellow(pc.bold("[DRY RUN]"))} The following resources would be created:\n`,
	);

	for (const tokenType of ["input", "output"] as const) {
		const price = tokenType === "input" ? inputPrice : outputPrice;
		const unitAmount = calculateUnitAmount(price, markup);

		console.log(
			`  ${pc.bold("Metered Item:")} ${buildDisplayName(model, tokenType)}`,
		);
		console.log(`    ${pc.dim("meter_segment_conditions:")}`);
		console.log(`      ${pc.dim("model =")} ${model}`);
		console.log(`      ${pc.dim("token_type =")} ${tokenType}`);
		console.log(`    ${pc.dim("unit_label:")} token`);
		console.log(`    ${pc.dim("tax_code:")} txcd_10103000`);
		console.log("");
		console.log(`  ${pc.bold("Rate:")}`);
		console.log(`    ${pc.dim("unit_amount:")} ${unitAmount}`);
		console.log(`    ${pc.dim("markup:")} ${markup}%`);
		console.log(
			`    ${pc.dim("original_price_per_million_tokens:")} $${price.toFixed(8)}`,
		);
		console.log("");
	}
}

interface DuplicateRate {
	rateId: string;
	displayName: string;
}

async function findDuplicateRates(
	stripe: Stripe,
	rateCardId: string,
	model: string,
): Promise<DuplicateRate[]> {
	const inputName = buildDisplayName(model, "input");
	const outputName = buildDisplayName(model, "output");

	const rates = await fetchRateCardRates(stripe, rateCardId);

	return rates
		.filter((rate) => {
			const name = rate.metered_item?.display_name;
			return name === inputName || name === outputName;
		})
		.map((rate) => ({
			rateId: rate.id,
			displayName:
				rate.metered_item?.display_name ?? rate.metered_item?.id ?? "-",
		}));
}

export async function runAdd(options: AddOptions): Promise<void> {
	const { model, inputPrice, outputPrice, markup, dryRun, force } = options;

	if (dryRun) {
		printDryRun(options);
		return;
	}

	const apiKey = getRequiredEnv("STRIPE_SECRET_KEY");
	const rateCardId = getRequiredEnv("STRIPE_RATE_CARD_ID");
	const meterId = getRequiredEnv("STRIPE_METER_ID");

	const stripe = createStripeClient(apiKey);

	try {
		const duplicates = await findDuplicateRates(stripe, rateCardId, model);
		if (duplicates.length > 0 && !force) {
			console.error(
				pc.red(`\nError: Model "${model}" already exists on this Rate Card:\n`),
			);
			for (const dup of duplicates) {
				console.error(`  - ${dup.displayName}`);
			}
			console.error(pc.dim("\nUse --force to replace existing rates."));
			process.exit(1);
		}

		if (duplicates.length > 0 && force) {
			console.log(pc.yellow(`\nReplacing existing rates for "${model}"...\n`));
			for (const dup of duplicates) {
				await stripe.v2.billing.rateCards.rates.del(rateCardId, dup.rateId);
				console.log(pc.yellow(`  ✕ Removed: ${dup.displayName}`));
			}
			console.log("");
		}
	} catch (error) {
		handleStripeError(error);
	}

	console.log(`Adding model: ${pc.bold(model)}`);
	console.log(`  Input price:  ${pc.cyan(`$${inputPrice}/M tokens`)}`);
	console.log(`  Output price: ${pc.cyan(`$${outputPrice}/M tokens`)}`);
	console.log(`  Markup: ${pc.cyan(`${markup}%`)}\n`);

	const configs: TokenConfig[] = [
		{ tokenType: "input", pricePerMillionTokens: inputPrice },
		{ tokenType: "output", pricePerMillionTokens: outputPrice },
	];

	try {
		for (const config of configs) {
			await createMeteredItemAndRate(
				stripe,
				rateCardId,
				meterId,
				model,
				config,
				markup,
			);
		}

		await stripe.v2.billing.rateCards.update(rateCardId, {
			live_version: "latest",
		});
		console.log(pc.green("  ✓ Rate Card updated to latest version"));

		const pricingPlanId = process.env.STRIPE_PRICING_PLAN_ID;
		if (pricingPlanId) {
			const rateCard = await stripe.v2.billing.rateCards.retrieve(rateCardId);
			const { data: components } =
				await stripe.v2.billing.pricingPlans.components.list(pricingPlanId);
			const existing = components.find(
				(c) => c.type === "rate_card" && c.rate_card?.id === rateCardId,
			);
			if (existing) {
				await stripe.v2.billing.pricingPlans.components.del(
					pricingPlanId,
					existing.id,
				);
			}
			await stripe.v2.billing.pricingPlans.components.create(pricingPlanId, {
				type: "rate_card",
				rate_card: {
					id: rateCardId,
					version: rateCard.latest_version,
				},
			});
			await stripe.v2.billing.pricingPlans.update(pricingPlanId, {
				live_version: "latest",
			});
			console.log(pc.green("  ✓ Pricing Plan updated to latest version"));
		}
	} catch (error) {
		handleStripeError(error);
	}

	console.log(pc.green("\nDone."));
}
