<script lang="ts">
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { dm, longDay } from '#lib/format.ts';
	import { dayData } from '#lib/boe.ts';
	import { EU_SHOWN } from '#lib/trim.ts';
	import type { BoeData, BoeItem, BoeWeek } from '#lib/types.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';
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

	// Hoy o la semana (?vista=semana). La semana (boe-week.json, unos días de sumarios) solo se pide al elegirla.
	const views = [
		{ value: 'hoy', label: 'Hoy' },
		{ value: 'semana', label: 'Semana' }
	] as const;
	const view = urlState<'hoy' | 'semana'>('vista', 'hoy', (v) => v === 'hoy' || v === 'semana');
	// $state.raw (como shallowRef en Vue): se reemplaza entera y no hace falta que cada disposición sea reactiva.
	let week = $state.raw<BoeData[] | null>(null);
	let weekFailed = $state(false);
	$effect(() => {
		if (view.value !== 'semana' || week || weekFailed) return;
		fetch(asset('data/boe-week.json' as Parameters<typeof asset>[0]))
			.then((res) => (res.ok ? (res.json() as Promise<BoeWeek>) : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then((w) => (week = w.days.map(dayData)))
			.catch(() => (weekFailed = true));
	});
	const weekly = $derived(view.value === 'semana');

	// Las disposiciones que nombran alguna palabra vigilada salen arriba, en su propio panel: las de hoy o,
	// en «Semana», las de cada día (con su fecha).
	const hits = $derived(
		weekly
			? (week ?? []).flatMap((d) => watched(d, watchwords.words).map((item) => ({ item, date: d.date })))
			: watched(boe, watchwords.words).map((item) => ({ item, date: '' }))
	);

	// «Semana»: un panel por día. Sin búsqueda, solo las disposiciones generales (sección I), para no pintar
	// más de mil filas; con búsqueda, todo lo que coincida.
	const days = $derived.by(() => {
		const q = norm(query.trim());
		return (week ?? []).map((d) => ({
			date: d.date,
			items: d.sections
				.filter((s) => q || s.code === '1')
				.flatMap((s) => s.items)
				.filter((i) => !q || norm(`${i.title} ${i.dept} ${i.epigraph}`).includes(q))
		}));
	});

	function add(event: SubmitEvent) {
		event.preventDefault();
		addWatchword(newWord);
		newWord = '';
	}

	const shown = $derived(
		weekly ? days.reduce((n, d) => n + d.items.length, 0) : sections.reduce((n, s) => n + s.items.length, 0)
	);
	const total = $derived((boe?.sections ?? []).reduce((n, s) => n + s.total, 0));

	// Diario Oficial de la UE (serie L): filtro por tema, solo con los temas que hay.
	const eu = $derived(data.eurlex?.data ?? []);
	let tag = $state('');
	const tags = $derived([
		{ value: '', label: 'Todo' },
		...[...new Set(eu.flatMap((d) => d.tags))].sort().map((t) => ({ value: t, label: t }))
	]);
	const euShown = $derived((tag ? eu.filter((d) => d.tags.includes(tag)) : eu).slice(0, EU_SHOWN));

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
	<div class="views"><Seg label="Periodo" options={views} bind:value={view.value} /></div>

	<div class="search">
		<label>
			<span class="sr">{weekly ? 'Buscar en el BOE de la semana' : 'Buscar en el BOE de hoy'}</span>
			<input type="search" bind:value={query} placeholder="Buscar: ayudas, Menorca, oposiciones, Hacienda…" />
		</label>
		<span class="count">{shown} {shown === 1 ? 'resultado' : 'resultados'}</span>
	</div>

	{#snippet entry(item: BoeItem, date = '')}
		<li>
			<a class="title" href={item.html || item.pdf} target="_blank" rel="noopener">
				{#each highlight(item.title, watchwords.words) as part, i (i)}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}
			</a>
			<p class="m">
				{#if date}<span class="day">{dm(`${date}T12:00:00Z`)}</span>{/if}
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
						{#each hits as { item, date } (item.id)}{@render entry(item, date)}{/each}
					</ol>
				{/if}
				{#snippet note()}Sin tildes ni mayúsculas y por palabra entera{weekly ? ', en los últimos 7 días' : ''}. Se guardan solo
					en este navegador.{/snippet}
			</Panel>
		</div>
	</div>

	{#if weekly}
		{#if weekFailed}
			<p class="empty">No se ha podido cargar la semana.</p>
		{:else if !week}
			<p class="empty">Cargando la semana…</p>
		{:else}
			<div class="grid">
				{#each days as d (d.date)}
					{#if d.items.length}
						<div class="col">
							<Panel title={longDay(`${d.date}T12:00:00Z`)} meta={query ? `${d.items.length}` : `Disposiciones generales · ${d.items.length}`}>
								<ol class="boe">
									{#each d.items as item (item.id)}{@render entry(item)}{/each}
								</ol>
							</Panel>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	{:else}
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
	{/if}
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

	.views {
		margin-bottom: var(--sp-8);
	}

	.m .day {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
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
