<!--
	ECO, «Señales de recesión» (provisional): regla de Sahm, probabilidad de recesión y curva 10 años − 3 meses,
	de FRED, con «activada» o «no» según las reglas de src/lib/recession.ts. Todo el panel está aquí: para
	quitarlo basta con borrar este archivo, su línea en la vista ECO y la de su +page.server.ts.
-->
<script lang="ts">
	import type { Dataset } from '#lib/data.ts';
	import { nf, period } from '#lib/format.ts';
	import { CURVE_DAYS, recessionSignals } from '#lib/recession.ts';
	import type { SeriesData } from '#lib/types.ts';
	import Panel from './Panel.svelte';
	import Spark from './Spark.svelte';
	import Updated from './Updated.svelte';
	import Table from './ui/Table.svelte';

	let { data }: { data: Dataset<SeriesData> } = $props();

	const get = (id: string) => data.data.series.find((s) => s.id === id);
	const r = $derived(recessionSignals(get('sahm-us'), get('recprob-us'), get('t10y3m-us')));
	// Cada señal con su forma de escribir el dato (Sahm en puntos, las otras en %).
	const rows = $derived(
		[
			r.sahm && { ...r.sahm, text: `${nf(r.sahm.value, 2)} p` },
			r.prob && { ...r.prob, text: `${nf(r.prob.value, 1)} %` },
			r.curve && { ...r.curve, text: `${nf(r.curve.value, 2)} %` }
		].filter((x) => !!x)
	);
</script>

{#if rows.length}
	<Panel title="Señales de recesión" meta="EE. UU. · FRED">
		<Table>
			<thead>
				<tr><th>Señal</th><th>Último</th><th>Dato</th><th class="sp"></th><th>Estado</th></tr>
			</thead>
			<tbody>
				{#each rows as s (s.name)}
					<tr>
						<td><a class="name" href={s.url} target="_blank" rel="noopener">{s.name}</a></td>
						<td>{s.text}</td>
						<td class="mut">{period(s.t)}</td>
						<td class="sp"><Spark values={s.values} /></td>
						<td class:on={s.active} class:mut={!s.active} title={s.rule}>{s.active ? 'activada' : 'no'}</td>
					</tr>
				{/each}
			</tbody>
		</Table>
		{#snippet note()}
			Reglas: Sahm, desde 0,50 puntos; probabilidad (modelo de Chauvet y Piger, con 2–3 meses de retraso), desde el
			50 %, aunque hay quien exige el 80 %; curva, si la media de {CURVE_DAYS} sesiones es negativa. Fuente: FRED,
			Fed de San Luis (usa su API sin estar respaldado por ella) · <Updated at={data.fetchedAt} source="fred" />
		{/snippet}
	</Panel>
{/if}

<style>
	/* Como en SeriesTable: el nombre puede partirse en el móvil y el minigráfico se va en paneles estrechos. */
	td:first-child {
		white-space: normal;
	}

	.sp {
		width: 80px;
		padding-block: 0;
	}

	@container (max-width: 390px) {
		.sp {
			display: none;
		}
	}
	/* Una señal activada es un aviso, no una bajada: ámbar, como el resto de alertas. */
	.on {
		color: var(--amber);
	}
</style>
