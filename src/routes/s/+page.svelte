<!--
	Ficha de un valor: /s?sym=NVDA. Cotización y gráficos llegan en directo de TradingView;
	los documentos de la SEC, de static/data/sec.json.
	Con &fn= (funciones por valor de la barra, src/lib/functions.ts: «NVDA GP»), se abre la ficha entera
	con ese panel ya ampliado; Esc vuelve a la ficha.
	El símbolo se lee de la URL al arrancar en el navegador (al construir la web no hay URL con ?sym=).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { isRange, rangeInterval, rangeLabel } from '#lib/bar/ranges.ts';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import AnalystPanel from '#lib/components/AnalystPanel.svelte';
	import FilingList from '#lib/components/FilingList.svelte';
	import RvTable from '#lib/components/RvTable.svelte';
	import { compareWithPeers } from '#lib/rv.ts';
	import HoldersTable from '#lib/components/HoldersTable.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import ShortVolume from '#lib/components/ShortVolume.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { TICKERS, tvSymbol } from '#lib/tickers.ts';
	import { sectionLabel } from '#lib/news.ts';
	import { hm } from '#lib/format.ts';
	import { latestQuote, recent, whySentence, WHY_HOURS } from '#lib/why.ts';
	import Change from '#lib/components/ui/Change.svelte';
	import { shortStat } from '#lib/shortvol.ts';
	import { stockShare, type ShareInfo } from '#lib/share.ts';
	import { inWatchlist, toggleWatch } from '#lib/watchlist.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let code = $state('');
	/** La función de la barra («gp», «des»…), si la hay. */
	let fn = $state('');
	/** Rango del gráfico desde la barra («NVDA 1a» → ?rango=12M); sin él, el que elija TradingView. */
	let range = $state('');

	$effect(() => {
		code = (page.url.searchParams.get('sym') ?? 'NVDA').toUpperCase();
		fn = (page.url.searchParams.get('fn') ?? '').toLowerCase();
		const r = page.url.searchParams.get('rango') ?? '';
		range = isRange(r) ? r : '';
	});

	const symbol = $derived(tvSymbol(code));
	const name = $derived(TICKERS.find((t) => t.code === code)?.name ?? '');
	// Solo hay documentos de la SEC para los valores con CIK (los que cotizan en EE. UU.).
	const sec = $derived(data.sec?.data.companies[code]);
	// Titulares de todas las secciones que nombran la empresa (scripts/news-index.ts).
	const news = $derived(data.news?.data[code] ?? []);
	// «Por qué se mueve» (F19): la hora de referencia es la de los datos al construir y, ya en el navegador, la de ahora.
	let now = $state(0);
	$effect(() => {
		now = Date.now();
	});
	const fresh = $derived(recent(news, now || Date.parse(data.news?.fetchedAt ?? '') || 0).slice(0, 6));
	const quote = $derived(latestQuote(code, data.quotes));
	// Analistas, sorpresas de resultados y directivos (Finnhub; solo EE. UU. y con la clave).
	const analysis = $derived(data.analysts?.data[code]);
	// Frente a sus competidores (RV): solo los grandes valores de EE. UU. con cifras de Finnhub.
	const rv = $derived(data.rv?.metrics[code] && data.rv.peers[code] ? compareWithPeers(code, data.rv.peers[code], data.rv.metrics) : null);
	// Fondos de FONDOS que la tienen (HDS, 13F de la SEC).
	const held = $derived(data.hds?.holders[code] ?? []);

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
				<Panel title="Gráfico" meta={range ? `${symbol} · ${rangeLabel(range)}` : symbol} {share} expand={fn === 'gp' || !!range}>
					<TvWidget
						widget="advanced-chart"
						config={{ symbol, interval: rangeInterval(range), ...(range && { range }), timezone: 'Europe/Madrid', style: '1', allow_symbol_change: false, hide_side_toolbar: true }}
						height={480}
					/>
				</Panel>
			</div>
			<div class="col">
				<Panel title="Cotización">
					<TvWidget widget="symbol-info" config={{ symbol }} height={190} credit={false} />
				</Panel>
				{#if quote || fresh.length}
					<Panel title="Por qué se mueve" meta={`${WHY_HOURS} h`}>
						<p class="plain-why">{whySentence(name || code, quote?.changePct ?? null, fresh.length)}</p>
						{#if quote}
							<p class="move">
								<span class="mut">Hoy</span> <Change value={quote.changePct} unit=" %" />
								<span class="mut">· {quote.price.toLocaleString('es-ES', { maximumFractionDigits: 2 })} $</span>
							</p>
						{/if}
						{#if fresh.length}
							<NewsList items={fresh} tag={(item) => sectionLabel(item)} />
						{:else}
							<p class="empty">Ningún titular la nombra en las últimas {WHY_HOURS} h.</p>
						{/if}
						{#snippet note()}Variación de Finnhub{#if quote?.time}{' '}a las {hm(quote.time)}{/if}; titulares de todas las secciones · <Updated at={data.news?.fetchedAt} source="news-eco" />{/snippet}
					</Panel>
				{/if}
				<Panel title="Análisis técnico" expand={fn === 'ta'} jump={{ code: 'SIG', href: `${resolve('/sig')}?s=${encodeURIComponent(code)}` }}>
					<TvWidget widget="technical-analysis" config={{ symbol, interval: '1D', showIntervalTabs: true, displayMode: 'single' }} height={420} credit={false} />
				</Panel>
			</div>
		</div>
		<div class="grid grid-2e">
			<div class="col">
				<Panel title="Datos fundamentales" expand={fn === 'fa'}>
					<TvWidget widget="financials" config={{ symbol, displayMode: 'regular' }} height={560} credit={false} />
				</Panel>
			</div>
			<div class="col">
				<Panel title="Perfil de la empresa" expand={fn === 'des'}>
					<TvWidget widget="symbol-profile" config={{ symbol }} height={560} />
				</Panel>
			</div>
		</div>
		{#if analysis}
			<div class="grid">
				<div class="col">
					<Panel title="Analistas y resultados" meta="Finnhub">
						<AnalystPanel a={analysis} />
						{#snippet note()}Recomendaciones del último mes, BPA de los últimos trimestres y operaciones de directivos (formulario 4) ·
							<Updated at={analysis.fetchedAt} source="analysts" />{/snippet}
					</Panel>
				</div>
			</div>
		{/if}
		{#if rv?.peers.length}
			<div class="grid">
				<div class="col">
					<Panel title="Frente a su sector" meta="{rv.peers.length} competidores · Finnhub" jump={{ code: 'RV', href: `${resolve('/rv')}?s=${encodeURIComponent(code)}` }}>
						<RvTable rows={rv.rows} />
						{#snippet note()}En verde, mejor que la mediana de sus competidores · <Updated at={data.rv?.fetchedAt} source="perf" />{/snippet}
					</Panel>
				</div>
			</div>
		{/if}
		{#if held.length}
			<div class="grid">
				<div class="col">
					{#each held as issuer (issuer.name)}
						<Panel title="Fondos que la tienen" meta="{issuer.name} · 13F" jump={{ code: 'HDS', href: `${resolve('/hds')}?s=${encodeURIComponent(code)}` }}>
							<HoldersTable holders={issuer.holders} names={data.hds?.fundNames ?? {}} />
							{#snippet note()}Solo los fondos de FONDOS, con el retraso del 13F (hasta 45 días tras el trimestre) · Fuente: SEC EDGAR ·
								<Updated at={data.hds?.fetchedAt} source="funds" />{/snippet}
						</Panel>
					{/each}
				</div>
			</div>
		{/if}
		{#if shortStat(data.finra?.data, code)}
			<!-- Volumen en corto (FINRA): solo valores de EE. UU. -->
			<div class="grid">
				<div class="col">
					<ShortVolume data={data.finra} {code} />
				</div>
			</div>
		{/if}
		{#if news.length || fn === 'cn'}
			<div class="grid">
				<div class="col">
					<Panel title="En las noticias" meta="{news.length} {news.length === 1 ? 'titular' : 'titulares'}" expand={fn === 'cn'}>
						{#if news.length}
							<NewsList items={news} tag={(item) => sectionLabel(item)} />
						{:else}
							<p class="empty">Sin titulares que la nombren hoy.</p>
						{/if}
						{#snippet note()}Titulares de todas las secciones que nombran a {name || code} · <Updated at={data.news?.fetchedAt} source="news-eco" />{/snippet}
					</Panel>
				</div>
			</div>
		{/if}
		{#if sec?.filings.length || fn === 'sec'}
			<div class="grid">
				<div class="col">
					<Panel title="Documentos SEC" meta={sec?.name} expand={fn === 'sec'}>
						{#if sec?.filings.length}
							<FilingList items={sec.filings} strong={(form) => form.startsWith('8-K')} />
						{:else}
							<p class="empty">Sin documentos SEC: no presenta en EE. UU.</p>
						{/if}
						{#snippet note()}Fuente: SEC EDGAR · <Updated at={data.sec?.fetchedAt} source="sec" />{/snippet}
					</Panel>
				</div>
			</div>
		{/if}
	{/key}
{/if}

<style>
	.move {
		margin: 0;
		padding: var(--sp-6) var(--pad-x);
		font-family: var(--mono);
		font-size: var(--fs-s);
		border-bottom: var(--border);
	}
	.plain-why {
		display: none;
		margin: 0;
		padding: var(--sp-6) var(--pad-x);
	}
	:global([data-modo='sencillo']) .plain-why {
		display: block;
	}
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
