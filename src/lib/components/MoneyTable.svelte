<!-- BTMM: tabla de tipos a corto plazo con su cambio en el día y en el mes (pb) y, si lo hay, el volumen. -->
<script lang="ts">
	import type { MoneyRow } from '#lib/btmm.ts';
	import { nf } from '#lib/format.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';

	let { rows }: { rows: MoneyRow[] } = $props();

	const hasVol = $derived(rows.some((r) => r.vol != null));
	const when = (t: string) => (t.length === 7 ? `${t.slice(5, 7)}/${t.slice(2, 4)}` : `${t.slice(8, 10)}/${t.slice(5, 7)}`);
</script>

{#if rows.length}
	<Table>
		<thead>
			<tr>
				<th>Tipo</th>
				<th>%</th>
				<th title="Cambio frente al dato anterior, en puntos básicos">Día</th>
				<th title="Cambio frente a hace un mes, en puntos básicos">Mes</th>
				{#if hasVol}<th class="per" title="Volumen negociado, miles de millones de dólares">Vol.</th>{/if}
				<th class="per">Fecha</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.id)}
				<tr>
					<td class="name">{r.label}</td>
					<td>{nf(r.v, 2)}</td>
					<td><Change value={r.d} digits={0} /></td>
					<td><Change value={r.m} digits={0} /></td>
					{#if hasVol}<td class="per mut">{r.vol == null ? '' : nf(r.vol, 0)}</td>{/if}
					<td class="per mut">{when(r.t)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}
