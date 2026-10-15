<!--
	Subastas de bonos y notas del Tesoro de EE. UU.: las próximas (fecha, plazo e importe) y las últimas 10 con
	su resultado. Un bid-to-cover por debajo de la media de las 6 subastas anteriores del mismo plazo es señal de
	poca demanda: va en ámbar tenue.
-->
<script lang="ts">
	import { compact, nf, period } from '#lib/format.ts';
	import Table from './ui/Table.svelte';
	import type { Auction, AuctionsData } from '#lib/types.ts';

	let { data }: { data: AuctionsData } = $props();

	/** «10-Year» → «10A», «29-Year 10-Month» → «29A 10M», «8-Week» → «8 sem.»; las de tipo flotante, con «FRN». */
	function term(a: Auction): string {
		const t = a.term.replace(/(\d+)-Year/g, '$1A').replace(/(\d+)-Month/g, '$1M').replace(/(\d+)-Week/g, '$1 sem.');
		return a.kind === 'FRN' ? `${t} FRN` : t;
	}

	const weak = (a: Auction) => a.bidToCover !== null && a.avgBidToCover != null && a.bidToCover < a.avgBidToCover;
</script>

{#if data.upcoming.length}
	<h3 class="sub-h">Próximas</h3>
	<Table>
		<thead>
			<tr>
				<th class="l">Día</th>
				<th class="l">Plazo</th>
				<th>Importe</th>
			</tr>
		</thead>
		<tbody>
			{#each data.upcoming as a (a.date + a.term + a.kind)}
				<tr>
					<td class="l">{period(a.date)}</td>
					<td class="l name">{term(a)}{#if a.reopening}<span class="sub">reapertura</span>{/if}</td>
					<td>{a.offering === null ? '—' : `${compact(a.offering)} $`}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

{#if data.recent.length}
	<h3 class="sub-h">Últimas</h3>
	<Table>
		<thead>
			<tr>
				<th class="l">Día</th>
				<th class="l">Plazo</th>
				<th>Rent.</th>
				<th title="Demanda frente a lo adjudicado">B/C</th>
				<th title="Postores indirectos: bancos centrales y fondos extranjeros, sobre todo">Indir.</th>
			</tr>
		</thead>
		<tbody>
			{#each data.recent as a (a.date + a.term + a.kind)}
				<tr>
					<td class="l">{period(a.date)}</td>
					<td class="l name">{term(a)}</td>
					<td>{a.highYield === null ? '—' : `${nf(a.highYield, 3)} %`}</td>
					<td class:weak={weak(a)} title={a.avgBidToCover ? `Media de las 6 anteriores: ${nf(a.avgBidToCover, 2)}` : undefined}>
						{nf(a.bidToCover, 2)}
					</td>
					<td class="mut">{a.indirectPct === null ? '—' : `${nf(a.indirectPct, 1)} %`}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else if !data.upcoming.length}
	<p class="empty">Sin subastas todavía.</p>
{/if}

<style>
	.sub-h {
		margin: 0;
		padding: var(--sp-6) var(--pad-x) var(--sp-4);
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		font-weight: var(--fw-regular);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	/* Bid-to-cover por debajo de su media: poca demanda. Discreto, sin ser una bajada (rojo). */
	.weak {
		/* --amber-dim lo crea #89; hasta que entre, el ámbar normal. */
		color: var(--amber-dim, var(--amber));
	}
</style>
