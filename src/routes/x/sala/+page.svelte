<!--
	Experiencia «Sala de control»: el mundo en un mapa grande (pantalla completa con un botón), por capas, y un
	lateral con el último minuto. Lo nuevo desde tu última visita destella, y las regiones con novedades se
	encienden arriba: al tocarlas, el mapa se acerca a esa región. Cada 5 minutos vuelve a pedir los datos (la web
	se publica de nuevo cada pocos minutos) y lo que llega destella también. Lógica en src/lib/exp/sala.ts.
-->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ExpHeader from '#lib/components/ExpHeader.svelte';
	import Globe from '#lib/components/Globe.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { EXPERIENCES } from '#lib/experiences.ts';
	import { newByRegion, SALA_LAYERS, type SalaPoint } from '#lib/exp/sala.ts';
	import { hm, when } from '#lib/format.ts';
	import type { RegionId } from '#lib/regions.ts';
	import { shown } from '#lib/titles.svelte.ts';
	import { initVisit, isNew, visit } from '#lib/visit.svelte.ts';
	import { LAND } from '#lib/world.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const exp = EXPERIENCES.find((e) => e.id === 'sala')!;
	const href = (path: string) => (resolve as (r: string) => string)(path);

	$effect(initVisit);

	/** Encuadre de cada región en coordenadas del mapa (x = longitud + 180, y = 90 − latitud). */
	const VIEWS: Record<RegionId | 'all', string> = {
		all: '0 8 360 150',
		europa: '150 16 80 44',
		america: '10 14 150 132',
		asia: '235 25 125 110',
		oriente: '200 44 48 34',
		africa: '155 50 80 76'
	};

	let layers = $state<string[]>(SALA_LAYERS.map((l) => l.value));
	let region = $state<RegionId | 'all'>('all');
	/** Mapa plano o globo 3D (el globo se carga solo si se elige). */
	let look = $state<'map' | 'globe'>('map');
	const LOOKS = [
		{ value: 'map' as const, label: 'Mapa' },
		{ value: 'globe' as const, label: 'Globo 3D' }
	];
	let selected = $state<SalaPoint | null>(null);

	const points = $derived((data.points as SalaPoint[]).filter((p) => layers.includes(p.layer)));
	const regions = $derived(newByRegion(points, visit.last));

	// Lo que llega en una recarga (y no estaba al abrir) destella aunque no tenga hora.
	let known: Set<string> | null = null;
	let fresh = $state(new Set<string>());
	$effect(() => {
		const ids = (data.points as SalaPoint[]).map((p) => p.id);
		if (!known) known = new Set(ids);
		else {
			fresh = new Set(ids.filter((id) => !known!.has(id)));
			for (const id of ids) known.add(id);
		}
	});
	$effect(() => {
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') invalidateAll();
		}, 5 * 60_000);
		return () => clearInterval(id);
	});

	const flashes = (p: SalaPoint) => fresh.has(p.id) || isNew({ time: p.t }, visit.last);
	const x = (lon: number) => lon + 180;
	const y = (lat: number) => 90 - lat;

	let stage = $state<HTMLElement>();
	// Safari del iPhone no tiene pantalla completa para páginas: sin ella, el botón no sale.
	let canFull = $state(false);
	$effect(() => {
		canFull = !!document.fullscreenEnabled;
	});
	const full = () => (document.fullscreenElement ? document.exitFullscreen() : stage?.requestFullscreen?.());

	const flashSet = $derived(new Set(points.filter(flashes).map((p) => p.id)));
	const now = $derived(clock.now || (data.fetchedAt ? Date.parse(data.fetchedAt) : 0));
	const pick = (p: SalaPoint) => (selected = selected?.id === p.id ? null : p);
</script>

<ExpHeader {exp} sub="Todo lo que pasa en el mundo, en el mapa">
	{#snippet aside()}{#if canFull}<button type="button" class="full" onclick={full}>⤢ Pantalla completa</button>{/if}{/snippet}
</ExpHeader>

<section class="stage" bind:this={stage}>
	<div class="regions" role="group" aria-label="Regiones">
		<button type="button" class:on={region === 'all'} onclick={() => (region = 'all')}>Mundo</button>
		{#each regions as r (r.id)}
			<button type="button" class:on={region === r.id} class:hot={r.count > 0} onclick={() => (region = region === r.id ? 'all' : r.id)}>
				{r.label}{#if r.count}<b>{r.count}</b>{/if}
			</button>
		{/each}
	</div>

	<div class="main">
		<div class="mapwrap">
			{#if look === 'globe'}
				<Globe {points} legend={SALA_LAYERS} flash={flashSet} />
			{:else}
			<svg viewBox={VIEWS[region]} role="img" aria-label="Mapa con {points.length} sucesos">
				<path class="land" d={LAND} />
				{#each points as p (p.id)}
					{@const cx = x(p.lon)}
					{@const cy = y(p.lat)}
					<g
						class="pt {p.layer}"
						class:strong={p.strong}
						class:flash={flashes(p)}
						class:on={selected?.id === p.id}
						role="button"
						tabindex="0"
						aria-label="{p.title}. {p.sub}"
						onclick={() => pick(p)}
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(p))}
					>
						<circle class="hit" {cx} {cy} r={Math.max(p.r, 4)} />
						{#if flashes(p)}<circle class="ring" {cx} {cy} r={p.r} />{/if}
						{#if p.layer === 'travel'}
							<rect class="mark" x={cx - p.r} y={cy - p.r} width={p.r * 2} height={p.r * 2} transform="rotate(45 {cx} {cy})" />
						{:else if p.layer === 'elections'}
							<rect class="mark" x={cx - p.r} y={cy - p.r} width={p.r * 2} height={p.r * 2} />
						{:else if p.layer === 'internet'}
							<path class="mark" d="M {cx} {cy - p.r * 1.2} L {cx + p.r * 1.1} {cy + p.r * 0.8} L {cx - p.r * 1.1} {cy + p.r * 0.8} Z" />
						{:else}
							<circle class="mark" {cx} {cy} r={p.r} />
						{/if}
					</g>
				{/each}
			</svg>
			{/if}
			{#if selected && look === 'map'}
				<div class="card">
					<b>{selected.title}</b>
					<span>{selected.sub}{selected.t ? ` · ${when(selected.t, now)}` : ''}</span>
					<span class="links">
						{#if selected.country}<a href="{href('/pais')}?c={selected.country}">PAIS ›</a>{/if}
						<a href={selected.url} target="_blank" rel="noopener">Abrir ›</a>
						<button type="button" onclick={() => (selected = null)} aria-label="Cerrar">✕</button>
					</span>
				</div>
			{/if}
		</div>

		<aside class="side" aria-label="Último minuto">
			<h2>Último minuto</h2>
			<ol>
				{#each data.latest as n (n.url)}
					<li class:new={isNew(n, visit.last)}>
						<time datetime={n.time}>{n.time ? hm(n.time) : ''}</time>
						<a href={n.url} target="_blank" rel="noopener">{shown(n).text}</a>
						<span>{n.source}</span>
					</li>
				{:else}
					<li class="empty">Sin titulares.</li>
				{/each}
			</ol>
		</aside>
	</div>

	<div class="layers">
		<Seg label="Capas" options={SALA_LAYERS} bind:values={layers} />
		<Seg label="Vista" options={LOOKS} bind:value={look} />
	</div>
</section>

<style>
	.layers {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
	}

	.full {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--raise);
		border: var(--border);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.stage {
		display: grid;
		gap: var(--sp-8);
		background: var(--bg);
	}

	.stage:fullscreen {
		padding: var(--sp-12);
		align-content: start;
		overflow: auto;
	}

	.regions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4);
	}

	.regions button {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--panel);
		border: var(--border);
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		text-transform: uppercase;
		cursor: pointer;
	}

	.regions button.on {
		color: var(--fg);
		border-color: var(--amber-dim);
	}

	.regions b {
		color: var(--amber);
		font-weight: var(--fw-bold);
	}

	.regions .hot {
		animation: glow 2.4s ease-in-out infinite;
	}

	@keyframes glow {
		50% {
			border-color: var(--amber);
		}
	}

	.main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: var(--gutter);
	}

	.mapwrap {
		position: relative;
		align-self: start;
		background: var(--panel);
		border: var(--border);
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: calc(100dvh - 240px);
	}

	.stage:fullscreen svg {
		max-height: calc(100dvh - 120px);
	}

	.land {
		fill: var(--raise);
		stroke: var(--line);
		vector-effect: non-scaling-stroke;
		stroke-width: 1;
	}

	.pt {
		cursor: pointer;
		outline: none;
	}

	.hit {
		fill: transparent;
	}

	.mark {
		vector-effect: non-scaling-stroke;
		stroke-width: 1;
		fill: var(--amber-soft);
		stroke: var(--amber-dim);
	}

	.conflict .mark,
	.strong .mark {
		fill: var(--amber-edge);
		stroke: var(--amber);
	}

	.quakes .mark,
	.straits .mark {
		fill: none;
		stroke: var(--amber);
	}

	.airspace .mark {
		fill: none;
		stroke: var(--amber-dim);
		stroke-dasharray: 2 2;
	}

	.elections .mark,
	.internet .mark {
		fill: none;
		stroke: var(--fg);
	}

	.pt:focus-visible .mark,
	.pt.on .mark {
		stroke: var(--fg);
		stroke-width: 2;
	}

	/* Lo nuevo: un anillo que se expande y se apaga, una y otra vez. */
	.ring {
		fill: none;
		stroke: var(--amber);
		vector-effect: non-scaling-stroke;
		stroke-width: 1.5;
		transform-box: fill-box;
		transform-origin: center;
		animation: ping 1.8s ease-out infinite;
	}

	@keyframes ping {
		from {
			transform: scale(1);
			opacity: 0.9;
		}
		to {
			transform: scale(4);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ring,
		.regions .hot {
			animation: none;
		}
	}

	.card {
		position: absolute;
		left: var(--sp-8);
		right: var(--sp-8);
		bottom: var(--sp-8);
		display: grid;
		gap: var(--sp-2);
		max-width: 420px;
		padding: var(--sp-8) var(--pad-x);
		background: var(--panel);
		border: var(--hair) solid var(--amber-dim);
		font-size: var(--fs-s);
	}

	.card span {
		color: var(--muted);
	}

	.links {
		display: flex;
		gap: var(--sp-12);
		align-items: center;
	}

	.links a {
		color: var(--amber);
		text-decoration: none;
	}

	.links button {
		margin-left: auto;
		background: none;
		border: 0;
		color: var(--muted);
		cursor: pointer;
		font: inherit;
	}

	/* El lateral no da alto a la fila: mide lo que el mapa, y lo demás va con scroll. */
	.side {
		height: 0;
		min-height: 100%;
		background: var(--panel);
		border: var(--border);
		overflow: auto;
	}

	h2 {
		position: sticky;
		top: 0;
		margin: 0;
		padding: var(--head-y) var(--pad-x);
		background: var(--panel);
		border-bottom: var(--border);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--amber);
		text-transform: uppercase;
		letter-spacing: var(--track-code);
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0 var(--sp-8);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
		font-size: var(--fs-s);
	}

	li time {
		font-family: var(--mono);
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	li.new time {
		color: var(--amber);
	}

	li a {
		color: var(--fg);
		text-decoration: none;
		line-height: var(--lh-snug);
	}

	li a:hover {
		text-decoration: underline;
	}

	li span {
		grid-column: 2;
		color: var(--faint);
		font-size: var(--fs-xxs);
	}

	@media (max-width: 1023px) {
		.main {
			grid-template-columns: 1fr;
		}

		.side {
			height: auto;
			min-height: 0;
			max-height: 60vh;
		}
	}
</style>
