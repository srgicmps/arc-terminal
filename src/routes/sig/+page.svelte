<!--
	SIG: señales técnicas. Máximos y mínimos de 52 semanas recientes con datos propios (Finnhub, perf.json;
	src/lib/signals.ts) y, de un valor (/sig?s=NVDA), medias y RSI con el widget técnico de TradingView.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { dm, nf } from '#lib/format.ts';
	import type { Metrics } from '#lib/rv.ts';
	import { recentExtremes } from '#lib/signals.ts';
	import { TICKERS, tvSymbol } from '#lib/tickers.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Días hacia atrás que cuentan como «reciente». */
	const DAYS = 10;
	const ext = $derived(recentExtremes((data.sig?.metrics ?? {}) as Record<string, Metrics>, Date.now(), DAYS));

	const sel = urlState<string>('s', 'NVDA', (v) => v.trim().length > 0);
	const code = $derived(sel.value.trim().toUpperCase());
	const name = (c: string) => TICKERS.find((t) => t.code === c)?.name ?? c;
	const ago = (d: number) => (d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`);

	let text = $state('');
	$effect(() => {
		text = code;
	});
	function apply(event: SubmitEvent) {
		event.preventDefault();
		if (text.trim()) sel.value = text.trim().toUpperCase();
	}
</script>

<ViewHeader code="SIG" title="Señales técnicas" sub="Máximos y mínimos de 52 semanas, medias y RSI · Finnhub y TradingView" />

<div class="grid grid-2">
	<div class="col">
		{#each [{ title: 'Máximos de 52 semanas', list: ext.highs, cls: 'up' }, { title: 'Mínimos de 52 semanas', list: ext.lows, cls: 'down' }] as side (side.title)}
			<Panel title={side.title} meta="Últimos {DAYS} días · {side.list.length} {side.list.length === 1 ? 'valor' : 'valores'}">
				{#if !data.sig}
					<p class="empty">Sin datos todavía: hace falta la clave FINNHUB_API_KEY en la terminal.</p>
				{:else if !Object.keys(data.sig.metrics).length}
					<p class="empty">Sin cifras: llegan con la próxima descarga de Finnhub, una vez cada 12 horas.</p>
				{:else if side.list.length}
					<Table>
						<thead><tr><th class="l">Valor</th><th>Precio</th><th>Cuándo</th></tr></thead>
						<tbody>
							{#each side.list as e (e.code)}
								<tr>
									<td class="l name"><button type="button" class="pick" onclick={() => (sel.value = e.code)}>{e.code}</button>{#if name(e.code) !== e.code}<span class="sub">{name(e.code)}</span>{/if}</td>
									<td class={side.cls}>{nf(e.price, 2)}</td>
									<td class="mut">{ago(e.days)} · {dm(`${e.date}T12:00:00Z`)}</td>
								</tr>
							{/each}
						</tbody>
					</Table>
				{:else}
					<p class="empty">Ninguno en los últimos {DAYS} días.</p>
				{/if}
				{#snippet note()}
					Precio de cierre; unos 60 grandes valores de EE. UU. Pulsa uno para ver sus medias y su RSI. Fuente: Finnhub ·
					<Updated at={data.sig?.fetchedAt} source="perf" />
				{/snippet}
			</Panel>
		{/each}
	</div>
	<div class="col">
		<Panel title="Medias y RSI" meta="{code} · {name(code)}" jump={{ code: code || 'NVDA', href: `${resolve('/s')}?sym=${encodeURIComponent(code)}` }}>
			<form class="controls" onsubmit={apply}>
				<input type="text" bind:value={text} placeholder="NVDA" aria-label="Valor" autocapitalize="characters" spellcheck="false" />
				<button type="submit" class="go">Ver</button>
			</form>
			{#key code}
				<TvWidget widget="technical-analysis" config={{ symbol: tvSymbol(code), interval: '1D', showIntervalTabs: true, displayMode: 'multiple' }} height={520} />
			{/key}
			{#snippet note()}Resumen de 11 osciladores (RSI, MACD…) y 15 medias móviles: comprar, vender o neutral.{/snippet}
		</Panel>
	</div>
</div>

<style>
	.controls {
		display: flex;
		gap: var(--sp-8);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	input {
		flex: 1 1 120px;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--panel);
		border: var(--border);
		font-family: var(--mono);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}

	.pick {
		padding: 0;
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.pick:hover {
		color: var(--amber);
	}
</style>
