<!--
	CMP: compara varios valores en un gráfico de TradingView en base 100 (/cmp?s=NVDA+AMD+AVGO).
	El primero es el principal; los demás se añaden con compareSymbols en la misma escala, que TradingView
	pasa a porcentaje: todos arrancan en 0 % el primer día del periodo y se ve cuál ha subido más.
	Los valores se leen de la URL al arrancar en el navegador (al construir la web no hay ?s=).
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { parseSymbols, PERF_PERIODS } from '#lib/cmp.ts';
	import { TICKERS, tvSymbol } from '#lib/tickers.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Los valores van en la URL (?s=NVDA AMD AVGO), como el combustible en FUEL: se puede compartir el enlace.
	// Un ?s= sin ningún código que valga se quita de la URL.
	const sel = urlState<string>('s', '', (v) => parseSymbols(v).length > 0);
	const codes = $derived(parseSymbols(sel.value));

	/** Lo que hay escrito en la casilla; se aplica al pulsar «Comparar» o Intro. */
	let text = $state('');
	// La casilla enseña los valores de la URL cada vez que cambian.
	$effect(() => {
		text = codes.join(' ');
	});

	const name = (code: string) => TICKERS.find((t) => t.code === code)?.name ?? code;

	// Gráfico diario de un año: el primero es el principal, el resto se compara en la misma escala.
	const config = $derived({
		symbol: tvSymbol(codes[0] ?? 'NVDA'),
		compareSymbols: codes.slice(1).map((c) => ({ symbol: tvSymbol(c), position: 'SameScale' })),
		interval: 'D',
		range: '12M',
		timezone: 'Europe/Madrid',
		style: '2',
		allow_symbol_change: false,
		hide_side_toolbar: true
	});

	const rows = $derived(codes.map((c) => ({ code: c, r: data.perf?.data.symbols[c] })));
	const columns = $derived(PERF_PERIODS.filter(([k]) => rows.some((row) => row.r?.[k] !== undefined)));

	function apply(event: SubmitEvent) {
		event.preventDefault();
		sel.value = parseSymbols(text).join(' ');
	}
</script>

<ViewHeader
	code="CMP"
	title="Comparar valores"
	sub={codes.length ? codes.map(name).join(' · ') : 'Escribe dos o más valores: NVDA AMD AVGO'}
/>

<form class="controls" onsubmit={apply}>
	<input type="text" bind:value={text} placeholder="NVDA AMD AVGO" aria-label="Valores que comparar, separados por espacios" autocapitalize="characters" spellcheck="false" />
	<button type="submit" class="go">Comparar</button>
</form>
{#if codes.length === 1}
	<Note>Con un solo valor no hay con qué comparar: añade otro código.</Note>
{/if}

<div class="grid">
	<div class="col">
		<Panel title="Rentabilidad comparada" meta={codes.length ? `${codes.join(' · ')} · 1 año` : 'Hasta 5 valores'}>
			{#if codes.length}
				{#key config}
					<TvWidget widget="advanced-chart" {config} height={520} />
				{/key}
			{:else}
				<p class="empty">Escribe los códigos de los valores, separados por espacios, y pulsa «Comparar».</p>
			{/if}
		</Panel>
		{#if data.perf && columns.length}
			{@const perf = data.perf}
			<Panel title="Rentabilidad" meta="Variación del precio · %">
				<Table>
					<thead>
						<tr>
							<th class="l">Valor</th>
							{#each columns as [k, label] (k)}<th>{label}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.code)}
							<tr>
								<td class="l name">{row.code}{#if name(row.code) !== row.code}<span class="sub">{name(row.code)}</span>{/if}</td>
								{#each columns as [k] (k)}
									<td><Change value={row.r?.[k]} digits={1} unit=" %" /></td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}
					Al cierre del último día, solo grandes valores de EE. UU. (— si no está). Fuente: Finnhub ·
					<Updated at={perf.fetchedAt} source="perf" />
				{/snippet}
			</Panel>
		{/if}
	</div>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		margin-bottom: var(--sp-12);
	}

	input {
		flex: 1 1 240px;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--panel);
		border: var(--border);
		font-family: var(--mono);
		font-size: var(--fs-l);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}
</style>
