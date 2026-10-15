<!--
	El mundo (app Sencilla): lo más importante de hoy (IMP) en grande y, debajo, las últimas historias de cada tema.
	Arriba, unas pastillas para quedarse con un tema.
-->
<script lang="ts">
	import Section from '#lib/components/sencillo/Section.svelte';
	import Stories from '#lib/components/sencillo/Stories.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const NAMES: Record<string, string> = { geo: 'Mundo', eco: 'Economía', es: 'España', tech: 'Tecnología', ai: 'Inteligencia artificial', ws: 'Bolsa' };
	let topic = $state<string | null>(null);
	const shown = $derived(data.sections.filter((s) => s.stories.length && (!topic || s.key === topic)));
</script>

<svelte:head>
	<title>Arc · El mundo</title>
</svelte:head>

<h1>El mundo</h1>

<div class="pills" role="group" aria-label="Temas" data-noswipe>
	<button type="button" aria-pressed={topic === null} onclick={() => (topic = null)}>Todo</button>
	{#each data.sections.filter((s) => s.stories.length) as s (s.key)}
		<button type="button" aria-pressed={topic === s.key} onclick={() => (topic = s.key)}>{NAMES[s.key]}</button>
	{/each}
</div>

<div class="stack">
	{#if !topic && data.important.length}
		<Section title="Lo más importante de hoy" icon="news">
			<Stories stories={data.important} big />
		</Section>
	{/if}
	{#each shown as s (s.key)}
		<Section title={NAMES[s.key]}>
			<Stories stories={s.stories} label={false} />
		</Section>
	{/each}
	{#if !data.important.length && !shown.length}<p class="mut">Aún no hay noticias. Vuelve en unos minutos.</p>{/if}
</div>

<style>
	h1 {
		margin: 0 0 var(--sp-12);
		font-size: var(--app-fs-h1);
	}

	.pills {
		display: flex;
		gap: var(--sp-8);
		overflow-x: auto;
		scrollbar-width: none;
		margin: 0 calc(-1 * var(--sp-16)) var(--sp-16);
		padding: 0 var(--sp-16);
	}

	.pills button {
		flex: none;
		min-height: var(--touch);
		padding: 0 var(--sp-16);
		border: var(--border);
		border-radius: var(--app-radius-pill);
		background: var(--panel);
		color: var(--fg);
		font: inherit;
		font-size: var(--app-fs-small);
		cursor: pointer;
	}

	.pills button[aria-pressed='true'] {
		background: var(--amber);
		border-color: var(--amber);
		color: var(--on-amber);
	}

	.stack {
		display: grid;
		gap: var(--sp-16);
	}

	@media (min-width: 900px) {
		.stack {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}

	.mut {
		color: var(--muted);
	}
</style>
