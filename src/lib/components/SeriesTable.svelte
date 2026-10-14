<!--
	Tabla de series: último dato, variación frente al anterior, periodo, próximo dato y minigráfico.
	El próximo dato llega en la prop `next` (lo calcula el +page.server.ts con nextMap() de nextrelease.ts);
	la columna solo aparece si alguna serie tiene fecha. Con `extra`, columnas de variación propias
	(por ejemplo, frente a hace 7 días y a hace un año, con `diffDays` de series.ts). Con `pct`, la variación
	frente al dato anterior va en % y no en unidades (índices de precios). Con `alt` en una fila, una segunda
	serie del mismo indicador (otra fuente o frecuencia) sale en pequeño bajo el nombre: último dato y periodo.
-->
<script lang="ts">
	import { GEO, nf, period } from '#lib/format.ts';
	import { change } from '#lib/series.ts';
	import { lookup } from '#lib/glossary.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import Term from './ui/Term.svelte';
	import type { Series } from '#lib/types.ts';
	import Spark from './Spark.svelte';
	import { shortDay, type NextMap } from '#lib/nextrelease.ts';

	interface Row {
		series: Series | undefined;
		/** Texto de la primera columna; por defecto, el país o la etiqueta de la serie. */
		name?: string;
		decimals?: number;
		/** Si subir es malo (paro, inflación…), la variación se pinta al revés. */
		inverse?: boolean;
		/** Otra serie del mismo indicador (IPCA junto al IPC, paro mensual junto a la EPA). */
		alt?: { series: Series | undefined; label: string; decimals?: number };
	}

	interface Extra {
		head: string;
		/** Variación en las unidades de la serie, o null si no hay dato con qué comparar. */
		value: (s: Series) => number | null;
		/** Se añade detrás del número (« %»…); por defecto, nada. */
		unit?: string;
		/** Decimales; por defecto, los de la fila. */
		digits?: number;
	}

	interface Props {
		rows: Row[];
		head?: string;
		/** Cuántos puntos dibuja el minigráfico. */
		spark?: number;
		/** Próxima publicación de cada serie (por id), de los calendarios oficiales. */
		next?: NextMap;
		extra?: Extra[];
		/** Variación frente al dato anterior en % (índices de precios), en lugar de en unidades. */
		pct?: boolean;
	}

	let { rows, head = 'Indicador', spark = 24, next, extra = [], pct = false }: Props = $props();

	const visible = $derived(rows.filter((r): r is Row & { series: Series } => Boolean(r.series?.points.length)));

	const anyNext = $derived(visible.some((r) => next?.[r.series.id]));
	const nameOf = (row: Row & { series: Series }) => row.name ?? GEO[row.series.geo ?? ''] ?? row.series.label;
	// ⓘ del glosario: solo en la primera fila de cada término, para no repetirlo en toda la tabla.
	const withTerm = $derived.by(() => {
		const seen = new Set<string>();
		return new Set(
			visible.flatMap((row) => {
				const id = lookup(nameOf(row))?.id;
				if (!id || seen.has(id)) return [];
				seen.add(id);
				return [row.series.id];
			})
		);
	});
</script>

{#if visible.length}
	<Table>
		<thead>
			<tr>
				<th>{head}</th>
				<th>Último</th>
				<th>Var.</th>
				{#each extra as x (x.head)}<th>{x.head}</th>{/each}
				<th class="per">Periodo</th>
				{#if anyNext}<th class="nx">Próx.</th>{/if}
				<th class="sp"><span class="sr">Evolución</span></th>
			</tr>
		</thead>
		<tbody>
			{#each visible as row (row.series.id)}
				{@const pts = row.series.points}
				{@const last = pts[pts.length - 1]}
				{@const prev = pts[pts.length - 2]}
				{@const d = row.decimals ?? 1}
				{@const diff = pct ? change(row.series) : prev ? last.v - prev.v : null}
				{@const nx = next?.[row.series.id]}
				<tr>
					<td>
						<a class="name" href={row.series.url} target="_blank" rel="noopener">
							{nameOf(row)}
						</a>{#if withTerm.has(row.series.id)}<Term of={nameOf(row)} />{/if}
						{#if row.alt?.series?.points.length}
							{@const a = row.alt.series.points[row.alt.series.points.length - 1]}
							<small class="alt">{row.alt.label} {nf(a.v, row.alt.decimals ?? d)}{row.alt.series.unit === '%' ? ' %' : ''} · {period(a.t)}</small>
						{/if}
						{#if nx}<small class="nx-sub" title={nx.title}>próx. {shortDay(nx.date)}</small>{/if}
					</td>
					<td>{nf(last.v, d)}{row.series.unit === '%' ? ' %' : ''}</td>
					<td><Change value={diff} digits={pct ? 1 : d} unit={pct ? ' %' : ''} invert={row.inverse} /></td>
					{#each extra as x (x.head)}<td><Change value={x.value(row.series)} digits={x.digits ?? d} unit={x.unit ?? ''} invert={row.inverse} /></td>{/each}
					<td class="mut per">{period(last.t)}</td>
					{#if anyNext}<td class="mut nx" title={nx?.title}>{nx ? shortDay(nx.date) : ''}</td>{/if}
					<td class="sp"><Spark values={pts.slice(-spark).map((p) => p.v)} /></td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	/* El nombre puede partirse en dos líneas para que la tabla quepa en el móvil; los números, nunca. */
	td:first-child {
		white-space: normal;
	}

	a.name {
		color: inherit;
		text-decoration: none;
	}

	a.name:hover {
		color: var(--amber);
	}

	.sp {
		width: 80px;
		padding-block: 0;
	}

	.alt {
		display: block;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	/* El próximo dato va en su columna; en paneles estrechos, debajo del nombre. */
	.nx-sub {
		display: none;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	@container (max-width: 520px) {
		.nx {
			display: none;
		}

		.nx-sub {
			display: block;
		}
	}

	/* En paneles estrechos, el periodo cede su sitio al minigráfico; en los muy estrechos, también este. */
	@container (max-width: 440px) {
		.per {
			display: none;
		}
	}

	@container (max-width: 300px) {
		.sp {
			display: none;
		}
	}
</style>
