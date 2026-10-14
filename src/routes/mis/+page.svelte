<!-- MIS: tu lista de valores, guardada en este navegador, con cotizaciones en directo de TradingView. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { TICKERS, tvSymbol } from '#lib/commands.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import { madridDate } from '#lib/meetings.ts';
	import { earningsLine, myEarnings } from '#lib/myearnings.ts';
	import { moveWatch, toggleWatch, watchlist } from '#lib/watchlist.svelte.ts';
	import type { Mention } from '#lib/news.ts';
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

	// Titulares que nombran algún valor de la lista, sin repetir y de más reciente a más antiguo.
	// `codes` guarda qué valores nombra cada uno, para la etiqueta.
	const codes = $derived.by(() => {
		const map = new Map<string, { item: Mention; codes: string[] }>();
		for (const code of watchlist.codes) {
			for (const item of data.news?.data[code] ?? []) {
				const found = map.get(item.url);
				if (found) found.codes.push(code);
				else map.set(item.url, { item, codes: [code] });
			}
		}
		return map;
	});
	const news = $derived(
		[...codes.values()]
			.map((v) => v.item)
			.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
			.slice(0, 20)
	);

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
		{#if news.length}
			<Panel title="En las noticias" meta="Titulares que nombran tus valores">
				<NewsList items={news} tag={(item) => codes.get(item.url)?.codes.join(' · ')} />
				{#snippet note()}De todas las secciones de titulares · <Updated at={data.news?.fetchedAt} source="news-eco" />{/snippet}
			</Panel>
		{/if}
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
		gap: var(--sp-8);
		padding: var(--sp-10) var(--pad-x);
		border-bottom: var(--border);
	}

	.add input {
		flex: 1;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--raise);
		border: var(--border);
		text-transform: uppercase;
	}

	.add input:focus {
		outline: none;
		border-color: var(--amber);
	}

	.add button {
		background: none;
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		padding: 0 var(--pad-x);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.c {
		color: var(--amber);
		font-family: var(--mono);
		font-weight: var(--fw-medium);
	}

	.ops {
		display: inline-flex;
		gap: var(--sp-4);
	}

	.ops button {
		width: var(--control-h);
		height: var(--control-h);
		background: none;
		border: var(--border);
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
		padding: var(--sp-10) var(--pad-x);
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
	}

	.chips button {
		background: none;
		border: var(--border);
		color: var(--muted);
		padding: var(--sp-5) var(--sp-9);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.chips button:hover {
		color: var(--amber);
		border-color: var(--amber-edge);
	}
</style>
