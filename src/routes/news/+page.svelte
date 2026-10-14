<script lang="ts">
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { NEWS_SECTIONS as SECTIONS } from '#lib/news.ts';
	import Seg from '#lib/components/ui/Seg.svelte';
	import type { ArchiveEntry, NewsItem } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let section = $state<string>('all');

	// «NEWS inflación» en la barra abre /news?q=inflación y rellena el buscador (solo en el navegador).
	$effect(() => {
		query = page.url.searchParams.get('q') ?? '';
	});

	const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

	const filtered = $derived.by(() => {
		const words = norm(query).split(/\s+/).filter(Boolean);
		return data.items.filter(
			(i) =>
				(section === 'all' || i.section === section) &&
				words.every((w) => norm(`${i.title} ${i.summary} ${i.source}`).includes(w))
		);
	});

	// Archivo de 3 meses (scripts/sources/archive.ts): cada mes es un JSON aparte que solo se pide al
	// buscar algo de 3 letras o más, del mes más reciente al más antiguo. Se guarda ya normalizado.
	const MIN = 3;
	const words = $derived(norm(query).split(/\s+/).filter(Boolean));
	const searching = $derived(words.join('').length >= MIN);
	// $state.raw (como shallowRef en Vue): son miles de titulares y no hace falta que cada uno sea reactivo.
	let archive = $state.raw<Record<string, { e: ArchiveEntry; key: string }[]>>({});
	let failed = $state(false);
	let busy = false;

	async function loadArchive() {
		if (busy) return;
		busy = true;
		for (const { month } of data.months) {
			if (archive[month]) continue;
			try {
				const res = await fetch(asset(`data/news-archive/${month}.json` as Parameters<typeof asset>[0]));
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const list = (await res.json()) as ArchiveEntry[];
				archive = { ...archive, [month]: list.map((e) => ({ e, key: norm(`${e.t} ${e.s}`) })) };
			} catch {
				failed = true;
				break;
			}
		}
		busy = false;
	}

	$effect(() => {
		if (searching) loadArchive();
	});

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
	<input type="search" bind:value={query} placeholder="Buscar: Lagarde, aranceles, Menorca, Nvidia…" aria-label="Buscar en los titulares" />
	<Seg label="Sección" options={[{ value: 'all', label: 'Todas' }, ...SECTIONS.map((s) => ({ value: s.key, label: s.label }))]} bind:value={section} />
</div>

<div class="grid">
	<div class="col">
		<Panel title="Resultados" meta="{filtered.length} titulares">
			<NewsList items={filtered.slice(0, 150)} summaries tag={(i) => label[sectionOf.get(i.url) ?? '']} />
		</Panel>
		{#if searching && data.months.length}
			<Panel
				title="En el archivo"
				meta={loaded < data.months.length && !failed
					? `Cargando ${loaded + 1} de ${data.months.length} meses…`
					: `${archived.length} titulares`}
			>
				<NewsList items={archived.slice(0, 150)} />
				{#if !archived.length && loaded}<p class="empty">Nada más en los últimos {data.months.length} meses.</p>{/if}
				{#snippet note()}
					Los titulares de los últimos 3 meses (de todas las secciones; el filtro de sección no se aplica aquí){failed
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

	input {
		flex: 1 1 280px;
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
</style>
