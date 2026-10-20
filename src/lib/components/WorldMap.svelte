<!--
	Mapa del mundo con capas de puntos (src/lib/geo/layers.ts): terremotos, ciclones, incendios y volcanes,
	estrechos y sanciones por país. Proyección equirectangular: sencilla y suficiente para situar
	cada cosa. Al tocar un punto sale una ficha con el enlace a su fuente y, si es un país, a su ficha en PAIS.
	Colores: ámbar y grises del tema; rojo y verde quedan para subidas y bajadas.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { LAND_HREF } from '#lib/geo/land.ts';
	import type { LayerId, MapPoint } from '#lib/geo/layers.ts';

	interface Props {
		points: MapPoint[];
		/** Texto de la leyenda de cada capa que se ve. */
		legend?: { value: LayerId; label: string }[];
	}

	let { points, legend = [] }: Props = $props();

	let selected = $state<MapPoint | null>(null);

	/** Radio mínimo de la zona de toque, en grados del mapa (unos 10 px en un móvil). */
	const HIT = 5;

	const x = (lon: number) => lon + 180;
	const y = (lat: number) => 90 - lat;
	// Si la capa del punto elegido se apaga, la ficha se cierra.
	const shown = $derived(selected && points.some((p) => p.id === selected!.id) ? selected : null);
	const present = $derived(legend.filter((l) => points.some((p) => p.layer === l.value)));

	function pick(p: MapPoint, e?: KeyboardEvent) {
		if (e && e.key !== 'Enter' && e.key !== ' ') return;
		e?.preventDefault();
		selected = shown?.id === p.id ? null : p;
	}
</script>

<div class="map">
	<svg viewBox="0 8 360 150" role="img" aria-label="Mapa del mundo con {points.length} puntos">
		<!-- El contorno, desde land.svg (un archivo en caché, compartido entre vistas): fuera del HTML y del JS. -->
		<use class="land" href={LAND_HREF} />
		{#each points as p (p.id)}
			{@const cx = x(p.lon)}
			{@const cy = y(p.lat)}
			<g
				class="pt {p.layer}"
				class:strong={p.strong}
				class:on={shown?.id === p.id}
				role="button"
				tabindex="0"
				aria-label="{p.title}. {p.sub}"
				onclick={() => pick(p)}
				onkeydown={(e) => pick(p, e)}
			>
				<!-- Pegado al borde (±180°, Fiyi o las Aleutianas), también al otro lado: si no, sale cortado por la mitad. -->
				{#each [0, ...(p.lon > 175 ? [-360] : p.lon < -175 ? [360] : [])] as dx (dx)}
					<g transform="translate({dx} 0)">
						<!-- Zona de toque invisible y más grande que el punto: en el móvil, los puntos miden pocos px. -->
						<circle class="hit" {cx} {cy} r={Math.max(p.r, HIT)} />
						{#if p.layer === 'sanctions'}
							<rect x={cx - p.r} y={cy - p.r} width={p.r * 2} height={p.r * 2} transform="rotate(45 {cx} {cy})" />
						{:else}
							<circle {cx} {cy} r={p.r} />
						{/if}
					</g>
				{/each}
				<title>{p.title} · {p.sub}</title>
			</g>
		{/each}
	</svg>

	{#if shown}
		<div class="card">
			<div class="txt">
				<b>{shown.title}</b>
				<span>{shown.sub}</span>
			</div>
			{#if shown.country}<a href="{resolve('/pais')}?c={shown.country}">PAIS ›</a>{/if}
			<a href={shown.url} target="_blank" rel="noopener">Abrir ›</a>
			<button type="button" aria-label="Cerrar la ficha" onclick={() => (selected = null)}>×</button>
		</div>
	{/if}

	{#if present.length}
		<p class="legend">
			{#each present as l (l.value)}<span><i class={l.value}></i>{l.label}</span>{/each}
		</p>
	{/if}
</div>

<style>
	.map {
		padding: var(--sp-8) var(--pad-x) var(--sp-4);
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	/* Trazos de 1 px, se vea el mapa al tamaño que se vea. */
	.land,
	circle,
	rect {
		vector-effect: non-scaling-stroke;
		stroke-width: 1;
	}

	.land {
		fill: var(--raise);
		stroke: var(--line);
	}

	.pt {
		cursor: pointer;
		outline: none;
	}

	.pt .hit {
		fill: transparent;
		stroke: none;
		pointer-events: all;
	}

	.quakes circle {
		fill: var(--amber-soft);
		stroke: var(--amber);
	}

	.strong circle,
	.strong rect {
		fill: var(--amber-edge);
	}

	.storms circle {
		fill: none;
		stroke: var(--fg);
	}

	.events circle {
		fill: var(--muted);
		stroke: none;
	}

	.straits circle {
		fill: none;
		stroke: var(--amber);
	}

	/* Espacio aéreo en conflicto: anillo discontinuo, sin relleno. */
	.airspace circle:not(.hit) {
		fill: none;
		stroke: var(--amber);
		stroke-dasharray: 2 2;
	}

	/* Avisos a barcos: punto pequeño y relleno, sin borde. */
	/* Puntos pequeños y sin borde: con el ámbar casi transparente de los fondos no se veían. */
	.maritime circle:not(.hit) {
		fill: var(--amber-edge);
		stroke: none;
	}

	.sanctions rect {
		fill: var(--amber-soft);
		stroke: var(--amber);
	}

	/* :not(.hit): la zona de toque invisible no se pinta al pasar el ratón ni al tocarla. */
	.pt:hover circle:not(.hit),
	.pt:hover rect,
	.pt:focus-visible circle:not(.hit),
	.pt:focus-visible rect,
	.on circle:not(.hit),
	.on rect {
		stroke: var(--fg);
	}

	.card {
		display: flex;
		align-items: center;
		gap: var(--sp-10);
		margin-top: var(--sp-6);
		padding: var(--sp-6) var(--sp-10);
		border: var(--border);
		background: var(--raise);
		font-size: var(--fs-s);
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.txt b {
		font-family: var(--sans);
		font-weight: var(--fw-medium);
	}

	.txt span {
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card a {
		color: var(--amber);
		text-decoration: none;
		white-space: nowrap;
	}

	.card button {
		background: none;
		border: 0;
		color: var(--muted);
		cursor: pointer;
		font-size: var(--fs-l);
		min-width: var(--touch);
		min-height: var(--touch);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-16);
		margin: var(--sp-6) 0 var(--sp-2);
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.legend i {
		display: inline-block;
		width: var(--swatch);
		height: var(--swatch);
		margin-right: var(--sp-6);
		border-radius: 50%;
		vertical-align: calc(-1 * var(--hair));
		border: var(--hair) solid var(--amber);
	}

	.legend i.quakes {
		background: var(--amber-soft);
	}

	.legend i.storms {
		border-color: var(--fg);
	}

	.legend i.events {
		background: var(--muted);
		border-color: var(--muted);
	}

	.legend i.airspace {
		border-style: dashed;
	}

	.legend i.maritime {
		background: var(--amber-edge);
		border-color: transparent;
	}

	.legend i.sanctions {
		border-radius: 0;
		transform: rotate(45deg);
		background: var(--amber-soft);
	}
</style>
