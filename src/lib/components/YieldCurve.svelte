<!-- Curva de tipos del Tesoro de EE. UU.: hoy (ámbar) frente a hace un mes (gris), y tabla con la variación. -->
<script lang="ts">
	import { nf, period } from '#lib/format.ts';
	import Change from './ui/Change.svelte';
	import Table from './ui/Table.svelte';
	import type { YieldCurveData } from '#lib/types.ts';

	let { curve }: { curve: YieldCurveData } = $props();

	const today = $derived(curve.days.at(-1));
	const before = $derived(curve.days.at(-Math.min(curve.days.length, 22)));

	const W = 520;
	const H = 170;
	const pad = { l: 34, r: 12, t: 12, b: 24 };

	const all = $derived(
		[...(today?.values ?? []), ...(before?.values ?? [])].filter((v): v is number => v !== null)
	);
	const lo = $derived(Math.floor(Math.min(...all) * 4) / 4);
	const hi = $derived(Math.ceil(Math.max(...all) * 4) / 4);
	const x = (i: number) => pad.l + (i / (curve.tenors.length - 1)) * (W - pad.l - pad.r);
	const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
	const line = (values: (number | null)[]) =>
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
</script>

{#if today}
	<svg class="curve" viewBox="0 0 {W} {H}" role="img" aria-label="Curva de tipos de EE. UU. del {today.date}">
		{#each ticks as t (t)}
			<line class="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
			<text class="lbl" x={pad.l - 6} y={y(t) + 4} text-anchor="end">{nf(t, t % 1 ? 1 : 0)}</text>
		{/each}
		{#each curve.tenors as tenor, i (tenor)}
			<text class="lbl" x={x(i)} y={H - 6} text-anchor="middle">{tenor}</text>
		{/each}
		{#if before && before !== today}<polyline class="prev" points={line(before.values)} />{/if}
		<polyline class="now" points={line(today.values)} />
		{#each today.values as v, i (i)}
			{#if v !== null}<circle cx={x(i)} cy={y(v)} r="2.5" />{/if}
		{/each}
	</svg>
	<Table>
		<thead>
			<tr>
				<th>Plazo</th>
				<th>{period(today.date)}</th>
				{#if before}<th>{period(before.date)}</th><th>Var. (pb)</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each curve.tenors as tenor, i (tenor)}
				{@const a = today.values[i]}
				{@const b = before?.values[i] ?? null}
				<tr>
					<td>{tenor}</td>
					<td>{a === null ? '—' : `${nf(a, 2)} %`}</td>
					{#if before}
						<td class="mut">{b === null ? '—' : `${nf(b, 2)} %`}</td>
						<td><Change value={a !== null && b !== null ? Math.round((a - b) * 100) : null} digits={0} /></td>
					{/if}
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

	.now {
		stroke: var(--amber);
	}

	.prev {
		stroke: var(--faint);
		stroke-dasharray: 3 4;
	}

	circle {
		fill: var(--amber);
	}
</style>
