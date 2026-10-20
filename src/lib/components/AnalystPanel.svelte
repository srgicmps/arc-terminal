<!--
	Ficha de valor: lo que dicen los analistas (consenso y precio objetivo), las sorpresas de resultados de
	los últimos trimestres y las compras y ventas de directivos en 90 días. Datos de Finnhub
	(scripts/sources/analysts.ts), solo para valores de EE. UU. Va dentro de un <Panel>.
-->
<script lang="ts">
	import { compact, dm, nf } from '#lib/format.ts';
	import type { StockAnalysis } from '#lib/types.ts';
	import Bar from './ui/Bar.svelte';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';

	let { a }: { a: StockAnalysis } = $props();

	const latest = $derived(a.recs[0]);
	const rows = $derived(
		latest
			? [
					{ label: 'Compra fuerte', n: latest.strongBuy },
					{ label: 'Compra', n: latest.buy },
					{ label: 'Mantener', n: latest.hold },
					{ label: 'Venta', n: latest.sell },
					{ label: 'Venta fuerte', n: latest.strongSell }
				]
			: []
	);
	const total = $derived(rows.reduce((s, r) => s + r.n, 0));
	const top = $derived(Math.max(1, ...rows.map((r) => r.n)));

	/** Consenso: media de −2 (venta fuerte) a +2 (compra fuerte). */
	const consensus = $derived.by(() => {
		if (!latest || !total) return null;
		const score = (2 * latest.strongBuy + latest.buy - latest.sell - 2 * latest.strongSell) / total;
		if (score >= 1.2) return { text: 'Compra fuerte', tone: 'up' as const };
		if (score >= 0.4) return { text: 'Compra', tone: 'up' as const };
		if (score > -0.4) return { text: 'Mantener', tone: 'flat' as const };
		if (score > -1.2) return { text: 'Venta', tone: 'down' as const };
		return { text: 'Venta fuerte', tone: 'down' as const };
	});

	/** «2026-09-30» → «sep 2026» (con las abreviaturas de format.ts). */
	const quarter = (period: string) => `${dm(`${period}T12:00:00Z`).split(' ')[1]} ${period.slice(0, 4)}`;
	const usd = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${nf(n, 2)} $`);
</script>

<Tiles cols={3}>
	<Tile
		label="Consenso"
		value={consensus?.text ?? '—'}
		tone={consensus?.tone ?? 'mut'}
		sub={total ? `${total} analistas` : undefined}
	/>
	<Tile
		label="Precio objetivo"
		value={a.target ? usd(a.target.mean) : '—'}
		tone={a.target ? undefined : 'mut'}
		sub={a.target ? `${usd(a.target.low)} – ${usd(a.target.high)}` : 'No disponible'}
	/>
	<Tile
		label="Último trimestre"
		value={a.surprises[0]?.surprisePct === null || a.surprises[0]?.surprisePct === undefined
			? '—'
			: `${a.surprises[0].surprisePct > 0 ? '+' : ''}${nf(a.surprises[0].surprisePct, 1)} %`}
		tone={(a.surprises[0]?.surprisePct ?? 0) > 0 ? 'up' : (a.surprises[0]?.surprisePct ?? 0) < 0 ? 'down' : 'mut'}
		sub="Sorpresa en el beneficio"
	/>
</Tiles>

{#if rows.length}
	<Table>
		<thead>
			<tr><th>Recomendación</th><th class="l bar">{latest ? quarter(latest.period) : ''}</th><th>Analistas</th></tr>
		</thead>
		<tbody>
			{#each rows as r (r.label)}
				<tr>
					<td>{r.label}</td>
					<td class="l bar"
						><Bar pct={(r.n / top) * 100} thin tone={r.label.startsWith('Compra') ? 'up' : 'faint'} /></td
					>
					<td>{r.n}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

{#if a.surprises.length}
	<Table>
		<thead>
			<tr><th>Trimestre</th><th>BPA esperado</th><th>BPA real</th><th>Sorpresa</th></tr>
		</thead>
		<tbody>
			{#each a.surprises as s (s.period)}
				<tr>
					<td>{quarter(s.period)}</td>
					<td class="mut">{usd(s.estimate)}</td>
					<td>{usd(s.actual)}</td>
					<td><Change value={s.surprisePct} digits={1} unit=" %" /></td>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}

<Table>
	<thead>
		<tr><th>Directivos · 90 días</th><th class="l">Operación</th><th>Acciones</th><th class="wide">Precio</th></tr>
	</thead>
	<tbody>
		<!-- Clave por posición: un directivo puede vender dos veces lo mismo el mismo día a precios distintos. -->
		{#each a.insiders as t, i (i)}
			<tr>
				<td class="name">{t.name}<span class="sub">{dm(`${t.date}T12:00:00Z`)}</span></td>
				<td class="l" class:up={t.code === 'P'} class:down={t.code === 'S'}>{t.code === 'P' ? 'Compra' : 'Venta'}</td>
				<td>{compact(Math.abs(t.change))}</td>
				<td class="mut wide">{usd(t.price)}</td>
			</tr>
		{:else}
			<tr><td class="mut" colspan="4">Sin compras ni ventas de directivos en 90 días.</td></tr>
		{/each}
	</tbody>
</Table>

<style>
	.bar {
		width: 50%;
	}

	/* En el móvil, lo esencial: sin la columna del precio. */
	@container (max-width: 390px) {
		.wide {
			display: none;
		}
	}
</style>
