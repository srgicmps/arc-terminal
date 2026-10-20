<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { nf } from '#lib/format.ts';
	import { curvePhrase, phrases } from '#lib/plain.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Modo Sencillo: la pendiente 2–10 de EE. UU. y de la zona euro, contada en frases (src/lib/plain.ts).
	const slope = (code: string) => data.rows.find((r) => r.code === code)?.s2s10;
	const plain = $derived(phrases([curvePhrase('EE. UU.', slope('US')), curvePhrase('la zona euro', slope('EA'))]));

	const cell = (v: number | null) => (v === null ? '—' : nf(v, 2));
	const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
</script>

<ViewHeader code="WB" title="Bonos soberanos" sub="Tesoro de EE. UU., BCE y Ministerio de Finanzas de Japón" {plain} />

<div class="grid">
	<div class="col">
		<Panel title="Bonos soberanos" meta="rentabilidad en % · cambios y pendientes en pb">
			{#if data.rows.length}
				<Table>
					<thead>
						<tr>
							<th>Emisor</th>
							<th>2A</th>
							<th>10A</th>
							<th>30A</th>
							<th title="Cambio del 10 años frente a la sesión anterior">Día</th>
							<th title="Cambio del 10 años frente a hace un mes">Mes</th>
							<th title="Pendiente: 10 años − 2 años">2–10</th>
							<th title="Pendiente: 30 años − 10 años">10–30</th>
							<th class="per">Fecha</th>
						</tr>
					</thead>
					<tbody>
						{#each data.rows as r (r.code)}
							<tr>
								<td class="name">{r.name}</td>
								<td>{cell(r.y2)}</td>
								<td>{cell(r.y10)}</td>
								<td>{cell(r.y30)}</td>
								<td><Change value={r.d10} digits={0} /></td>
								<td><Change value={r.m10} digits={0} /></td>
								<td class:down={r.s2s10 !== null && r.s2s10 < 0}>{r.s2s10 ?? '—'}</td>
								<td class:down={r.s10s30 !== null && r.s10s30 < 0}>{r.s10s30 ?? '—'}</td>
								<td class="per mut">{short(r.date)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}
				Último cierre de cada uno. Pendiente negativa (en rojo): curva invertida. Zona euro: bonos AAA de la zona
				(curva del BCE). Reino Unido y China no están: sus datos diarios son de pago. · <Updated at={data.fetchedAt} source="uscurve" />
			{/snippet}
		</Panel>
	</div>
</div>
