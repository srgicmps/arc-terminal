<!--
	Ficha de un valor: /s?sym=NVDA. Todo llega en directo de TradingView en el navegador.
	El símbolo se lee de la URL al arrancar en el navegador (al construir la web no hay URL con ?sym=).
-->
<script lang="ts">
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { TICKERS, tvSymbol } from '#lib/commands.ts';

	let code = $state('');

	$effect(() => {
		code = (page.url.searchParams.get('sym') ?? 'NVDA').toUpperCase();
	});

	const symbol = $derived(tvSymbol(code));
	const name = $derived(TICKERS.find((t) => t.code === code)?.name ?? '');
</script>

<ViewHeader code={code || '…'} title={name || 'Ficha del valor'} sub="Cotización, gráfico y datos en directo · TradingView" />

{#if code}
	{#key symbol}
		<div class="grid grid-2">
			<div class="col">
				<Panel title="Gráfico" meta={symbol}>
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
	{/key}
{/if}
