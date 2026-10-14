<!--
	Volumen en corto de valores de EE. UU. (FINRA Reg SHO, src/lib/shortvol.ts): qué parte del volumen del último
	día se vendió en corto, frente a su media de 20 días.
	- Con `code` (ficha /s): cifras grandes de ese valor.
	- Con `codes` (MIS): una tabla con los de tu lista que trae FINRA.
	Sin dato para ningún valor, no pinta nada. La diferencia con la media va sin verde ni rojo: más corto no es
	ni subida ni bajada del precio. Provisional (lote 24.4, D35).
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Dataset } from '#lib/data.ts';
	import { compact, nf, period, signed } from '#lib/format.ts';
	import { shortStat, type ShortStat, type ShortSummary } from '#lib/shortvol.ts';
	import Panel from './Panel.svelte';
	import Updated from './Updated.svelte';
	import Table from './ui/Table.svelte';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';

	interface Props {
		data: Dataset<ShortSummary> | null | undefined;
		/** Un valor: la ficha. */
		code?: string;
		/** Varios valores: la tabla de MIS. */
		codes?: string[];
	}

	let { data, code, codes }: Props = $props();

	const one = $derived(code ? shortStat(data?.data, code) : null);
	const many = $derived(
		(codes ?? []).map((c) => ({ code: c, s: shortStat(data?.data, c) })).filter((r): r is { code: string; s: ShortStat } => r.s !== null)
	);
	const date = $derived(one?.date ?? many[0]?.s.date ?? '');
	const days = $derived(data?.data.days ?? 0);
	const pct = (n: number | null) => (n === null ? '—' : `${nf(n, 1)} %`);
</script>

{#if one || many.length}
	<Panel title="Volumen en corto" meta="FINRA · EE. UU. · {period(date)}">
		{#if one}
			<Tiles cols={4}>
				<Tile label="En corto" value={pct(one.ratio)} sub="Del volumen del {period(one.date)}" />
				<Tile label="Media {days} días" value={pct(one.avg)} sub={one.diff === null ? 'Aún pocos días' : `Hoy ${signed(one.diff, 1)} puntos`} />
				<Tile label="Acciones en corto" value={compact(one.short)} />
				<Tile label="Volumen total" value={compact(one.total)} />
			</Tiles>
		{:else}
			<Table>
				<thead>
					<tr><th>Valor</th><th>En corto</th><th>Media {days} d</th><th>Dif.</th><th>Volumen</th></tr>
				</thead>
				<tbody>
					{#each many as r (r.code)}
						<tr>
							<td><a class="l" href="{resolve('/s')}?sym={encodeURIComponent(r.code)}">{r.code}</a></td>
							<td>{pct(r.s.ratio)}</td>
							<td class="mut">{pct(r.s.avg)}</td>
							<td class="mut">{r.s.diff === null ? '—' : signed(r.s.diff, 1)}</td>
							<td class="mut">{compact(r.s.total)}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		{/if}
		{#snippet note()}
			Parte del volumen del día que se vendió en corto. Incluye la cobertura de los creadores de mercado, así que no es
			el interés en corto (las posiciones abiertas). Fuente: FINRA Reg SHO (CNMS) · <Updated at={data?.fetchedAt} source="finra" />
		{/snippet}
	</Panel>
{/if}
