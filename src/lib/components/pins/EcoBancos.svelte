<!-- ECO · Bancos centrales, fijado en TOP. -->
<script lang="ts">
	import SeriesTable from '#lib/components/SeriesTable.svelte';
	import type { PinProps } from '#lib/pins.ts';
	import type { SeriesData } from '#lib/types.ts';

	let { data }: PinProps = $props();
	const bis = $derived((data.bis?.data as SeriesData | undefined)?.series ?? []);
</script>

<SeriesTable head="Banco" rows={bis.map((series) => ({ series, name: series.label, decimals: 2 }))} />
