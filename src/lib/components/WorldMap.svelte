<!--
	Mapa del mundo con puntos: terremotos (rojo, tamaño según magnitud), huracanes (anillo) y otros eventos
	naturales (ámbar). Proyección equirectangular: sencilla y suficiente para situar cada cosa.
-->
<script lang="ts">
	import { nf } from '#lib/format.ts';
	import type { NaturalEvent, Quake, Storm } from '#lib/types.ts';
	import { LAND } from '#lib/world.ts';

	interface Props {
		quakes?: Quake[];
		storms?: Storm[];
		events?: NaturalEvent[];
	}

	let { quakes = [], storms = [], events = [] }: Props = $props();

	const x = (lon: number) => lon + 180;
	const y = (lat: number) => 90 - lat;
	const ok = (p: { lat: number; lon: number }) => Number.isFinite(p.lat) && Number.isFinite(p.lon);
</script>

<div class="map">
	<svg viewBox="0 8 360 150" role="img" aria-label="Mapa: {quakes.length} terremotos, {storms.length} ciclones y {events.length} eventos naturales">
		<path class="land" d={LAND} />
		<!-- Cada punto enlaza a su fuente: en el móvil, se toca y se abre. -->
		{#each events.filter(ok) as e (e.id)}
			<a href={e.url} target="_blank" rel="noopener">
				<circle class="ev" cx={x(e.lon)} cy={y(e.lat)} r="0.9"><title>{e.title}</title></circle>
			</a>
		{/each}
		{#each quakes.filter(ok) as q (q.id)}
			<a href={q.url} target="_blank" rel="noopener">
				<circle class="eq" class:big={q.mag >= 6} cx={x(q.lon)} cy={y(q.lat)} r={Math.max(0.8, (q.mag - 4) * 1.1)}>
					<title>M{nf(q.mag, 1)} · {q.place}</title>
				</circle>
			</a>
		{/each}
		{#each storms.filter(ok) as s (s.id)}
			<a href={s.url} target="_blank" rel="noopener">
				<circle class="st" cx={x(s.lon)} cy={y(s.lat)} r="2.6"><title>{s.name} · {s.classification}</title></circle>
			</a>
		{/each}
	</svg>
	<p class="legend">
		<span><i class="eq"></i>Terremotos M4,5+</span>
		<span><i class="st"></i>Ciclones tropicales</span>
		<span><i class="ev"></i>Incendios, volcanes y tormentas</span>
	</p>
</div>

<style>
	.map {
		padding: 8px 12px 4px;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	/* Trazos de 1 px, se vea el mapa al tamaño que se vea. */
	.land,
	circle {
		vector-effect: non-scaling-stroke;
	}

	.land {
		fill: var(--raise);
		stroke: var(--line);
		stroke-width: 1;
	}

	/* Rojo y verde quedan para subidas y bajadas: los terremotos van en ámbar. */
	.eq {
		fill: var(--amber-soft);
		stroke: var(--amber);
		stroke-width: 1;
	}

	.eq.big {
		fill: var(--amber-edge);
	}

	.st {
		fill: none;
		stroke: var(--fg);
		stroke-width: 1;
	}

	.ev {
		fill: var(--muted);
	}

	a:hover circle {
		stroke: var(--fg);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin: 6px 0 2px;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.legend i {
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-right: 6px;
		border-radius: 50%;
		vertical-align: -1px;
	}

	.legend i.eq {
		background: var(--amber-soft);
		border: 1px solid var(--amber);
	}

	.legend i.st {
		border: 1px solid var(--fg);
	}

	.legend i.ev {
		background: var(--muted);
	}
</style>
