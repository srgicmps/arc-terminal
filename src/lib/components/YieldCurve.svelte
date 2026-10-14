<!--
	Curva de tipos.
	- Con `curve`: una sola curva, hoy (ámbar) frente a hace un mes (gris), y tabla con la variación por plazo.
	- Con `curves`: varias curvas de hoy (cada una con su color) y, en tenue, las de hace un año, sobre los
	  plazos que tienen en común; debajo, una tabla con 2A, 10A, la pendiente y la variación semanal.
-->
<script lang="ts">
	import { curveRow, dayAt, daysBefore } from '#lib/curves.ts';
	import { nf, period } from '#lib/format.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import type { YieldCurveData } from '#lib/types.ts';

	interface Props {
		curve?: YieldCurveData;
		curves?: { label: string; curve: YieldCurveData | undefined }[];
		/** Con `curve`: valores en puntos (el VIX), no en %: sin «%», la variación en puntos y en rojo si sube. */
		points?: boolean;
	}

	let { curve, curves, points = false }: Props = $props();

	/** Plazos del gráfico comparado: los que publican las tres fuentes (Japón empieza en 1A). */
	const AXIS = ['3M', '1A', '2A', '5A', '10A', '30A'];

	interface Line {
		values: (number | null)[];
		cls: string;
	}

	const single = $derived.by(() => {
		if (!curve) return null;
		const today = curve.days.at(-1);
		if (!today) return null;
		const before = curve.days.at(-Math.min(curve.days.length, 22));
		return { today, before: before && before !== today ? before : undefined };
	});

	// Modo comparado: para cada curva, sus valores de hoy y de hace un año en los plazos de AXIS.
	const compared = $derived(
		(curves ?? []).flatMap(({ label, curve: c }, n) => {
			const today = c?.days.at(-1);
			if (!c || !today) return [];
			const year = dayAt(c, daysBefore(today.date, 365));
			const pick = (day: typeof today | null) =>
				AXIS.map((t) => {
					const i = c.tenors.indexOf(t);
					return i < 0 || !day ? null : (day.values[i] ?? null);
				});
			return [{ label, n: n + 1, now: pick(today), year: year ? pick(year) : null, row: curveRow(c) }];
		})
	);

	const labels = $derived(curve ? curve.tenors : AXIS);
	const lines = $derived<Line[]>(
		curve
			? [
					...(single?.before ? [{ values: single.before.values, cls: 'prev' }] : []),
					...(single ? [{ values: single.today.values, cls: 'now s1' }] : [])
				]
			: [
					...compared.flatMap((c) => (c.year ? [{ values: c.year, cls: `year s${c.n}` }] : [])),
					...compared.map((c) => ({ values: c.now, cls: `now s${c.n}` }))
				]
	);

	const W = 520;
	const H = 170;
	const pad = { l: 34, r: 12, t: 12, b: 24 };

	const all = $derived(lines.flatMap((l) => l.values).filter((v): v is number => v !== null));
	const lo = $derived(Math.floor(Math.min(...all) * 4) / 4);
	const hi = $derived(Math.ceil(Math.max(...all) * 4) / 4);
	const x = (i: number) => pad.l + (i / (labels.length - 1)) * (W - pad.l - pad.r);
	const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
	const path = (values: (number | null)[]) =>
		values
			.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
			.filter(Boolean)
			.join(' ');
	const ticks = $derived.by(() => {
		const step = hi - lo > 2 ? 1 : 0.5;
		const out: number[] = [];
		for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);
		return out;
	});
	const pct = (v: number | null) => (v === null ? '—' : points ? nf(v, 2) : `${nf(v, 2)} %`);
	/** Variación entre dos días: en pb para los tipos y en puntos (dos decimales) con `points`. */
	const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : points ? a - b : Math.round((a - b) * 100));
	// Cursor (como en LineChart): el plazo más cercano al ratón o al dedo, y sus valores debajo del gráfico.
	let hover = $state<number | null>(null);
	function onmove(e: PointerEvent) {
		// Del punto de la pantalla a las coordenadas del viewBox (ya cuenta el padding y la escala).
		const m = (e.currentTarget as SVGSVGElement).getScreenCTM();
		if (!m) return;
		const px = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).x;
		const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (labels.length - 1));
		hover = Math.max(0, Math.min(labels.length - 1, i));
	}
	/** Lo que se lee en el plazo señalado: hoy y el día de comparación de cada curva. */
	const readout = $derived.by(() => {
		const i = hover;
		if (i === null) return [];
		if (curve && single) {
			return [{ label: 'Hoy', now: single.today.values[i] ?? null, before: single.before?.values[i] ?? null, when: single.before ? period(single.before.date) : '' }];
		}
		return compared.map((c) => ({ label: c.label, now: c.now[i], before: c.year?.[i] ?? null, when: 'hace un año' }));
	});

	const aria = $derived(
		curve ? `Curva ${points ? 'de volatilidad' : 'de tipos'} del ${single?.today.date}` : `Curvas de tipos de ${compared.map((c) => c.label).join(', ')}`
	);
</script>

{#if all.length}
	<svg
		class="curve"
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label={aria}
		onpointermove={onmove}
		onpointerdown={onmove}
		onpointerleave={(e) => {
			// Con el dedo, el navegador «sale» al levantarlo: el valor se queda hasta tocar en otro sitio.
			if (e.pointerType !== 'touch') hover = null;
		}}
	>
		{#each ticks as t (t)}
			<line class="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
			<text class="lbl" x={pad.l - 6} y={y(t) + 4} text-anchor="end">{nf(t, t % 1 ? 1 : 0)}</text>
		{/each}
		{#each labels as label, i (label)}
			<text class="lbl" x={x(i)} y={H - 6} text-anchor="middle">{label}</text>
		{/each}
		{#each lines as l, k (k)}
			<polyline class={l.cls} points={path(l.values)} />
		{/each}
		{#each lines.filter((l) => l.cls.startsWith('now')) as l, k (k)}
			{#each l.values as v, i (i)}
				{#if v !== null}<circle class={l.cls} cx={x(i)} cy={y(v)} r="2.5" />{/if}
			{/each}
		{/each}
		{#if hover !== null}
			<line class="cursor" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} />
		{/if}
	</svg>
	{#if hover !== null}
		<p class="readout" aria-live="polite">
			<b>{labels[hover]}</b>
			{#each readout as r (r.label)}
				<span>{r.label} {pct(r.now)}{#if r.before !== null}<span class="mut">{' · '}{r.when} {pct(r.before)}</span>{/if}</span>
			{/each}
		</p>
	{/if}
{/if}

{#if curve && single}
	<Table>
		<thead>
			<tr>
				<th>Plazo</th>
				<th>{period(single.today.date)}</th>
				{#if single.before}<th>{period(single.before.date)}</th><th>{points ? 'Var.' : 'Var. (pb)'}</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each curve.tenors as t, i (t)}
				{@const a = single.today.values[i]}
				{@const b = single.before?.values[i] ?? null}
				<tr>
					<td>{t}</td>
					<td>{pct(a)}</td>
					{#if single.before}
						<td class="mut">{pct(b)}</td>
						<td><Change value={diff(a, b)} digits={points ? 2 : 0} invert={points} /></td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</Table>
{:else if compared.length}
	<ul class="legend">
		{#each compared as c (c.label)}
			<li class="s{c.n}"><i></i>{c.label}</li>
		{/each}
		<li class="past"><i></i>Hace un año</li>
	</ul>
	<Table>
		<thead>
			<tr>
				<th class="l">Curva</th>
				<th>2A</th>
				<th>10A</th>
				<th>10A−2A (pb)</th>
				<th>10A sem. (pb)</th>
			</tr>
		</thead>
		<tbody>
			{#each compared as c (c.label)}
				<tr>
					<td class="l name">{c.label}{#if c.row}<span class="sub">{period(c.row.date)}</span>{/if}</td>
					<td>{pct(c.row?.y2 ?? null)}</td>
					<td>{pct(c.row?.y10 ?? null)}</td>
					<td><Change value={c.row?.slope} digits={0} /></td>
					<td><Change value={c.row?.week10} digits={0} /></td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.curve {
		display: block;
		width: 100%;
		height: auto;
		padding: var(--sp-8) var(--sp-4) 0;
		touch-action: pan-y;
	}

	.cursor {
		stroke: var(--muted);
		stroke-dasharray: 2 3;
	}

	.readout {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2) var(--sp-12);
		margin: 0;
		padding: var(--sp-4) var(--pad-x) var(--sp-6);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.readout b {
		color: var(--amber);
		font-weight: var(--fw-medium);
	}

	.grid {
		stroke: var(--line);
	}

	.lbl {
		fill: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	polyline {
		fill: none;
		stroke-width: 1.6;
		stroke-linejoin: round;
	}

	/* Cada curva con su color: la primera en ámbar, las demás con los colores de serie de los tokens. */
	.s1 {
		--c: var(--amber);
	}
	.s2 {
		--c: var(--series-2);
	}
	.s3 {
		--c: var(--series-3);
	}

	.now {
		stroke: var(--c);
	}

	circle {
		fill: var(--c);
		stroke: none;
	}

	.prev {
		stroke: var(--faint);
		stroke-dasharray: 3 4;
	}

	/* Las curvas de hace un año: el mismo color, tenue y a trazos. */
	.year {
		stroke: var(--c);
		stroke-opacity: 0.35;
		stroke-width: 1.2;
		stroke-dasharray: 3 4;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-14);
		margin: 0;
		padding: var(--sp-6) var(--pad-x);
		list-style: none;
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
	}

	.legend i {
		width: var(--sp-12);
		border-top: var(--sp-2) solid var(--c);
	}

	.legend .past i {
		border-top: var(--hair) dashed var(--faint);
	}
</style>
