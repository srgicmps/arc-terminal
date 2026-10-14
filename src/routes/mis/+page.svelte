<!-- MIS: tu lista de valores, guardada en este navegador, con cotizaciones en directo de TradingView. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { TICKERS, tvSymbol } from '#lib/commands.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import Updated from '#lib/components/Updated.svelte';
	import { madridDate } from '#lib/meetings.ts';
	import { earningsLine, myEarnings } from '#lib/myearnings.ts';
	import { moveWatch, toggleWatch, watchlist } from '#lib/watchlist.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Resultados de los próximos 14 días de los valores de tu lista (fecha de hoy en Madrid).
	const today = $derived(madridDate(clock.now || Date.now()));
	const upcoming = $derived(myEarnings(data.finnhub?.data.earnings ?? [], watchlist.codes, today));

	let adding = $state('');

	const nameOf = (code: string) => TICKERS.find((t) => t.code === code)?.name ?? code;
	const quotes = $derived({
		showSymbolLogo: false,
		symbolsGroups: [
			{
				name: 'Mis valores',
				symbols: watchlist.codes.map((code) => ({ name: tvSymbol(code), displayName: nameOf(code) }))
			}
		]
	});

	function add(e: SubmitEvent) {
		e.preventDefault();
		if (adding.trim() && !watchlist.codes.includes(adding.trim().toUpperCase())) toggleWatch(adding);
		adding = '';
	}
</script>

<ViewHeader code="MIS" title="Mis valores" sub="Tu lista, guardada en este navegador · cotizaciones en directo de TradingView" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Cotizaciones" meta="{watchlist.codes.length} valores">
			{#if watchlist.ready && watchlist.codes.length}
				{#key watchlist.codes.join(',')}
					<TvWidget widget="market-quotes" config={quotes} height={Math.max(220, 90 + watchlist.codes.length * 46)} />
				{/key}
			{:else if watchlist.ready}
				<p class="empty">
					Aún no tienes valores. Añádelos aquí al lado o con la ☆ de la ficha de cada valor.
				</p>
			{/if}
		</Panel>
	</div>
	<div class="col">
		{#if data.finnhub && watchlist.codes.length}
			<Panel title="Tus próximos resultados" meta="Próximas 2 semanas">
				{#if upcoming.length}
					<ul class="mini">
						{#each upcoming as e (e.symbol + e.date)}
							<li>
								<a class="l" href="{resolve('/s')}?sym={encodeURIComponent(e.code)}">{earningsLine(e, today)}</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty">Ninguno de tus valores presenta resultados en las próximas 2 semanas.</p>
				{/if}
				{#snippet note()}
					Grandes empresas de EE. UU. Fuente: Finnhub · <Updated at={data.finnhub?.fetchedAt} source="finnhub" />
				{/snippet}
			</Panel>
		{/if}
		<Panel title="Editar la lista">
			<form class="add" onsubmit={add}>
				<input bind:value={adding} placeholder="Código: NVDA, SAN, BME:REP…" aria-label="Código del valor" autocapitalize="characters" spellcheck="false" />
				<button type="submit">Añadir</button>
			</form>
			{#if watchlist.codes.length}
				<ul class="mini">
					{#each watchlist.codes as code, i (code)}
						<li>
							<a class="l" href="{resolve('/s')}?sym={encodeURIComponent(code)}"><b class="c">{code}</b> {nameOf(code)}</a>
							<span class="ops">
								<button type="button" aria-label="Subir {code}" disabled={i === 0} onclick={() => moveWatch(code, -1)}>↑</button>
								<button type="button" aria-label="Bajar {code}" disabled={i === watchlist.codes.length - 1} onclick={() => moveWatch(code, 1)}>↓</button>
								<button type="button" aria-label="Quitar {code}" onclick={() => toggleWatch(code)}>×</button>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Panel>
		<Panel title="Sugerencias" meta="Toca para añadir">
			<ul class="chips">
				{#each TICKERS.filter((t) => !watchlist.codes.includes(t.code)) as t (t.code)}
					<li><button type="button" onclick={() => toggleWatch(t.code)}>☆ {t.code}</button></li>
				{/each}
			</ul>
		</Panel>
	</div>
</div>

<style>
	.add {
		display: flex;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--line);
	}

	.add input {
		flex: 1;
		min-width: 0;
		height: 32px;
		padding: 0 10px;
		background: var(--raise);
		border: 1px solid var(--line);
		text-transform: uppercase;
	}

	.add input:focus {
		outline: none;
		border-color: var(--amber);
	}

	.add button {
		background: none;
		border: 1px solid var(--amber-edge);
		color: var(--amber);
		padding: 0 12px;
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.c {
		color: var(--amber);
		font-family: var(--mono);
		font-weight: 500;
	}

	.ops {
		display: inline-flex;
		gap: 4px;
	}

	.ops button {
		width: 32px;
		height: 32px;
		background: none;
		border: 1px solid var(--line);
		color: var(--muted);
		cursor: pointer;
	}

	.ops button:hover:not(:disabled) {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	.ops button:disabled {
		opacity: 0.35;
	}

	.chips {
		list-style: none;
		margin: 0;
		padding: 10px 12px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chips button {
		background: none;
		border: 1px solid var(--line);
		color: var(--muted);
		padding: 5px 9px;
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.chips button:hover {
		color: var(--amber);
		border-color: var(--amber-edge);
	}
</style>
