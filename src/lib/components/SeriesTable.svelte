<!--
	Tabla de series: último dato, variación frente al anterior, periodo, próximo dato y minigráfico.
	El próximo dato llega en la prop `next` (lo calcula el +page.server.ts con nextMap() de nextrelease.ts);
	la columna solo aparece si alguna serie tiene fecha. Con `extra`, columnas de variación propias
	(por ejemplo, frente a hace 7 días y a hace un año, con `diffDays` de series.ts). Con `pct`, la variación
	frente al dato anterior va en % y no en unidades (índices de precios).
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
	import { crossed, parseNumber } from '#lib/thresholds.ts';
	import { removeRule, seen, setRule, thresholds } from '#lib/thresholds.svelte.ts';

	interface Row {
		series: Series | undefined;
		/** Texto de la primera columna; por defecto, el país o la etiqueta de la serie. */
		name?: string;
		decimals?: number;
		/** Si subir es malo (paro, inflación…), la variación se pinta al revés. */
		inverse?: boolean;
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
	// Umbrales (lote 25): tocar la cifra abre «Resaltar si > / < X» debajo de la fila. La fila cruzada lleva un
	// borde de acento de 1 px. La tabla anota el último dato, para el contador de la barra de arriba.
	let editing = $state<string | null>(null);
	let op = $state<'>' | '<'>('>');
	let text = $state('');
	const cols = $derived(5 + extra.length + (anyNext ? 1 : 0));

	$effect(() => {
		for (const row of visible) if (thresholds.rules[row.series.id]) seen(row.series.id, row.series.points.at(-1)!.v);
	});

	function startEdit(row: Row & { series: Series }) {
		const rule = thresholds.rules[row.series.id];
		editing = editing === row.series.id ? null : row.series.id;
		op = rule?.op ?? '>';
		text = rule ? String(rule.v).replace('.', ',') : '';
	}

	function save(row: Row & { series: Series }, e: SubmitEvent) {
		e.preventDefault();
		const v = parseNumber(text);
		if (v === null) return;
		setRule(row.series.id, { op, v, name: nameOf(row) }, row.series.points.at(-1)!.v);
		editing = null;
	}

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
				{@const rule = thresholds.rules[row.series.id]}
				<tr class:hit={rule && crossed(rule, last.v)}>
					<td>
						<a class="name" href={row.series.url} target="_blank" rel="noopener">
							{nameOf(row)}
						</a>{#if withTerm.has(row.series.id)}<Term of={nameOf(row)} />{/if}
						{#if nx}<small class="nx-sub" title={nx.title}>próx. {shortDay(nx.date)}</small>{/if}
					</td>
					<td>
						<button
							class="val"
							class:ruled={rule}
							type="button"
							aria-expanded={editing === row.series.id}
							title={rule ? `Resaltada si ${rule.op === '>' ? 'pasa de' : 'baja de'} ${nf(rule.v, d)}` : 'Resaltar si pasa de…'}
							onclick={() => startEdit(row)}>{nf(last.v, d)}{row.series.unit === '%' ? ' %' : ''}</button
						>
					</td>
					<td><Change value={diff} digits={pct ? 1 : d} unit={pct ? ' %' : ''} invert={row.inverse} /></td>
					{#each extra as x (x.head)}<td><Change value={x.value(row.series)} digits={x.digits ?? d} unit={x.unit ?? ''} invert={row.inverse} /></td>{/each}
					<td class="mut per">{period(last.t)}</td>
					{#if anyNext}<td class="mut nx" title={nx?.title}>{nx ? shortDay(nx.date) : ''}</td>{/if}
					<td class="sp"><Spark values={pts.slice(-spark).map((p) => p.v)} /></td>
				</tr>
				{#if editing === row.series.id}
					<tr class="edit">
						<td colspan={cols}>
							<form onsubmit={(e) => save(row, e)}>
								Resaltar si
								<select bind:value={op} aria-label="Por encima o por debajo">
									<option value=">">pasa de</option>
									<option value="<">baja de</option>
								</select>
								<input bind:value={text} inputmode="decimal" aria-label="Umbral" placeholder={nf(last.v, d)} />
								<button type="submit" class="go">Guardar</button>
								{#if rule}<button type="button" class="off" onclick={() => ((editing = null), removeRule(row.series.id))}>Quitar</button>{/if}
							</form>
						</td>
					</tr>
				{/if}
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

	/* La cifra es un botón sin aspecto de botón: tocarla abre el umbral. Con umbral, subrayado discreto. */
	.val {
		all: unset;
		cursor: pointer;
	}

	.val:focus-visible {
		outline: var(--hair) solid var(--amber);
	}

	.val.ruled {
		text-decoration: underline dotted var(--faint);
		text-underline-offset: var(--sp-3);
	}

	/* Fila que ha cruzado su umbral: un borde de acento de 1 px, nada más. */
	tr.hit {
		outline: var(--hair) solid var(--amber);
		outline-offset: calc(-1 * var(--hair));
	}

	.edit form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6) var(--sp-8);
		color: var(--muted);
		font-size: var(--fs-s);
		white-space: normal;
	}

	.edit select,
	.edit input {
		height: var(--control-h);
		padding: 0 var(--sp-6);
		background: var(--raise);
		border: var(--border);
		color: var(--fg);
		font-size: var(--fs-s);
	}

	.edit input {
		width: 7em;
		font-family: var(--mono);
	}

	.edit .off {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: none;
		border: var(--border);
		color: var(--muted);
		font-size: var(--fs-s);
		cursor: pointer;
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
