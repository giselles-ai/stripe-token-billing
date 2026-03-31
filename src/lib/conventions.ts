export type TokenType = "input" | "output";

function timestamp(): string {
	return Date.now().toString();
}

export function buildLookupKey(model: string, tokenType: TokenType): string {
	return `token-billing-${model}-${tokenType}-${timestamp()}`;
}

export function buildDisplayName(model: string, tokenType: TokenType): string {
	return `${model} ${tokenType} tokens`;
}

export function buildMeteredItemMetadata(): Record<string, string> {
	return { created_by: "Stripe Token Billing" };
}

export function buildRateMetadata(
	markupPercent: number,
	pricePerMillionTokens: number,
): Record<string, string> {
	return {
		created_by: "Stripe Token Billing",
		markup_percentage: `${markupPercent}%`,
		original_price_per_million_tokens: `$${pricePerMillionTokens.toFixed(8)}`,
	};
}
