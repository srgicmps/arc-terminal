<!--
	Mapa operacional (herramienta de Arc OS, id «mapa-op»): todas las capas de GEO y de la Sala de control en un mapa
	que llena la ventana. A la izquierda, las capas (con su recuento en el periodo); arriba, el periodo y plano o
	globo; abajo, la línea de tiempo para rebobinar; a la derecha, la ficha del suceso elegido o, si no hay ninguno,
	el registro de lo último. La lógica (puntos, filtros, rango, histograma, zoom) está en ops.ts, con tests.
	Los datos son los JSON de static/data (load.ts), se piden al abrir y cada 5 min.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import type { AppProps } from '../../apps.ts';
	import { openPath, os } from '../../os.svelte.ts';
	import { findWin } from '../../wm.ts';
	import FlatMap from './FlatMap.svelte';
	import GlobeView from './GlobeView.svelte';
	import Timeline from './Timeline.svelte';
	import { loadRaw } from './load.ts';
	import {
		ago,
		buildPoints,
		centerOn,
		countByLayer,
		fitView,
		histogram,
		isState,
		layerLabel,
		newestFirst,
		OP_LAYERS,
		parseParams,
		PERIODS,
		reaspect,
		timeRange,
		visible,
		zoomAt,
		HOUR,
		type OpLayer,
		type OpPoint,
		type PeriodId,
		type ViewBox
	} from './ops.ts';

	let { win }: AppProps = $props();

	// Parámetros de la ventana (Win.path), leídos una vez al abrir.
	const init = untrack(() => parseParams(findWin(os.state, win)?.path));

	let points = $state<OpPoint[]>([]);
	let fetchedAt = $state<string | null>(null);
	let missing = $state<string[]>([]);
	let loading = $state(true);
	let now = $state(Date.now());

	let layers = $state<OpLayer[]>(init.layers ?? OP_LAYERS.map((l) => l.value));
	let period = $state<PeriodId>(init.period ?? 'all');
	let untimed = $state(true);
	let mode = $state<'plano' | 'globo'>('plano');
	/** null: en directo. */
	let cursor = $state<number | null>(null);
	let selectedId = $state<string | null>(null);
	let hover = $state<{ lat: number; lon: number } | null>(null);

	let sw = $state(1);
	let sh = $state(1);
	const max = $derived(fitView(sw / Math.max(1, sh)));
	// $state.raw: el encuadre siempre se sustituye entero (como un ref de Vue con un objeto que no se muta).
	let view = $state.raw<ViewBox>(fitView(2));
	// Al cambiar el tamaño de la ventana, si se veía el mundo entero, se sigue viendo entero; si había zoom, el
	// mismo encuadre con la proporción nueva (si no, el mapa se deformaba y arrastrar o la rueda iban desfasados).
	let lastMax: ViewBox | null = null;
	$effect(() => {
		const m = max;
		untrack(() => {
			if (!lastMax || (view.w >= lastMax.w - 0.01 && view.h >= lastMax.h - 0.01)) view = m;
			else view = reaspect(view, m.w / m.h);
		});
		lastMax = m;
	});

	async function refresh() {
		const r = await loadRaw();
		now = Date.now();
		points = buildPoints(r.raw);
		fetchedAt = r.fetchedAt;
		missing = r.missing;
		loading = false;
	}

	$effect(() => {
		refresh();
		const id = setInterval(refresh, 5 * 60_000);
		const tick = setInterval(() => (now = Date.now()), 60_000);
		return () => {
			clearInterval(id);
			clearInterval(tick);
		};
	});

	const on = $derived(new Set(layers));
	const range = $derived(timeRange(points, now, period));
	const at = $derived(cursor === null ? range.end : Math.min(range.end, Math.max(range.start, cursor)));
	const filter = $derived({ layers: on, cursor: at, period, untimed });
	const shown = $derived(visible(points, filter));
	const counts = $derived(countByLayer(points, filter));
	const bins = $derived(
		histogram(
			points.filter((p) => on.has(p.layer)),
			range,
			72
		)
	);
	/** «Reciente»: las últimas 6 h antes del cursor (o la vigésima parte del rango, si es más corto). */
	const recentSince = $derived(at - Math.min(6 * HOUR, (range.end - range.start) / 20));
	const flash = $derived(
		new Set(shown.filter((p) => p.at !== null && p.at >= recentSince && !isState(p.layer)).map((p) => p.id))
	);
	const selected = $derived(selectedId ? (shown.find((p) => p.id === selectedId) ?? null) : null);
	// Un titular con dos países son dos puntos en el mapa, pero una sola línea en el registro.
	const log = $derived.by(() => {
		const seen = new Set<string>();
		return newestFirst(shown.filter((p) => p.at !== null && !isState(p.layer)))
			.filter((p) => {
				const k = `${p.layer}|${p.url}|${p.title}`;
				return !seen.has(k) && !!seen.add(k);
			})
			.slice(0, 60);
	});

	const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	const stamp = (t: number) => fmt.format(new Date(t)).replace('.', '');

	function pick(p: OpPoint | null) {
		selectedId = p && p.id !== selectedId ? p.id : null;
	}

	function choose(p: OpPoint) {
		selectedId = p.id;
		if (mode === 'plano') view = centerOn(view.w > 120 ? zoomAt(view, 0.5, 0.5, 0.5, max) : view, p.lat, p.lon);
	}

	const toggle = (l: OpLayer) => (layers = on.has(l) ? layers.filter((x) => x !== l) : [...layers, l]);
	const only = (l: OpLayer) => (layers = [l]);

	const coord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? pos : neg}`;
</script>

<div class="wrap">
	<div class="op">
		<header class="bar">
			<span class="ttl"><i aria-hidden="true">⌖</i> Mapa operacional</span>
			<span class="meta">
				{shown.length} en el mapa
				{#if fetchedAt}<span class="sep">·</span> datos de {stamp(Date.parse(fetchedAt))}{/if}
				{#if missing.length}<span class="sep">·</span> <span class="warn" title={missing.join(', ')}
						>{missing.length} fuentes sin datos</span
					>{/if}
			</span>
			<span class="tools">
				<Seg label="Periodo" options={PERIODS} bind:value={period} />
				<Seg
					label="Vista"
					options={[
						{ value: 'plano', label: 'Plano' },
						{ value: 'globo', label: 'Globo' }
					]}
					bind:value={mode}
				/>
			</span>
		</header>

		<nav class="layers" aria-label="Capas">
			<div class="lh">
				<span>Capas</span>
				<button type="button" class="lnk" onclick={() => (layers = OP_LAYERS.map((l) => l.value))}>Todas</button>
				<button type="button" class="lnk" onclick={() => (layers = [])}>Ninguna</button>
			</div>
			<ul>
				{#each OP_LAYERS as l (l.value)}
					<li>
						<button
							type="button"
							class="layer"
							aria-pressed={on.has(l.value)}
							onclick={() => toggle(l.value)}
							ondblclick={() => only(l.value)}
							title="Doble clic: solo esta capa"
						>
							<i class="sw {l.value}" aria-hidden="true"></i>
							<span class="name"
								>{l.label}{#if l.state}<sup title="Estado: se ve mientras dura">◇</sup>{/if}</span
							>
							<span class="n">{counts[l.value]}</span>
						</button>
					</li>
				{/each}
			</ul>
			<label class="chk"><input type="checkbox" bind:checked={untimed} /> Sin fecha</label>
			<p class="note">◇ Estado: se ve desde que empieza, aunque sea de antes del periodo.</p>
		</nav>

		<div class="stage" bind:clientWidth={sw} bind:clientHeight={sh}>
			{#if mode === 'plano'}
				<FlatMap
					points={shown}
					selected={selectedId}
					bind:view
					{max}
					{flash}
					onpick={pick}
					onhover={(h) => (hover = h)}
				/>
				<div class="zoom">
					<button type="button" aria-label="Acercar" onclick={() => (view = zoomAt(view, 1 / 1.5, 0.5, 0.5, max))}
						>+</button
					>
					<button type="button" aria-label="Alejar" onclick={() => (view = zoomAt(view, 1.5, 0.5, 0.5, max))}>−</button>
					<button type="button" aria-label="El mundo entero" onclick={() => (view = max)}>⌂</button>
				</div>
			{:else}
				<GlobeView points={shown} selected={selectedId} onpick={pick} {flash} />
			{/if}
			<div class="hud" aria-hidden="true">
				{#if hover && mode === 'plano'}{coord(hover.lat, 'N', 'S')} · {coord(hover.lon, 'E', 'O')}{:else}{cursor ===
					null
						? 'EN DIRECTO'
						: 'REBOBINADO'} · {stamp(at)}{/if}
			</div>
			{#if loading}<p class="loading">Cargando capas…</p>{:else if !points.length}<p class="loading">
					No hay datos de las capas todavía.
				</p>{/if}
		</div>

		<aside class="side" aria-label={selected ? 'Ficha del suceso' : 'Registro'}>
			{#if selected}
				<div class="sh">
					<span>Ficha</span>
					<button type="button" class="x" aria-label="Cerrar la ficha" onclick={() => (selectedId = null)}>×</button>
				</div>
				<div class="card">
					<p class="kind"><i class="sw {selected.layer}" aria-hidden="true"></i>{layerLabel(selected.layer)}</p>
					<h3>{selected.title}</h3>
					<p class="sub">{selected.sub}</p>
					<dl>
						{#if selected.at !== null}
							<dt>Hora</dt>
							<dd>{stamp(selected.at)} <span class="mut">({ago(selected.at, now)})</span></dd>
						{/if}
						{#each selected.detail as [k, v] (k)}
							<dt>{k}</dt>
							<dd>{v}</dd>
						{/each}
						<dt>Fuente</dt>
						<dd>{selected.source}</dd>
					</dl>
					<div class="acts">
						<a class="act" href={selected.url} target="_blank" rel="noopener">Fuente ↗</a>
						{#if selected.country}
							<button type="button" class="act" onclick={() => openPath(`/pais?c=${selected!.country}`)}>PAIS ›</button>
						{/if}
						<button type="button" class="act" onclick={() => openPath('/geo')}>GEO ›</button>
						<button type="button" class="act" onclick={() => choose(selected!)}>Centrar</button>
					</div>
				</div>
			{:else}
				<div class="sh"><span>Registro</span><span class="mut">{log.length}</span></div>
				{#if log.length}
					<ul class="log">
						{#each log as p (p.id)}
							<li>
								<button type="button" onclick={() => choose(p)}>
									<time>{stamp(p.at!)}</time>
									<i class="sw {p.layer}" aria-hidden="true"></i>
									<span>{p.title}</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty">Nada en este periodo con las capas elegidas.</p>
				{/if}
			{/if}
		</aside>

		<div class="time">
			<Timeline {range} bind:cursor {bins} {now} />
		</div>
	</div>
</div>

<style>
	/* Llena la ventana; el contenedor es el que mide el ancho para la versión estrecha (@container, abajo). */
	.wrap {
		container-type: inline-size;
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.op {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: 196px minmax(0, 1fr) 280px;
		grid-template-rows: auto minmax(0, 1fr) auto;
		grid-template-areas:
			'bar bar bar'
			'layers stage side'
			'time time time';
		background: var(--cmd-slate);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-s);
		overflow: hidden;
	}

	/* ── Barra de arriba ── */
	.bar {
		grid-area: bar;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6) var(--sp-12);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
		border-color: var(--cmd-coast);
		background: var(--panel);
	}

	.ttl {
		color: var(--cmd-cold);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}

	.ttl i {
		font-style: normal;
		color: var(--amber);
	}

	.meta {
		flex: 1;
		min-width: 0;
		color: var(--muted);
		font-size: var(--fs-xs);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sep {
		color: var(--faint);
	}

	.warn {
		color: var(--amber-dim);
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
	}

	/* ── Capas ── */
	.layers {
		grid-area: layers;
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		padding: var(--sp-8) 0;
		border-right: var(--border);
		border-color: var(--cmd-coast);
		background: color-mix(in srgb, var(--panel) 88%, transparent);
		overflow: auto;
	}

	.lh,
	.sh {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		padding: 0 var(--pad-x);
		color: var(--faint);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}

	.lh span,
	.sh span:first-child {
		flex: 1;
	}

	.lnk {
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		cursor: pointer;
	}

	@media (hover: hover) {
		.lnk:hover {
			color: var(--cmd-cold);
		}
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.layer {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		width: 100%;
		min-height: var(--control-h);
		padding: 0 var(--pad-x);
		border: 0;
		border-left: var(--hair) solid transparent;
		background: none;
		color: var(--faint);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	@media (hover: hover) {
		.layer:hover {
			background: var(--raise);
		}
	}

	.layer[aria-pressed='true'] {
		border-left-color: var(--cmd-cold);
		color: var(--fg);
	}

	.layer[aria-pressed='false'] .sw {
		opacity: 0.35;
	}

	.layer .name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	sup {
		margin-left: var(--sp-2);
		color: var(--faint);
		font-size: var(--fs-xxs);
	}

	.n {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.layer[aria-pressed='true'] .n {
		color: var(--cmd-cold);
	}

	.chk {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		min-height: var(--control-h);
		padding: 0 var(--pad-x);
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.note {
		margin: 0;
		padding: 0 var(--pad-x);
		color: var(--faint);
		font-size: var(--fs-xxs);
		line-height: var(--lh-snug);
	}

	/* Muestra de cada capa: la forma y el color del mapa (LAYER_STYLE de globe.ts). */
	.sw {
		flex: none;
		width: var(--swatch);
		height: var(--swatch);
		border: var(--hair) solid var(--amber);
		border-radius: 50%;
		background: var(--amber-soft);
	}

	.sw.storms,
	.sw.elections,
	.sw.internet {
		border-color: var(--fg);
		background: none;
	}

	.sw.events {
		border-color: var(--muted);
		background: var(--muted);
	}

	.sw.disasters,
	.sw.travel {
		border-color: var(--amber-dim);
	}

	.sw.travel,
	.sw.sanctions {
		border-radius: 0;
		transform: rotate(45deg) scale(0.85);
	}

	.sw.conflict {
		background: var(--amber-edge);
	}

	.sw.straits {
		background: none;
	}

	.sw.airspace {
		border-style: dashed;
		background: none;
	}

	.sw.maritime {
		border-color: transparent;
	}

	.sw.internet {
		border-radius: 0;
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
		background: var(--fg);
	}

	/* ── Mapa ── */
	.stage {
		grid-area: stage;
		position: relative;
		min-height: 0;
		background-color: var(--cmd-slate);
		background-image:
			linear-gradient(var(--cmd-grid) var(--hair), transparent var(--hair)),
			linear-gradient(90deg, var(--cmd-grid) var(--hair), transparent var(--hair));
		background-size: var(--cmd-grid-step) var(--cmd-grid-step);
	}

	.zoom {
		position: absolute;
		top: var(--sp-8);
		right: var(--sp-8);
		display: grid;
		border: var(--border);
		border-color: var(--cmd-coast);
		background: var(--panel);
	}

	.zoom button {
		width: var(--control-h);
		height: var(--control-h);
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	.zoom button + button {
		border-top: var(--border);
		border-color: var(--cmd-coast);
	}

	@media (hover: hover) {
		.zoom button:hover {
			color: var(--cmd-cold);
		}
	}

	.hud {
		position: absolute;
		left: var(--sp-8);
		bottom: var(--sp-6);
		padding: var(--sp-2) var(--sp-6);
		border: var(--border);
		border-color: var(--cmd-coast);
		background: color-mix(in srgb, var(--panel) 80%, transparent);
		color: var(--cmd-cold);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-code);
		pointer-events: none;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		color: var(--muted);
		pointer-events: none;
	}

	/* ── Ficha y registro ── */
	.side {
		grid-area: side;
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		min-height: 0;
		padding-top: var(--sp-8);
		border-left: var(--border);
		border-color: var(--cmd-coast);
		background: color-mix(in srgb, var(--panel) 92%, transparent);
	}

	.x {
		width: var(--btn-sm);
		height: var(--btn-sm);
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: var(--fs-l);
		cursor: pointer;
	}

	@media (hover: hover) {
		.x:hover {
			color: var(--fg);
		}
	}

	.card {
		padding: 0 var(--pad-x) var(--sp-12);
		overflow: auto;
	}

	.kind {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		margin: 0 0 var(--sp-6);
		color: var(--cmd-cold);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	h3 {
		margin: 0 0 var(--sp-4);
		font-family: var(--sans);
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
		line-height: var(--lh-tight);
	}

	.sub {
		margin: 0 0 var(--sp-10);
		color: var(--muted);
		font-family: var(--sans);
		line-height: var(--lh-snug);
	}

	dl {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--sp-4) var(--sp-10);
		margin: 0 0 var(--sp-12);
		padding: var(--sp-8) 0;
		border-top: var(--border);
		border-bottom: var(--border);
		border-color: var(--cmd-coast);
		font-size: var(--fs-xs);
	}

	dt {
		color: var(--faint);
	}

	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.mut {
		color: var(--muted);
	}

	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
	}

	.act {
		display: inline-flex;
		align-items: center;
		min-height: var(--control-h);
		padding: 0 var(--sp-10);
		border: var(--border);
		border-color: var(--cmd-coast);
		border-radius: var(--radius-s);
		background: none;
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-xs);
		text-decoration: none;
		cursor: pointer;
	}

	@media (hover: hover) {
		.act:hover {
			border-color: var(--cmd-cold);
			color: var(--cmd-cold);
		}
	}

	.log {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.log button {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: baseline;
		gap: var(--sp-8);
		width: 100%;
		padding: var(--row-y) var(--pad-x);
		border: 0;
		border-top: var(--border);
		border-color: var(--line);
		background: none;
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-xs);
		text-align: left;
		cursor: pointer;
	}

	@media (hover: hover) {
		.log button:hover {
			background: var(--raise);
		}
	}

	.log time {
		color: var(--cmd-cold);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.log span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--sans);
	}

	.empty {
		margin: 0;
		padding: 0 var(--pad-x);
		color: var(--muted);
	}

	.time {
		grid-area: time;
	}

	/* Ventana estrecha: las capas en una fila arriba y la ficha debajo del mapa. */
	@container (max-width: 760px) {
		.op {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto minmax(0, 3fr) minmax(0, 2fr) auto;
			grid-template-areas: 'bar' 'layers' 'stage' 'side' 'time';
		}

		/* Los periodos y la vista en una sola fila que se desliza: a 390 px no caben y no deben robarle alto al mapa. */
		.tools {
			flex-wrap: nowrap;
			width: 100%;
			overflow-x: auto;
			scrollbar-width: none;
		}

		.tools > :global(*) {
			flex: none;
		}

		/* Las capas, igual: una fila que se desliza en vez de cinco o seis filas que dejaban el mapa en nada. */
		.layers {
			flex-direction: row;
			flex-wrap: nowrap;
			align-items: center;
			padding: var(--sp-4) 0;
			border-right: 0;
			border-bottom: var(--border);
			border-color: var(--cmd-coast);
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
		}

		.layers ul {
			display: flex;
			flex-wrap: nowrap;
		}

		.layer {
			width: auto;
			white-space: nowrap;
		}

		.chk {
			flex: none;
			white-space: nowrap;
		}

		.zoom {
			grid-auto-flow: column;
		}

		.zoom button + button {
			border-top: 0;
			border-left: var(--border);
			border-color: var(--cmd-coast);
		}

		.note,
		.lh > span {
			display: none;
		}

		/* «Todas» y «Ninguna» se quedan, al principio de la fila: en táctil no hay doble clic para «solo esta capa». */
		.lh {
			flex: none;
		}

		.lnk {
			min-height: var(--control-h);
		}

		.side {
			min-height: 0;
			overflow: hidden;
			border-left: 0;
			border-top: var(--border);
			border-color: var(--cmd-coast);
		}
	}
</style>
