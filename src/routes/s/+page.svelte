<!--
	Ficha de un valor: /s?sym=NVDA. Cotización y gráficos llegan en directo de TradingView;
	los documentos de la SEC, de static/data/sec.json.
	El símbolo se lee de la URL al arrancar en el navegador (al construir la web no hay URL con ?sym=).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import FilingList from '#lib/components/FilingList.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { TICKERS, tvSymbol } from '#lib/tickers.ts';
	import { sectionLabel } from '#lib/news.ts';
	import { stockShare, type ShareInfo } from '#lib/share.ts';
	import { inWatchlist, toggleWatch } from '#lib/watchlist.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let code = $state('');

	$effect(() => {
		code = (page.url.searchParams.get('sym') ?? 'NVDA').toUpperCase();
	});

	const symbol = $derived(tvSymbol(code));
	const name = $derived(TICKERS.find((t) => t.code === code)?.name ?? '');
	// Solo hay documentos de la SEC para los valores con CIK (los que cotizan en EE. UU.).
	const sec = $derived(data.sec?.data.companies[code]);
	// Titulares de todas las secciones que nombran la empresa (scripts/news-index.ts).
	const news = $derived(data.news?.data[code] ?? []);

	// «Compartir»: símbolo y nombre, con ?sym en el enlace (la ficha sin ?sym abre NVDA).
	function share(): ShareInfo {
		const url = new URL(location.href);
		url.searchParams.set('sym', code);
		return { ...stockShare(code, name), url: url.href };
	}
</script>

<ViewHeader code={code || '…'} title={name || 'Ficha del valor'} sub="Cotización, gráfico y datos en directo · TradingView">
	{#snippet aside()}
		{#if code}
			<button class="star" type="button" aria-pressed={inWatchlist(code)} onclick={() => toggleWatch(code)}>
				{inWatchlist(code) ? '★ En mi lista' : '☆ Añadir a MIS'}
			</button>
			<a class="star" href="{resolve('/cmp')}?s={encodeURIComponent(code)}">Comparar con…</a>
		{/if}
	{/snippet}
</ViewHeader>

{#if code}
	{#key symbol}
		<div class="grid grid-2">
			<div class="col">
				<Panel title="Gráfico" meta={symbol} {share}>
					<TvWidget
						widget="advanced-chart"
						config={{ symbol, interval: 'D', timezone: 'Europe/Madrid', style: '1', allow_symbol_change: false, hide_side_toolbar: true }}
						height={480}
					/>
				</Panel>
			</div>
			<div class="col">
				<Panel title="Cotización">
					<TvWidget widget="symbol-info" config={{ symbol }} height={190} credit={false} />
				</Panel>
				<Panel title="Análisis técnico">
					<TvWidget widget="technical-analysis" config={{ symbol, interval: '1D', showIntervalTabs: true, displayMode: 'single' }} height={420} credit={false} />
				</Panel>
			</div>
		</div>
		<div class="grid grid-2e">
			<div class="col">
				<Panel title="Datos fundamentales">
					<TvWidget widget="financials" config={{ symbol, displayMode: 'regular' }} height={560} credit={false} />
				</Panel>
			</div>
			<div class="col">
				<Panel title="Perfil de la empresa">
					<TvWidget widget="symbol-profile" config={{ symbol }} height={560} />
				</Panel>
			</div>
		</div>
		{#if news.length}
			<div class="grid">
				<div class="col">
					<Panel title="En las noticias" meta="{news.length} {news.length === 1 ? 'titular' : 'titulares'}">
						<NewsList items={news} tag={(item) => sectionLabel(item)} />
						{#snippet note()}Titulares de todas las secciones que nombran a {name || code} · <Updated at={data.news?.fetchedAt} source="news-eco" />{/snippet}
					</Panel>
				</div>
			</div>
		{/if}
		{#if sec?.filings.length}
			<div class="grid">
				<div class="col">
					<Panel title="Documentos SEC" meta={sec.name}>
						<FilingList items={sec.filings} strong={(form) => form.startsWith('8-K')} />
						{#snippet note()}Fuente: SEC EDGAR · <Updated at={data.sec?.fetchedAt} />{/snippet}
					</Panel>
				</div>
			</div>
		{/if}
	{/key}
{/if}

<style>
	.star {
		background: none;
		border: var(--border);
		color: var(--muted);
		min-height: var(--control-h);
		padding: 0 var(--sp-10);
		font-size: var(--fs-s);
		cursor: pointer;
		text-decoration: none;
	}

	.star + .star {
		margin-left: var(--sp-6);
	}

	a.star:hover {
		color: var(--amber);
	}

	.star[aria-pressed='true'] {
		color: var(--amber);
		border-color: var(--amber-edge);
	}
</style>
