<!--
	Cotizaciones en directo de una lista de valores (widget market-quotes de TradingView) y, debajo, un
	enlace a la ficha de cada uno (/s?sym=…): las filas del widget son de TradingView y llevan a su web.
	Uso: <QuoteBoard name="Tecnológicas" codes={['NVDA', 'MSFT']} />
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { TICKERS, tvSymbol } from '#lib/commands.ts';
	import TvWidget from './TvWidget.svelte';

	interface Props {
		/** Nombre del grupo dentro del widget. */
		name: string;
		/** Códigos de la barra de comandos (NVDA, ASML…). */
		codes: readonly string[];
	}

	let { name, codes }: Props = $props();

	const nameOf = (code: string) => TICKERS.find((t) => t.code === code)?.name ?? code;
	const config = $derived({
		showSymbolLogo: false,
		symbolsGroups: [{ name, symbols: codes.map((code) => ({ name: tvSymbol(code), displayName: nameOf(code) })) }]
	});
</script>

<TvWidget widget="market-quotes" {config} height={Math.max(220, 90 + codes.length * 46)} />
<nav class="fichas" aria-label="Fichas de los valores">
	{#each codes as code (code)}
		<a href="{resolve('/s')}?sym={encodeURIComponent(code)}" title="Ficha de {nameOf(code)}">{code}</a>
	{/each}
</nav>

<style>
	.fichas {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-12);
		padding: var(--sp-8) var(--pad-x);
		border-top: var(--border);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
	}

	.fichas a {
		color: var(--muted);
		text-decoration: none;
	}

	.fichas a:hover {
		color: var(--amber);
	}

	/* En el móvil, cada código es una zona táctil cómoda (--touch) sin cambiar cómo se ve. */
	@media (pointer: coarse) {
		.fichas a {
			display: inline-flex;
			align-items: center;
			min-height: var(--touch);
		}
	}
</style>
