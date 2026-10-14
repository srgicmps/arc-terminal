<!-- MIS: tu lista de valores, guardada en este navegador, con cotizaciones en directo de TradingView. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { quotesHeight, TICKERS, tvSymbol } from '#lib/tickers.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import { madridDate } from '#lib/meetings.ts';
	import { earningsLine, myEarnings } from '#lib/myearnings.ts';
	import { deleteList, moveWatch, newList, setTape, toggleWatch, useList, watchlist } from '#lib/watchlist.svelte.ts';
	import { MAX_LISTS } from '#lib/watchlists.ts';
	import type { Mention } from '#lib/news.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Qué enseña la cinta de arriba: los índices de siempre o tu lista (como un v-model con get y set).
	const tapeSel = {
		get value() {
			return watchlist.tape ? 'mis' : 'general';
		},
		set value(v: string) {
			setTape(v === 'mis');
		}
	};

	// Resultados de los próximos 14 días de los valores de tu lista (fecha de hoy en Madrid).
	const today = $derived(madridDate(clock.now || Date.now()));
	const upcoming = $derived(myEarnings(data.finnhub?.data.earnings ?? [], watchlist.codes, today));

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

	function add(code: string) {
		if (!watchlist.codes.includes(code)) toggleWatch(code);
	}
</script>

<ViewHeader code="MIS" title="Mis valores" sub="Tu lista, guardada en este navegador · cotizaciones en directo de TradingView" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Cotizaciones" meta="{watchlist.lists[watchlist.active]?.name ?? 'Mi lista'} · {watchlist.codes.length} {watchlist.codes.length === 1 ? 'valor' : 'valores'}">
			{#if watchlist.ready && watchlist.codes.length}
				{#key watchlist.codes.join(',')}
					<TvWidget widget="market-quotes" config={quotes} height={quotesHeight(watchlist.codes.length, 220)} />
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
			{#if watchlist.ready}
				<div class="lists">
					{#if watchlist.lists.length > 1}
						<Select label="Lista" value={String(watchlist.active)} onchange={(v) => useList(Number(v))}>
							{#each watchlist.lists as l, i (i)}
								<option value={String(i)}>{l.name} · {l.codes.length}</option>
							{/each}
						</Select>
						<button type="button" class="del" onclick={deleteList}>Borrar «{watchlist.lists[watchlist.active].name}»</button>
					{/if}
					{#if watchlist.lists.length < MAX_LISTS}
						<ChipInput label="Lista nueva" placeholder="Nombre: IA, Dividendos, España…" onadd={newList} />
					{/if}
				</div>
			{/if}
			<ChipInput label="Código del valor" placeholder="Código: NVDA, SAN, BME:REP…" upper onadd={add} />
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
				<div class="tape">
					<Seg
						label="Cinta de arriba"
						options={[
							{ value: 'general', label: 'Índices' },
							{ value: 'mis', label: 'Mis valores' }
						]}
						bind:value={tapeSel.value}
					/>
				</div>
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
	.tape {
		padding: var(--row-y) var(--pad-x);
		border-top: var(--border);
	}

	.lists {
		border-bottom: var(--border);
	}

	.lists :global(label) {
		padding: var(--row-y) var(--pad-x) 0;
	}

	.del {
		margin: var(--sp-4) var(--pad-x) 0;
		padding: 0;
		background: none;
		border: 0;
		color: var(--muted);
		font: inherit;
		font-size: var(--fs-xs);
		cursor: pointer;
	}

	.del:hover {
		text-decoration: underline;
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
		min-height: var(--control-h);
		padding: 0 var(--sp-9);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.chips button:hover {
		color: var(--amber);
		border-color: var(--amber-edge);
	}
</style>
