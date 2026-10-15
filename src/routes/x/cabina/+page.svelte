<!--
	Experiencia «Cabina»: los indicadores clave como relojes con aguja y zonas (calma, vigilar, tensión) y el
	semáforo de riesgo debajo. Arriba, una frase con lo que está en tensión. Zonas en src/lib/exp/cabina.ts.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import ExpHeader from '#lib/components/ExpHeader.svelte';
	import RiskLights from '#lib/components/RiskLights.svelte';
	import Gauge from '#lib/components/exp/Gauge.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { EXPERIENCES } from '#lib/experiences.ts';
	import { GAUGES, levelOf } from '#lib/exp/cabina.ts';
	import { nf, period, signed } from '#lib/format.ts';
	import { hourLabel, madridNow } from '#lib/power.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const exp = EXPERIENCES.find((e) => e.id === 'cabina')!;
	const href = (path: string) => (resolve as (r: string) => string)(path);

	const now = $derived(clock.now || (data.fetchedAt ? Date.parse(data.fetchedAt) : 0));
	const hourNow = $derived.by(() => {
		if (!now) return null;
		const m = madridNow(now);
		return data.pvpc.find((p) => p.day === m.day && p.hour === m.hour && !!p.repeat === m.repeat) ?? null;
	});

	const dials = $derived(
		GAUGES.flatMap((g) => {
			if (g.id === 'riesgo')
				return data.risk === null ? [] : [{ g, value: data.risk, text: signed(data.risk, 0), sub: 'de −100 a +100', view: '/ws' }];
			if (g.id === 'luz')
				return hourNow ? [{ g, value: hourNow.kwh, text: `${nf(hourNow.kwh, 3)} €/kWh`, sub: `a las ${hourLabel(hourNow)}`, view: '/luz' }] : [];
			const f = data.figures.find((x) => x.id === g.figure);
			return f ? [{ g, value: f.value, text: f.text, sub: `${period(f.t)}${f.changeText ? ` · ${f.changeText}` : ''}`, view: f.view }] : [];
		})
	);
	const tense = $derived(dials.filter((d) => levelOf(d.g, d.value) === 'stress'));
	const watch = $derived(dials.filter((d) => levelOf(d.g, d.value) === 'watch'));
	const headline = $derived(
		tense.length
			? `En tensión: ${tense.map((d) => d.g.label).join(', ')}.`
			: watch.length
				? `Sin alarmas. A vigilar: ${watch.map((d) => d.g.label).join(', ')}.`
				: 'Todo en calma.'
	);
</script>

<ExpHeader {exp} sub="De un vistazo: cada aguja, en su zona" />

<p class="headline" class:alert={tense.length > 0}>{dials.length ? headline : 'Todavía no hay datos.'}</p>

<div class="dials">
	{#each dials as d (d.g.id)}
		<Gauge gauge={d.g} value={d.value} text={d.text} sub={d.sub} href={href(d.view)} />
	{/each}
</div>

{#if data.lights.length}
	<section class="lights" aria-label="Semáforo de riesgo">
		<h2>Semáforo de riesgo</h2>
		<RiskLights lights={data.lights} />
	</section>
{/if}

<p class="legend">
	<span><i class="calm"></i>Calma</span><span><i class="watch"></i>Vigilar</span><span><i class="stress"></i>Tensión</span>
	· Toca un reloj para ver el detalle.
</p>

<style>
	.headline {
		margin: 0 0 var(--sp-12);
		font-family: var(--sans);
		font-size: var(--fs-l);
	}

	.headline.alert {
		color: var(--amber);
	}

	.dials {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: var(--gutter);
	}

	.lights {
		margin-top: var(--sp-16);
		background: var(--panel);
		border: var(--border);
	}

	h2 {
		margin: 0;
		padding: var(--head-y) var(--pad-x);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--amber);
		text-transform: uppercase;
		letter-spacing: var(--track-code);
		border-bottom: var(--border);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-4) var(--sp-12);
		margin: var(--sp-12) 0 0;
		font-size: var(--fs-xs);
		color: var(--muted);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-4);
	}

	.legend i {
		width: var(--sp-12);
		height: var(--sp-3);
		background: var(--line);
	}

	.legend i.watch {
		background: var(--amber-dim);
		opacity: 0.55;
	}

	.legend i.stress {
		background: var(--amber);
		opacity: 0.85;
	}

	@media (max-width: 720px) {
		.dials {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	:global(:root[data-modo='sencillo']) .headline {
		font-size: var(--fs-xl);
	}
</style>
