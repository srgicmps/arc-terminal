<!-- GEO · Mapa, fijado en TOP. Los puntos llegan ya calculados (data/pin/geo-mapa.json). -->
<script lang="ts">
	import WorldMap from '#lib/components/WorldMap.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { LAYERS, type LayerId, type MapPoint } from '#lib/geo/layers.ts';
	import type { PinProps } from '#lib/pins.ts';

	let { data }: PinProps = $props();

	const layers = $derived((data['pin/geo-mapa']?.data ?? {}) as Partial<Record<LayerId, MapPoint[]>>);
	const available = $derived(LAYERS.filter((l) => layers[l.value]?.length));
	let on = $state<LayerId[]>(LAYERS.map((l) => l.value));
	const points = $derived(available.filter((l) => on.includes(l.value)).flatMap((l) => layers[l.value] ?? []));
</script>

{#if available.length > 1}
	<div class="layers"><Seg label="Capas del mapa" options={available} bind:values={on} /></div>
{/if}
<WorldMap {points} legend={available} />

<style>
	.layers {
		padding: var(--sp-8) var(--pad-x) 0;
	}
</style>
