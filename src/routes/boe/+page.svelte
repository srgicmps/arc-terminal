<script lang="ts">
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { longDay } from '#lib/format.ts';
	import type { BoeItem } from '#lib/types.ts';
	import { addWatchword, highlight, initWatchwords, removeWatchword, watched, watchwords } from '#lib/watchwords.svelte.ts';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const boe = $derived(data.boe?.data);
	let query = $state('');

	// «BOE vivienda» en la barra abre /boe?q=vivienda y rellena el buscador (solo en el navegador).
	$effect(() => {
		query = page.url.searchParams.get('q') ?? '';
	});

	const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

	// Filtra por texto en el título, el ministerio o el epígrafe.
	const sections = $derived.by(() => {
		const q = norm(query.trim());
		return (boe?.sections ?? []).map((s) => ({
			...s,
			items: q
				? s.items.filter((i) => norm(`${i.title} ${i.dept} ${i.epigraph}`).includes(q))
				: s.items
		}));
	});
	onMount(initWatchwords);
	let newWord = $state('');
	// Las disposiciones que nombran alguna palabra vigilada salen arriba, en su propio panel.
	const hits = $derived(watched(boe, watchwords.words));

	function add(event: SubmitEvent) {
		event.preventDefault();
		addWatchword(newWord);
		newWord = '';
	}

	const shown = $derived(sections.reduce((n, s) => n + s.items.length, 0));
	const total = $derived((boe?.sections ?? []).reduce((n, s) => n + s.total, 0));

	/** «JEFATURA DEL ESTADO» → «Jefatura del Estado» */
	const dept = (s: string) =>
		s === s.toUpperCase()
			? s
					.toLowerCase()
					.replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase())
					.replace(/\b(De|Del|La|Las|Los|El|Y|E|Para|Con|En)\b/g, (w) => w.toLowerCase())
			: s;
</script>

<ViewHeader
	code="BOE"
	title="Boletín Oficial del Estado"
	sub={boe ? `Núm. ${boe.number} · ${longDay(`${boe.date}T12:00:00Z`)} · ${total} disposiciones y anuncios` : 'API de datos abiertos del BOE'}
>
	{#snippet aside()}
		{#if boe?.pdf}<a class="pdf" href={boe.pdf} target="_blank" rel="noopener">Sumario en PDF ›</a>{/if}
	{/snippet}
</ViewHeader>

{#if !boe}
	<p class="empty">Sin datos todavía.</p>
{:else}
	<div class="search">
		<label>
			<span class="sr">Buscar en el BOE de hoy</span>
			<input type="search" bind:value={query} placeholder="Buscar: ayudas, Menorca, oposiciones, Hacienda…" />
		</label>
		<span class="count">{shown} {shown === 1 ? 'resultado' : 'resultados'}</span>
	</div>

	{#snippet entry(item: BoeItem)}
		<li>
			<a class="title" href={item.html || item.pdf} target="_blank" rel="noopener">
				{#each highlight(item.title, watchwords.words) as part, i (i)}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}
			</a>
			<p class="m">
				<span>{dept(item.dept)}</span>
				{#if item.epigraph}<span>{item.epigraph}</span>{/if}
				<span class="id">{item.id}</span>
				{#if item.pdf}<a href={item.pdf} target="_blank" rel="noopener">PDF</a>{/if}
			</p>
		</li>
	{/snippet}

	<div class="grid">
		<div class="col">
			<Panel title="Palabras vigiladas" meta={hits.length === 1 ? '1 coincidencia' : `${hits.length} coincidencias`}>
				<form class="words" onsubmit={add}>
					{#each watchwords.words as w (w)}
						<button type="button" class="word" onclick={() => removeWatchword(w)} aria-label="Dejar de vigilar «{w}»">
							{w} <span aria-hidden="true">×</span>
						</button>
					{/each}
					<label>
						<span class="sr">Añadir una palabra vigilada</span>
						<input bind:value={newWord} placeholder="Añadir palabra…" enterkeyhint="done" />
					</label>
				</form>
				{#if hits.length}
					<ol class="boe">
						{#each hits as item (item.id)}{@render entry(item)}{/each}
					</ol>
				{/if}
				{#snippet note()}Sin tildes ni mayúsculas y por palabra entera. Se guardan solo en este navegador.{/snippet}
			</Panel>
		</div>
	</div>

	<div class="grid">
		{#each sections as s (s.code)}
			{#if s.items.length}
				<div class="col">
					<Panel title={s.name} meta={s.items.length < s.total ? `${s.items.length} de ${s.total}` : `${s.total}`}>
						<ol class="boe">
							{#each s.items as item (item.id)}{@render entry(item)}{/each}
						</ol>
						{#snippet note()}
							{#if s.items.length < s.total && !query}
								Solo se muestran los primeros {s.items.length}: el resto, en el sumario en PDF.
							{/if}
						{/snippet}
					</Panel>
				</div>
			{/if}
		{/each}
	</div>
	<p class="foot">Fuente: Agencia Estatal Boletín Oficial del Estado · <Updated at={data.boe?.fetchedAt} source="boe" /></p>
{/if}

<style>
	.pdf {
		color: var(--amber);
		text-decoration: none;
	}

	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-12);
		margin-bottom: var(--sp-12);
	}

	.search label {
		flex: 1;
	}

	input {
		width: 100%;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--panel);
		border: var(--border);
		font-family: var(--sans);
		font-size: var(--fs-l);
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}

	.count {
		color: var(--faint);
		font-size: var(--fs-xs);
		white-space: nowrap;
	}

	.grid {
		gap: 0;
	}

	.col + .col {
		border-top: var(--border);
	}

	.boe {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.boe li {
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	.boe li:last-child {
		border-bottom: 0;
	}

	.title {
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-snug);
		text-wrap: pretty;
	}

	.title:hover {
		color: var(--amber);
	}

	.m {
		margin: var(--sp-4) 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2) var(--sp-10);
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.m .id {
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.m a {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		text-decoration: none;
	}

	.words {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5em;
		padding: 0.75em 1em;
		border-bottom: var(--border);
	}

	.words label {
		flex: 1;
		min-width: 10em;
	}

	.word {
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--amber);
		background: var(--amber-soft);
		border: var(--hair) solid var(--amber-edge);
		padding: 0.2em 0.6em;
		cursor: pointer;
	}

	.word:hover {
		border-color: var(--amber);
	}

	mark {
		color: var(--amber);
		background: var(--amber-soft);
	}

	.foot {
		margin: var(--sp-8) 0 0;
		color: var(--faint);
		font-size: var(--fs-xs);
	}
</style>
