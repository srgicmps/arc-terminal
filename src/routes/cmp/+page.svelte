<!--
	CMP: compara varios valores en un gráfico de TradingView en base 100 (/cmp?s=NVDA+AMD+AVGO).
	El primero es el principal; los demás se añaden con compareSymbols en la misma escala, que TradingView
	pasa a porcentaje: todos arrancan en 0 % el primer día del periodo y se ve cuál ha subido más.
	Los valores se leen de la URL al arrancar en el navegador (al construir la web no hay ?s=).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import { parseSymbols, TICKERS, tvSymbol } from '#lib/commands.ts';

	/** Lo que hay escrito en la casilla; se aplica al pulsar «Comparar» o Intro. */
	let text = $state('');
	let codes = $state<string[]>([]);

	$effect(() => {
		codes = parseSymbols(page.url.searchParams.get('s'));
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

	function apply(event: SubmitEvent) {
		event.preventDefault();
		const next = parseSymbols(text);
		goto(resolve('/cmp') + (next.length ? `?s=${encodeURIComponent(next.join(' '))}` : ''));
	}
</script>

<ViewHeader
	code="CMP"
	title="Comparar valores"
	sub={codes.length ? codes.map(name).join(' · ') : 'Escribe dos o más valores: NVDA AMD AVGO'}
/>

<form class="controls" onsubmit={apply}>
	<input type="text" bind:value={text} placeholder="NVDA AMD AVGO" aria-label="Valores que comparar, separados por espacios" autocapitalize="characters" spellcheck="false" />
	<button type="submit">Comparar</button>
</form>

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
		{#if codes.length === 1}
			<Note>Con un solo valor no hay con qué comparar: añade otro código.</Note>
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

	button {
		height: var(--control-h);
		padding: 0 var(--sp-14);
		background: var(--amber);
		border: 0;
		color: var(--on-amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
		letter-spacing: var(--track-code);
		cursor: pointer;
	}
</style>
