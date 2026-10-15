<!--
	Reloj de la Cabina: esfera de media luna con sus zonas (calma, vigilar, tensión) y una aguja que entra
	animada desde el mínimo. Geometría y zonas en src/lib/exp/cabina.ts.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { arcPath, levelOf, needleAngle, zoneArcs, type GaugeDef } from '#lib/exp/cabina.ts';

	interface Props {
		gauge: GaugeDef;
		value: number;
		/** El valor ya escrito («2,4 %»). */
		text: string;
		/** Línea de abajo (fecha del dato, cambio…). */
		sub?: string;
		href?: string;
	}

	let { gauge, value, text, sub, href }: Props = $props();

	const R = 40;
	// La aguja sale del mínimo y va a su sitio al montarse (como un salpicadero al arrancar).
	let ready = $state(false);
	onMount(() => {
		const id = requestAnimationFrame(() => (ready = true));
		return () => cancelAnimationFrame(id);
	});
	const angle = $derived(ready ? needleAngle(gauge, value) : -90);
	const level = $derived(levelOf(gauge, value));
</script>

<svelte:element this={href ? 'a' : 'div'} class="gauge {level}" {href}>
	<span class="label">{gauge.label}</span>
	<svg viewBox="-50 -48 100 56" role="img" aria-label="{gauge.label}: {text}, {gauge.meaning[level]}">
		{#each zoneArcs(gauge) as z, i (i)}
			<path class="zone {z.level}" d={arcPath(z.from, z.to, R)} />
		{/each}
		<g class="needle" style:transform="rotate({angle}deg)">
			<line x1="0" y1="0" x2="0" y2={-R + 4} />
		</g>
		<circle class="hub" r="3" />
	</svg>
	<span class="value">{text}</span>
	<span class="meaning">{gauge.meaning[level]}</span>
	{#if sub}<span class="sub">{sub}</span>{/if}
</svelte:element>

<style>
	.gauge {
		display: grid;
		justify-items: center;
		gap: var(--sp-2);
		padding: var(--sp-12) var(--sp-8);
		background: var(--panel);
		border: var(--border);
		color: inherit;
		text-decoration: none;
	}

	a.gauge:hover,
	a.gauge:focus-visible {
		border-color: var(--amber-dim);
	}

	.label {
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: var(--track-code);
	}

	svg {
		width: 100%;
		max-width: 180px;
		overflow: visible;
	}

	.zone {
		fill: none;
		stroke-width: 6;
	}

	.zone.calm {
		stroke: var(--line);
	}

	.zone.watch {
		stroke: var(--amber-dim);
		opacity: 0.55;
	}

	.zone.stress {
		stroke: var(--amber);
		opacity: 0.85;
	}

	.needle {
		transition: transform 1.2s cubic-bezier(0.2, 0.9, 0.25, 1.1);
	}

	.needle line {
		stroke: var(--fg);
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	.hub {
		fill: var(--fg);
	}

	@media (prefers-reduced-motion: reduce) {
		.needle {
			transition: none;
		}
	}

	.value {
		font-family: var(--mono);
		font-size: var(--fs-xl);
	}

	.meaning {
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.stress .meaning {
		color: var(--amber);
	}

	.sub {
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		color: var(--faint);
	}
</style>
