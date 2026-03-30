#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { config } from "dotenv";
import pc from "picocolors";
import { runAdd } from "./commands/add.js";
import { runList } from "./commands/list.js";

function getConfigDir(): string {
	const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(base, "stripe-token-billing");
}

function loadEnv(env: string) {
	const file = `.env.${env}`;
	const configPath = join(getConfigDir(), file);
	const result = config({ path: configPath, quiet: true });

	if (result.error) {
		const dir = getConfigDir();
		console.error(pc.red(`Error: Config file not found: ${configPath}\n`));
		console.error("Create it with:");
		console.error(pc.cyan(`  mkdir -p ${dir}`));
		console.error(
			`  Then add STRIPE_SECRET_KEY, STRIPE_RATE_CARD_ID, STRIPE_METER_ID to ${pc.cyan(configPath)}`,
		);
		process.exit(1);
	}
}

const program = new Command();

program
	.name("stripe-token-billing")
	.description(
		"CLI tool for managing Stripe Rate Card models for token-based billing",
	)
	.version("1.0.0")
	.requiredOption(
		"--env <environment>",
		'Environment to use (e.g. "sandbox", "production")',
	)
	.hook("preAction", (_thisCommand, actionCommand) => {
		const env = actionCommand.optsWithGlobals().env as string;
		loadEnv(env);
	});

program
	.command("add")
	.description(
		"Add a new LLM model to the Stripe Rate Card (creates input/output metered items and rates)",
	)
	.requiredOption(
		"--model <model>",
		"Model identifier (e.g. google/gemini-3-flash)",
	)
	.requiredOption(
		"--input-price <price>",
		"Price per million input tokens in USD",
	)
	.requiredOption(
		"--output-price <price>",
		"Price per million output tokens in USD",
	)
	.option("--markup <percent>", "Markup percentage", "10")
	.option("--dry-run", "Preview without making API calls", false)
	.action(async (opts) => {
		await runAdd({
			model: opts.model,
			inputPrice: Number.parseFloat(opts.inputPrice),
			outputPrice: Number.parseFloat(opts.outputPrice),
			markup: Number.parseFloat(opts.markup),
			dryRun: opts.dryRun,
		});
	});

program
	.command("list")
	.description("List all rates on the Rate Card")
	.action(async () => {
		await runList();
	});

program.parse();
