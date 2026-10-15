<!--
	RV: las cifras de un valor frente a la mediana de sus competidores (src/lib/rv.ts). Lo usan la vista RV y la
	ficha del valor.
-->
<script lang="ts">
	import Table from './ui/Table.svelte';
	import { nf } from '#lib/format.ts';
	import type { RvRow } from '#lib/rv.ts';

	interface Props {
		rows: RvRow[];
	}

	let { rows }: Props = $props();

	const fmt = (v: number | null, unit: string) => (v === null ? '—' : `${nf(v, Math.abs(v) >= 100 ? 0 : 1)}${unit}`);
</script>

<Table>
	<thead>
		<tr><th class="l">Cifra</th><th>Valor</th><th title="Mediana del sector">Mediana</th><th>Puesto</th></tr>
	</thead>
	<tbody>
		{#each rows as r (r.key)}
			<tr>
				<td class="l name wrap">{r.label}</td>
				<td class:up={r.better === true} class:down={r.better === false}>{fmt(r.value, r.unit)}</td>
				<td class="mut">{fmt(r.median, r.unit)}</td>
				<td class="mut">{r.rank === null ? '—' : `${r.rank}.º de ${r.of}`}</td>
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	/* La cifra («Crecimiento de las ventas») puede ir en dos líneas: en el móvil la tabla no cabía. */
	td.wrap {
		white-space: normal;
	}
</style>
