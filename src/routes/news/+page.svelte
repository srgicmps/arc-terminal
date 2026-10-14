<script lang="ts">
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { NEWS_SECTIONS as SECTIONS } from '#lib/news.ts';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Search from '#lib/components/ui/Search.svelte';
	import { fold, hasWords, MIN_QUERY, queryWords } from '#lib/search.ts';
	import type { ArchiveEntry, NewsItem } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let section = $state<string>('all');

	// «NEWS inflación» en la barra abre /news?q=inflación y rellena el buscador (solo en el navegador).
	$effect(() => {
		query = page.url.searchParams.get('q') ?? '';
		// «Titulares › NEWS» de cada vista abre /news?s=eco con esa sección elegida.
		const s = page.url.searchParams.get('s');
		section = SECTIONS.some((x) => x.key === s) ? s! : 'all';
	});

	const words = $derived(queryWords(query));
	const inSection = $derived(data.items.filter((i) => section === 'all' || i.section === section));
	const filtered = $derived(inSection.filter((i) => hasWords(`${i.title} ${i.summary} ${i.source}`, words)));

	// Archivo de 3 meses (scripts/sources/archive.ts): cada mes es un JSON aparte (de 1 a 2 MB, unos
	// 700 KB con gzip) que solo se pide al buscar algo de 3 letras o más. Primero el mes en curso; los
	// anteriores, de uno en uno con el botón. Se guarda ya normalizado.
	const searching = $derived(words.join('').length >= MIN_QUERY);
	// $state.raw (como shallowRef en Vue): son miles de titulares y no hace falta que cada uno sea reactivo.
	let archive = $state.raw<Record<string, { e: ArchiveEntry; key: string }[]>>({});
	let failed = $state(false);
	let wanted = $state(1);
	let busy = false;

	async function loadArchive() {
		if (busy) return;
		busy = true;
		for (const { month } of data.months.slice(0, wanted)) {
			if (archive[month]) continue;
			try {
				const res = await fetch(asset(`data/news-archive/${month}.json` as Parameters<typeof asset>[0]));
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const list = (await res.json()) as ArchiveEntry[];
				archive = { ...archive, [month]: list.map((e) => ({ e, key: fold(`${e.t} ${e.s}`) })) };
			} catch {
				failed = true;
				break;
			}
		}
		busy = false;
	}

	$effect(() => {
		if (searching && wanted) loadArchive();
	});

	const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' });
	const monthName = (month: string) => MONTH.format(new Date(`${month}-15T12:00:00Z`));

	const loaded = $derived(data.months.filter((m) => archive[m.month]).length);
	// Lo del archivo que no está ya en los titulares de ahora, del más nuevo al más antiguo.
	const archived = $derived.by((): NewsItem[] => {
		if (!searching) return [];
		const now = new Set(data.items.map((i) => i.url));
		return data.months
			.flatMap((m) => archive[m.month] ?? [])
			.filter(({ e, key }) => !now.has(e.u) && words.every((w) => key.includes(w)))
			.map(({ e }) => ({ title: e.t, url: e.u, source: e.s, time: e.d, summary: '' }));
	});

	const label = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label.toUpperCase()]));
	const sectionOf = $derived(new Map(data.items.map((i) => [i.url, i.section])));
</script>

<ViewHeader code="NEWS" title="Buscador de titulares" sub="{data.items.length} titulares de todas las secciones, los más recientes primero" />

<div class="controls">
	<Search label="Buscar en los titulares" placeholder="Buscar: Lagarde, aranceles, Menorca, Nvidia…" bind:value={query} />
	<Seg label="Sección" options={[{ value: 'all', label: 'Todas' }, ...SECTIONS.map((s) => ({ value: s.key, label: s.label }))]} bind:value={section} />
</div>

<div class="grid">
	<div class="col">
		<Panel title="Resultados" meta={words.length ? `${filtered.length} de ${inSection.length}` : `${filtered.length} titulares`}>
			<NewsList items={filtered.slice(0, 150)} summaries tag={(i) => label[sectionOf.get(i.url) ?? '']} />
		</Panel>
		{#if searching && data.months.length}
			<Panel
				title="En el archivo"
				meta={loaded < wanted && !failed ? 'Cargando…' : `${archived.length} ${archived.length === 1 ? 'titular' : 'titulares'}`}
			>
				{#if archived.length}<NewsList items={archived.slice(0, 150)} />{/if}
				{#if !archived.length && loaded >= wanted}<p class="empty">Nada más hasta {monthName(data.months[loaded - 1].month)}.</p>{/if}
				{#if loaded >= wanted && wanted < data.months.length && !failed}
					<button class="more" type="button" onclick={() => wanted++}>Buscar también en {monthName(data.months[wanted].month)}</button>
				{/if}
				{#snippet note()}
					Desde {monthName(data.months[Math.max(loaded, 1) - 1].month)} hasta hoy (de todas las secciones; el filtro de sección no se aplica aquí){failed
						? ' · No se ha podido cargar todo el archivo'
						: ''}.
				{/snippet}
			</Panel>
		{/if}
	</div>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8) var(--sp-12);
		margin-bottom: var(--sp-12);
	}

	.more {
		display: block;
		width: 100%;
		padding: var(--row-y) var(--pad-x);
		border: 0;
		border-top: var(--border);
		background: none;
		color: var(--amber);
		font-family: var(--sans);
		font-size: var(--fs-s);
		text-align: left;
		cursor: pointer;
	}

	.more:hover {
		background: var(--amber-soft);
	}
</style>
