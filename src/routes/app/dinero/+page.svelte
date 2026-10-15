<!--
	Tu dinero (app Sencilla): tus valores (los de MIS, con la cotización de TradingView), y las cifras que tocan el
	bolsillo en tarjetas: inflación, euríbor, hipotecas, paro, prima de riesgo, euro y bitcoin.
-->
<script lang="ts">
	import FactCard from '#lib/components/sencillo/FactCard.svelte';
	import Section from '#lib/components/sencillo/Section.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import { movePhrase } from '#lib/plain.ts';
	import type { Fact } from '#lib/sencillo/facts.ts';
	import { TICKERS, tvSymbol } from '#lib/tickers.ts';
	import { toggleWatch, watchlist } from '#lib/watchlist.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const nameOf = (code: string) => TICKERS.find((t) => t.code === code)?.name ?? code;
	// Unas pocas muy conocidas para empezar, si aún no sigues ninguna.
	const SUGGEST = ['AAPL', 'NVDA', 'MSFT', 'AMZN', 'TSLA', 'SAN', 'ITX', 'IBE'].filter((c) => TICKERS.some((t) => t.code === c));
	const mine = $derived(watchlist.codes.slice(0, 6));

	const bitcoin = $derived<Fact | null>(
		data.bitcoin
			? {
					id: 'bitcoin',
					title: 'Bitcoin',
					value: `${Math.round(data.bitcoin.eur).toLocaleString('es-ES')} €`,
					delta: data.bitcoin.change,
					change: data.bitcoin.change == null ? '' : `${data.bitcoin.change > 0 ? '+' : '−'}${Math.abs(data.bitcoin.change).toLocaleString('es-ES', { maximumFractionDigits: 1 })} % en 24 horas`,
					phrase: movePhrase('El bitcoin', data.bitcoin.change, 'en 24 horas'),
					spark: data.bitcoin.spark,
					explain: 'crypto',
					when: 'ahora',
					source: 'CoinGecko'
				}
			: null
	);
</script>

<svelte:head>
	<title>Arc · Tu dinero</title>
</svelte:head>

<h1>Tu dinero</h1>

<div class="stack">
	<Section title="Tus valores" icon="chart">
		{#if mine.length}
			<div class="quotes">
				{#each mine as code (code)}
					<div class="quote">
						<TvWidget widget="mini-symbol-overview" config={{ symbol: tvSymbol(code), dateRange: '1M', chartOnly: false, noTimeScale: true }} height={170} credit={false} />
						<button type="button" class="drop" onclick={() => toggleWatch(code)} aria-label="Dejar de seguir {nameOf(code)}">Quitar</button>
					</div>
				{/each}
			</div>
		{:else}
			<p>Sigue las empresas que te interesan y verás aquí cómo van. Toca para añadir:</p>
		{/if}
		<div class="chips">
			{#each SUGGEST.filter((c) => !mine.includes(c)) as code (code)}
				<button type="button" onclick={() => toggleWatch(code)}>+ {nameOf(code)}</button>
			{/each}
		</div>
	</Section>

	<div class="cards">
		{#each data.facts as f (f.id)}<FactCard fact={f} />{/each}
		{#if bitcoin}<FactCard fact={bitcoin} />{/if}
	</div>
	{#if !data.facts.length}<p class="mut">Aún no hay datos. Vuelve en unos minutos.</p>{/if}
</div>

<style>
	h1 {
		margin: 0 0 var(--sp-16);
		font-size: var(--app-fs-h1);
	}

	.stack {
		display: grid;
		gap: var(--sp-16);
	}

	p {
		margin: 0;
	}

	.cards {
		display: grid;
		gap: var(--sp-12);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
	}

	.quotes {
		display: grid;
		gap: var(--sp-12);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
	}

	.quote {
		display: grid;
		gap: var(--sp-4);
	}

	.drop {
		justify-self: end;
		min-height: var(--touch);
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--app-fs-small);
		cursor: pointer;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
	}

	.chips button {
		min-height: var(--touch);
		padding: 0 var(--sp-14);
		border: var(--border);
		border-radius: var(--app-radius-pill);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		font-size: var(--app-fs-small);
		cursor: pointer;
	}

	.mut {
		color: var(--muted);
	}
</style>
