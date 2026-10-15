<!--
	GLOBO: el mapa de GEO y la Sala de control en un globo 3D que gira. Arrastra para girarlo, rueda o pellizco
	para acercar, toca un punto para su ficha. El dibujo se carga solo aquí (Globe.svelte).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Globe from '#lib/components/Globe.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { GLOBE_LAYERS } from '#lib/geo/globe.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const available = $derived(GLOBE_LAYERS.filter((l) => data.points.some((p) => p.layer === l.value)));
	let on = $state<string[]>(GLOBE_LAYERS.map((l) => l.value));
	const points = $derived(data.points.filter((p) => on.includes(p.layer)));
</script>

<ViewHeader code="GLOBO" title="Globo" sub="Lo que pasa en el mundo, en 3D: arrastra para girarlo y toca un punto" />

<Panel title="Globo" meta="Arrastra para girarlo · toca un punto para ver su ficha">
	<section class="stage">
		{#if available.length > 1}
			<div class="layers"><Seg label="Capas del globo" options={available} bind:values={on} /></div>
		{/if}
		<Globe {points} legend={available} />
		<p class="foot">
			<a href={resolve('/geo')}>Mapa plano en GEO ›</a>
			<a href={resolve('/x/sala')}>Sala de control ›</a>
			{#if data.fetchedAt}<Updated at={data.fetchedAt} />{/if}
		</p>
	</section>
</Panel>

<style>
	.stage {
		display: grid;
		gap: var(--sp-8);
		padding: var(--sp-8) var(--pad-x);
	}

	.layers {
		overflow-x: auto;
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-16);
		justify-content: center;
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--muted);
	}

	.foot a {
		color: var(--amber);
		text-decoration: none;
	}
</style>
