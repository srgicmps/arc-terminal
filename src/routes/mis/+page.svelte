<!-- MIS: tu lista de valores, guardada en este navegador, con cotizaciones en directo de TradingView. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { TICKERS, tvSymbol } from '#lib/commands.ts';
	import { moveWatch, toggleWatch, watchlist } from '#lib/watchlist.svelte.ts';

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
