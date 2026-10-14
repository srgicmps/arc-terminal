<script lang="ts">
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
	import Search from '#lib/components/ui/Search.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { hasWords, queryWords } from '#lib/search.ts';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { dm, longDay } from '#lib/format.ts';
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

	// Filtra por palabras sueltas en el título, el ministerio o el epígrafe.
	const words = $derived(queryWords(query));
	const sections = $derived(
		(boe?.sections ?? []).map((s) => ({
			...s,
			items: s.items.filter((i) => hasWords(`${i.title} ${i.dept} ${i.epigraph}`, words))
		}))
	);
	onMount(initWatchwords);
	// Las disposiciones que nombran alguna palabra vigilada salen arriba, en su propio panel.
	const hits = $derived(watched(boe, watchwords.words));

	const shown = $derived(sections.reduce((n, s) => n + s.items.length, 0));
	const listed = $derived((boe?.sections ?? []).reduce((n, s) => n + s.items.length, 0));
	const total = $derived((boe?.sections ?? []).reduce((n, s) => n + s.total, 0));

	// Diario Oficial de la UE (serie L): filtro por tema, solo con los temas que hay.
	const eu = $derived(data.eurlex?.data ?? []);
	let tag = $state('');
	const tags = $derived([
		{ value: '', label: 'Todo' },
		...[...new Set(eu.flatMap((d) => d.tags))].sort().map((t) => ({ value: t, label: t }))
	]);
	const euShown = $derived((tag ? eu.filter((d) => d.tags.includes(tag)) : eu).slice(0, 40));

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
		<Search label="Buscar en el BOE de hoy" placeholder="Buscar: ayudas, Menorca, oposiciones, Hacienda…" bind:value={query} />
		{#if words.length}<span class="count">{shown} de {listed}</span>{/if}
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
				<ChipInput label="Añadir una palabra vigilada" placeholder="Añadir palabra…" items={watchwords.words} onadd={addWatchword} onremove={removeWatchword} />
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
							{#if s.items.length < s.total && !words.length}
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

{#if eu.length}
	<div class="grid eu">
		<div class="col">
			<Panel title="Diario Oficial de la UE · serie L" meta="Reglamentos, directivas y decisiones">
				{#if tags.length > 1}
					<div class="tags"><Seg label="Tema" options={tags} bind:value={tag} /></div>
				{/if}
				<ol class="boe">
					{#each euShown as d (d.id)}
						<li>
							<a class="title" href={d.url} target="_blank" rel="noopener">{d.title}</a>
							<p class="m">
								<span>{d.type}</span>
								{#each d.tags as t (t)}<span class="tag">{t}</span>{/each}
								<span>{dm(`${d.date}T12:00:00Z`)}</span>
								<span class="id">{d.id}</span>
							</p>
						</li>
					{/each}
				</ol>
				{#snippet note()}
					Títulos oficiales en inglés; la ficha se abre en español. Fuente: EUR-Lex, © Unión Europea ·
					<Updated at={data.eurlex?.fetchedAt} source="eurlex" />
				{/snippet}
			</Panel>
		</div>
	</div>
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

	.eu {
		margin-top: var(--sp-16);
	}

	.tags {
		padding: var(--sp-8) var(--pad-x);
		border-bottom: var(--border);
	}

	.m .tag {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
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
