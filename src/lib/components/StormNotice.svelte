<!-- Aviso de tormenta solar (NOAA SWPC). Solo aparece con una tormenta geomagnética G3 o más, ahora o
     prevista; si no, no ocupa nada. Lo usan WX y GEO. -->
<script lang="ts">
	import { dm, nf } from '#lib/format.ts';
	import { G_LABEL, stormLevel } from '#lib/space.ts';
	import type { SwpcData } from '#lib/types.ts';

	let { data }: { data: SwpcData | null | undefined } = $props();

	/** A partir de G3 (fuerte) hay auroras a latitudes medias y puede haber problemas en GPS y redes eléctricas. */
	const MIN = 3;
	const storm = $derived(stormLevel(data));
</script>

{#if storm && storm.level >= MIN}
	<aside class="storm" role="status">
		<b>Tormenta solar G{storm.level} · {G_LABEL[storm.level]}</b>
		<span>
			{#if storm.upcoming}
				Prevista{storm.forecastDate ? ` para el ${dm(`${storm.forecastDate}T12:00:00Z`)}` : ''}
			{:else}
				Ahora
			{/if}
			{#if data?.kp !== null && data?.kp !== undefined}· Kp {nf(data.kp, 1)}{/if}
			· Puede afectar a GPS, radio y satélites, y traer auroras más al sur de lo normal ·
			<a href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener">NOAA SWPC</a>
		</span>
	</aside>
{/if}

<style>
	.storm {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-4) var(--sp-12);
		margin-bottom: var(--sp-12);
		padding: var(--row-y) var(--pad-x);
		background: var(--amber-soft);
		border: var(--hair) solid var(--amber-edge);
		font-size: var(--fs-s);
	}

	b {
		color: var(--amber);
		font-weight: var(--fw-bold);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}

	span {
		color: var(--muted);
		font-family: var(--sans);
	}

	a {
		color: var(--muted);
	}
</style>
