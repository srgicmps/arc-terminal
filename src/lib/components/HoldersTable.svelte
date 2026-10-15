<!--
	HDS: qué fondos de FONDOS tienen un valor (src/lib/holders.ts), del que más al que menos. Lo usan la vista
	HDS y la ficha del valor.
-->
<script lang="ts">
	import Table from './ui/Table.svelte';
	import { compact, nf } from '#lib/format.ts';
	import type { Holder } from '#lib/holders.ts';

	interface Props {
		holders: Pick<Holder, 'fund' | 'value' | 'weight' | 'rank' | 'change' | 'pct'>[];
		/** Nombre del fondo por su clave («BRK» → «Berkshire Hathaway»). */
		names: Record<string, string>;
	}

	let { holders, names }: Props = $props();

	function change(h: Props['holders'][number]): string {
		if (h.change === null) return '—';
		if (h.change === 'new') return 'Nueva';
		if (h.change === 'same' || h.pct === null) return 'Igual';
		return `${h.pct > 0 ? '+' : '−'}${nf(Math.abs(h.pct) * 100, 0)} %`;
	}
</script>

<Table>
	<thead>
		<tr><th class="l">Fondo</th><th class="per">Puesto</th><th>Peso</th><th>Valor</th><th>Trimestre</th></tr>
	</thead>
	<tbody>
		{#each holders as h (h.fund)}
			<tr>
				<td class="l name cut" title={names[h.fund] ?? h.fund}>{names[h.fund] ?? h.fund}</td>
				<td class="mut per">{h.rank}.º</td>
				<td>{nf(h.weight * 100, 1)} %</td>
				<td class="mut">{compact(h.value)} $</td>
				<td class:up={h.change === 'new' || h.change === 'add'} class:down={h.change === 'trim'} class:mut={h.change === null || h.change === 'same'}>{change(h)}</td>
			</tr>
		{/each}
	</tbody>
</Table>

<style>
	/* En el móvil, el nombre del fondo se corta con «…» (como en FONDOS) y el puesto (.per) se oculta: así caben
	   el peso, el valor y el trimestre sin scroll lateral. */
	td.cut {
		width: 100%;
		max-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
