<!--
	FONDOS: carteras de grandes fondos según su último 13F en la SEC (static/data/funds.json).
	Un panel por fondo: las 10 mayores posiciones y, frente al trimestre anterior, lo más comprado y vendido.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { compact, nf, period } from '#lib/format.ts';
	import type { FundMove } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const list = $derived(data.funds?.data.funds ?? []);

	/** «2026-06-30» → «T2 2026» */
	const quarter = (date: string) => (date ? `T${Math.ceil(Number(date.slice(5, 7)) / 3)} ${date.slice(0, 4)}` : '—');
	/** «2026-08-14» → «14 ago 2026» */
	const day = (date: string) => (date ? `${period(date)} ${date.slice(0, 4)}` : '—');
	const usd = (n: number) => `${compact(n)} $`;
	const pct = (w: number) => `${nf(w * 100, 1)} %`;

	/** Qué ha pasado con la posición: nueva, fuera o el cambio de acciones. */
	function detail(m: FundMove): string {
		if (m.status === 'new') return 'Nueva';
		if (m.status === 'exit') return 'Vende todo';
		return m.pct === null ? '' : `${m.pct > 0 ? '+' : '−'}${nf(Math.abs(m.pct) * 100, 0)} % acciones`;
	}
</script>

<ViewHeader code="FONDOS" title="Carteras de grandes fondos" sub="Lo que declaran cada trimestre a la SEC en el formulario 13F" />

{#if list.length}
	<div class="grid grid-2">
		{#each list as fund (fund.key)}
			<div class="col">
				<Panel title={fund.name} meta={quarter(fund.period)}>
					<p class="sum">
						<span>{fund.manager}</span>
						<span><b>{usd(fund.total)}</b> en {nf(fund.count, 0)} posiciones</span>
					</p>
					<Table>
						<thead>
							<tr><th>Mayores posiciones</th><th>Peso</th><th>Valor</th></tr>
						</thead>
						<tbody>
							{#each fund.top as p (p.cusip + (p.putCall ?? ''))}
								<tr>
									<td class="name cut" title={p.name}>
										{p.name}{#if p.putCall}<span class="opt">{p.putCall === 'Put' ? 'PUT' : 'CALL'}</span>{/if}
									</td>
									<td>{pct(p.weight)}</td>
									<td class="mut">{compact(p.value)}</td>
								</tr>
							{/each}
						</tbody>
					</Table>
					{#if fund.prev}
						<div class="moves">
							{#each [{ title: 'Más comprado', items: fund.bought }, { title: 'Más vendido', items: fund.sold }] as side (side.title)}
								<div>
									<h3>{side.title}</h3>
									{#if side.items.length}
										<ul class="mini">
											{#each side.items as m (m.cusip + (m.putCall ?? ''))}
												<li>
													<span class="l cut" title={m.name}>{m.name}{#if m.putCall}<span class="opt">{m.putCall === 'Put' ? 'PUT' : 'CALL'}</span>{/if}</span>
													<small class:tag={m.status === 'new' || m.status === 'exit'}>{detail(m)}</small>
													<b><Change value={m.value} text={`${m.value > 0 ? '+' : '−'}${compact(Math.abs(m.value))}`} /></b>
												</li>
											{/each}
										</ul>
									{:else}
										<p class="none">Nada</p>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="none">Sin el trimestre anterior para comparar.</p>
					{/if}
					{#snippet note()}
						Presentado el {day(fund.filed)}{#if fund.prev}&nbsp;· frente al {quarter(fund.prev.period)}{/if} ·
						<a href={fund.url} target="_blank" rel="noopener">13F en EDGAR</a>
					{/snippet}
				</Panel>
			</div>
		{/each}
	</div>
	<div class="foot">
		<Note>
			Datos de la SEC (13F), con hasta 45 días de retraso tras el trimestre. Solo incluye acciones de EE. UU.
			y opciones sobre ellas (el valor de las opciones es el del subyacente). Compras y ventas, por cambio en
			acciones al precio del trimestre. Valores en dólares · <Updated at={data.funds?.fetchedAt} source="funds" />
		</Note>
	</div>
{:else}
	<div class="grid">
		<div class="col">
			<Panel title="Fondos">
				<p class="empty">Sin carteras todavía: la fuente necesita el secreto SEC_USER_AGENT.</p>
			</Panel>
		</div>
	</div>
{/if}

<style>
	.sum {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--sp-4) var(--sp-12);
		margin: 0;
		padding: 0 var(--pad-x) var(--sp-8);
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
		border-bottom: var(--border);
	}

	.sum b {
		color: var(--fg);
		font-family: var(--mono);
		font-weight: var(--fw-medium);
	}

	/* El nombre ocupa lo que sobra y se corta con «…»: la tabla nunca se sale del panel. */
	.cut {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	td.cut {
		display: table-cell;
		width: 100%;
		max-width: 0;
	}

	.opt {
		margin-left: var(--sp-6);
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-code);
	}

	.moves {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border-top: var(--border);
	}

	.moves > div + div {
		border-left: var(--border);
	}

	h3 {
		margin: 0;
		padding: var(--sp-8) var(--pad-x) 0;
		font-size: var(--fs-xs);
		font-weight: var(--fw-regular);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--faint);
	}

	/* Cada movimiento en dos líneas: el nombre a todo el ancho y, debajo, qué ha pasado y cuánto. */
	.moves .mini li {
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'name name' 'what amount';
		gap: 0 var(--sp-6);
		padding-inline: var(--pad-x);
	}

	.moves .mini .l {
		grid-area: name;
	}

	.moves small {
		grid-area: what;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
		font-family: var(--sans);
	}

	.moves b {
		grid-area: amount;
	}

	.moves .mini .l {
		font-size: var(--fs-s);
	}

	.moves small {
		font-size: var(--fs-xs);
	}

	.moves small.tag {
		color: var(--amber);
	}

	.moves b {
		font-size: var(--fs-xs);
	}

	.none {
		margin: 0;
		padding: var(--sp-8) var(--pad-x) var(--sp-10);
		color: var(--faint);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.foot {
		margin-top: var(--sp-12);
		background: var(--panel);
		border: var(--border);
	}

	.foot :global(.pnote) {
		border-top: 0;
	}
</style>
