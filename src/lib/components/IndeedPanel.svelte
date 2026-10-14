<!--
	Ofertas de empleo en Indeed (Indeed Hiring Lab), PROVISIONAL (lote 23.5, D35). Lo usan ECO (todos los países)
	y PAIS (solo el del país). Índice desestacionalizado, 1 feb. 2020 = 100, un punto por semana.
	Var.: frente a la semana anterior; Año: frente a hace un año. La licencia (CC BY 4.0) pide citar la fuente.
-->
<script lang="ts">
	import { pctDays } from '#lib/series.ts';
	import type { Series } from '#lib/types.ts';
	import Panel from './Panel.svelte';
	import SeriesTable from './SeriesTable.svelte';
	import Updated from './Updated.svelte';

	interface Props {
		series: Series[];
		fetchedAt?: string;
	}

	let { series, fetchedAt }: Props = $props();
</script>

{#if series.length}
	<Panel title="Ofertas de empleo (Indeed)" meta="Índice, 1 feb. 2020 = 100">
		<SeriesTable
			head={series.length > 1 ? 'País' : 'Índice'}
			rows={series.map((s) => ({ series: s, name: s.label }))}
			spark={52}
			pct
			extra={[{ head: 'Año', value: (s) => pctDays(s, 365), unit: ' %', digits: 1 }]}
		/>
		{#snippet note()}
			Fuente: <a href="https://github.com/hiring-lab/job_postings_tracker" target="_blank" rel="noopener">Indeed Hiring Lab</a>, CC BY 4.0 ·
			ofertas publicadas en Indeed, desestacionalizadas · variación semanal y anual{#if fetchedAt}&nbsp;·
				<Updated at={fetchedAt} source="indeed" />{/if}
		{/snippet}
	</Panel>
{/if}
