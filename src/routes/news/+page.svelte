<script lang="ts">
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { NEWS_SECTIONS as SECTIONS } from '#lib/news.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let query = $state('');
	let section = $state<string>('all');

	const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

	const filtered = $derived.by(() => {
		const words = norm(query).split(/\s+/).filter(Boolean);
		return data.items.filter(
			(i) =>
				(section === 'all' || i.section === section) &&
				words.every((w) => norm(`${i.title} ${i.summary} ${i.source}`).includes(w))
		);
	});

	const label = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label.toUpperCase()]));
	const sectionOf = $derived(new Map(data.items.map((i) => [i.url, i.section])));
</script>

<ViewHeader code="NEWS" title="Buscador de titulares" sub="{data.items.length} titulares de todas las secciones, los más recientes primero" />

<div class="controls">
	<input type="search" bind:value={query} placeholder="Buscar: Lagarde, aranceles, Menorca, Nvidia…" aria-label="Buscar en los titulares" />
	<div class="seg" role="group" aria-label="Sección">
		<button type="button" aria-pressed={section === 'all'} onclick={() => (section = 'all')}>Todas</button>
		{#each SECTIONS as s (s.key)}
			<button type="button" aria-pressed={section === s.key} onclick={() => (section = s.key)}>{s.label}</button>
		{/each}
	</div>
</div>

<div class="grid">
	<div class="col">
		<Panel title="Resultados" meta="{filtered.length} titulares">
			<NewsList items={filtered.slice(0, 150)} summaries tag={(i) => label[sectionOf.get(i.url) ?? '']} />
		</Panel>
	</div>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		margin-bottom: 12px;
	}

	input {
		flex: 1 1 280px;
		height: 32px;
		padding: 0 10px;
		background: var(--panel);
		border: 1px solid var(--line);
		font-family: var(--sans);
		font-size: var(--fs-l);
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}

	.seg {
		display: inline-flex;
		flex-wrap: wrap;
		border: 1px solid var(--line);
	}

	.seg button {
		background: none;
		border: 0;
		padding: 5px 10px;
		cursor: pointer;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.seg button[aria-pressed='true'] {
		background: var(--amber);
		color: var(--on-amber);
		font-weight: 500;
	}
</style>
