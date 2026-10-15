<!--
	WS: inventarios semanales de petróleo de EE. UU. (EIA). Último dato en millones de barriles, su variación
	frente a la semana anterior y la diferencia con la media de la misma semana en los 5 años anteriores.
-->
<script lang="ts">
	import { nf } from '#lib/format.ts';
	import { vsAvg5, weekChange, type EiaStock } from '#lib/eia.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';

	let { stocks }: { stocks: EiaStock[] } = $props();
</script>

<Table>
	<thead>
		<tr><th>Inventario</th><th>M bbl</th><th>Semana</th><th>vs 5 años</th></tr>
	</thead>
	<tbody>
		{#each stocks as s (s.id)}
			{@const last = s.points.at(-1)}
			<tr>
				<td class="name">{s.label}</td>
				<td>{last ? nf(last.v, 1) : '—'}</td>
				<td><Change value={weekChange(s.points)} digits={1} /></td>
				<td><Change value={vsAvg5(s)} digits={1} unit=" %" /></td>
			</tr>
		{/each}
	</tbody>
</Table>
