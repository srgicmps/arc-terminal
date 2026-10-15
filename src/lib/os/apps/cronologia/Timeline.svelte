<!--
	Arc OS · Línea de tiempo: carriles apilados que comparten un eje de tiempo. Arriba, los sucesos (puntos
	cuyo tamaño es su peso, agrupados cuando se solapan); abajo, mini-series de mercados. Un cursor vertical
	común lee el valor de cada carril en ese instante. Rueda o pellizco: zoom; arrastrar: mover; ← → + −
	con el teclado. Pulsar un punto abre su detalle y, desde ahí, su vista en otra ventana.
	La lógica (sucesos, escala, grupos, series) está en los .ts de esta carpeta; aquí solo se pinta.
	Como en Vue, `$state` es un ref() y `$derived` un computed().
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import type { AppProps } from '../../apps.ts';
	import { openPath } from '../../os.svelte.ts';
	import { cluster, nearest, radius, type Cluster } from './cluster.ts';
	import { getData, loadSources } from './data.ts';
	import { allEvents, type TlEvent } from './events.ts';
	import { LANES, laneOf, moveLane, parseSettings, toggleLane, visibleLanes, type LaneDef, type LaneId, type LaneSettings, type MarketLaneDef } from './lanes.ts';
	import { pan, RANGES, rangeDomain, scale, stamp, ticks, zoom, type Domain, type RangeKey } from './scale.ts';
	import { change, laneSeries, stepPath, valueAt, type TPoint } from './series.ts';

	let { win }: AppProps = $props();

	// Geometría propia del componente (px): columnas de etiquetas y valores, eje y alto de cada carril.
	const LABEL_W = 150;
	const VALUE_W = 92;
	const AXIS_H = 22;
	const EV_H = 40;
	const MK_H = 46;
	const MK_PAD = 8;
	const SETTINGS_KEY = 'arc-os-cronologia';

	let now = $state(Date.now());
	let domain = $state<Domain>(rangeDomain('7d', Date.now()));
	let width = $state(0);
	let events = $state<TlEvent[]>([]);
	let loading = $state(true);
	let markets = $state<Record<string, unknown>>({});
	let settings = $state<LaneSettings>(parseSettings(null));
	let showLanes = $state(false);
	let hoverX = $state<number | null>(null);
	let selected = $state<Cluster | null>(null);
	let plot: HTMLDivElement | undefined = $state();

	/** El rango elegido (se guarda con los carriles). Al cambiarlo, el dominio vuelve a ese rango alrededor de ahora. */
	const range = {
		get value(): RangeKey {
			return settings.range;
		},
		set value(key: RangeKey) {
			saveSettings({ ...settings, range: key });
			domain = rangeDomain(key, now);
			selected = null;
		}
	};

	const x0 = LABEL_W;
	const x1 = $derived(Math.max(LABEL_W + 80, width - VALUE_W));
	const sc = $derived(scale(domain, [x0, x1]));
	const span = $derived(domain[1] - domain[0]);
	const marks = $derived(ticks(domain, Math.max(2, Math.floor((x1 - x0) / 84))));

	const lanes = $derived(visibleLanes(settings));
	/** Cada carril visible con su posición vertical. */
	const rows = $derived.by(() => {
		let y = AXIS_H;
		return lanes.map((l) => {
			const h = l.kind === 'events' ? EV_H : MK_H;
			const row = { lane: l, y, h };
			y += h;
			return row;
		});
	});
	const height = $derived(rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].h : AXIS_H);

	const byLane = $derived.by(() => {
		const m = new Map<LaneId, TlEvent[]>();
		for (const e of events) (m.get(e.lane) ?? m.set(e.lane, []).get(e.lane)!).push(e);
		return m;
	});
	const groups = $derived(new Map(lanes.filter((l) => l.kind === 'events').map((l) => [l.id, cluster(byLane.get(l.id) ?? [], sc, 16)])));
	const series = $derived(
		new Map(lanes.filter((l): l is MarketLaneDef => l.kind === 'market').map((l) => [l.id, laneSeries(l, markets[l.ds])]))
	);
	const cursorT = $derived(hoverX === null ? null : sc.t(hoverX));

	// ---------- Datos ----------
	async function refresh() {
		const s = await loadSources();
		events = allEvents(s);
		loading = false;
	}

	/** Pide los archivos de mercados de los carriles visibles que aún no estén. */
	$effect(() => {
		for (const l of lanes) {
			if (l.kind !== 'market' || l.ds in untrack(() => markets)) continue;
			markets = { ...untrack(() => markets), [l.ds]: undefined };
			getData(l.ds).then((d) => (markets = { ...markets, [l.ds]: d }));
		}
	});

	onMount(() => {
		try {
			settings = parseSettings(localStorage.getItem(SETTINGS_KEY));
		} catch {}
		domain = rangeDomain(settings.range, now);
		refresh();
		const tick = setInterval(() => (now = Date.now()), 60_000);
		const again = setInterval(refresh, 10 * 60_000);
		// La rueda necesita preventDefault (para que no haga scroll la ventana): escucha no pasiva.
		const el = plot;
		el?.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			clearInterval(tick);
			clearInterval(again);
			el?.removeEventListener('wheel', onWheel);
		};
	});

	function saveSettings(next: LaneSettings) {
		settings = next;
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
		} catch {}
	}

	// ---------- Zoom y arrastre ----------
	const localX = (clientX: number) => clientX - (plot?.getBoundingClientRect().left ?? 0);
	const inPlot = (x: number) => x >= x0 && x <= x1;

	function onWheel(e: WheelEvent) {
		const x = localX(e.clientX);
		if (!inPlot(x)) return;
		e.preventDefault();
		// Rueda vertical (o pellizco del trackpad, que llega con ctrlKey): zoom; horizontal: mover.
		if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
			domain = pan(domain, (e.deltaX / (x1 - x0)) * span);
			return;
		}
		domain = zoom(domain, sc.t(x), Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
	}

	const pointers = new Map<number, number>();
	let drag: { x: number; domain: Domain; moved: boolean } | null = null;
	let pinch: { dist: number; domain: Domain; at: number } | null = null;
	let justDragged = false;

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		justDragged = false;
		pointers.set(e.pointerId, e.clientX);
		if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			pinch = { dist: Math.abs(a - b) || 1, domain, at: sc.t(localX((a + b) / 2)) };
			drag = null;
		} else drag = { x: e.clientX, domain, moved: false };
	}

	function move(e: PointerEvent) {
		const x = localX(e.clientX);
		hoverX = inPlot(x) ? x : null;
		if (!pointers.has(e.pointerId)) return;
		pointers.set(e.pointerId, e.clientX);
		if (pinch && pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			domain = zoom(pinch.domain, pinch.at, pinch.dist / (Math.abs(a - b) || 1));
			return;
		}
		if (!drag) return;
		const dx = e.clientX - drag.x;
		if (!drag.moved && Math.abs(dx) > 3) {
			drag.moved = true;
			(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		}
		if (drag.moved) domain = pan(drag.domain, -(dx / (x1 - x0)) * (drag.domain[1] - drag.domain[0]));
	}

	function up(e: PointerEvent) {
		pointers.delete(e.pointerId);
		if (pointers.size < 2) pinch = null;
		justDragged = !!drag?.moved;
		drag = null;
	}

	function leave() {
		if (!drag) hoverX = null;
	}

	function onKey(e: KeyboardEvent) {
		const step = span / 10;
		const mid = (domain[0] + domain[1]) / 2;
		const k = e.key;
		if (k === 'ArrowLeft') domain = pan(domain, -step);
		else if (k === 'ArrowRight') domain = pan(domain, step);
		else if (k === '+' || k === '=') domain = zoom(domain, mid, 1 / 1.4);
		else if (k === '-' || k === '_') domain = zoom(domain, mid, 1.4);
		else if (k === 'Escape' && selected) selected = null;
		else if (k === 'Home') toNow();
		else return;
		e.preventDefault();
	}

	function toNow() {
		domain = rangeDomain(range.value, now);
	}

	// ---------- Selección y detalle ----------
	function pick(c: Cluster) {
		if (justDragged) {
			justDragged = false;
			return;
		}
		selected = selected?.id === c.id ? null : c;
	}

	function openView(ev: TlEvent) {
		if (!openPath(ev.href)) openPath(laneOf(ev.lane)?.href ?? '/top');
	}

	// ---------- Formato ----------
	const nf = (v: number, digits: number) => v.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
	const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
	const when = (t: number) => stamp(t, 0);
	const fmtValue = (l: MarketLaneDef, p: TPoint | null) => (p ? `${nf(p.v, l.digits)}${l.unit === '%' ? '%' : ''}` : '—');

	function readout(l: LaneDef): { text: string; title: string; dir?: number } {
		if (l.kind === 'market') {
			const pts = series.get(l.id) ?? [];
			if (markets[l.ds] === undefined) return { text: '…', title: 'Cargando' };
			if (!pts.length) return { text: 'sin datos', title: 'Este archivo no está publicado o no trae la serie' };
			if (cursorT !== null) {
				const p = valueAt(pts, cursorT);
				return { text: fmtValue(l, p), title: p ? `Cierre del ${when(p.t)}` : 'Aún no había datos' };
			}
			const last = valueAt(pts, Math.min(now, domain[1]));
			const ch = change(pts, domain);
			return { text: fmtValue(l, last), title: ch === null ? '' : `${pct(ch)} en lo que se ve`, dir: ch ?? undefined };
		}
		const g = groups.get(l.id) ?? [];
		if (hoverX !== null) {
			const c = nearest(g, hoverX, 10);
			if (c) return { text: c.events.length > 1 ? `${c.events.length} sucesos` : '1 suceso', title: c.events[0].title };
		}
		const n = g.reduce((s, c) => s + c.events.length, 0);
		return { text: n ? `${n}` : '—', title: `${n} sucesos a la vista` };
	}

	const hovered = $derived.by(() => {
		if (hoverX === null) return null;
		for (const r of rows) {
			if (r.lane.kind !== 'events') continue;
			const c = nearest(groups.get(r.lane.id) ?? [], hoverX, 8);
			if (c) return c.events[0];
		}
		return null;
	});
	const nowX = $derived(sc.x(now));
	const r1 = (n: number) => Math.round(n * 10) / 10;
</script>

<div class="tl" data-win={win}>
	<header class="bar">
		<h2>Línea de tiempo</h2>
		<Seg label="Rango" options={RANGES} bind:value={range.value} />
		<button type="button" class="btn" onclick={toNow} title="Volver a ahora (Inicio)">Ahora</button>
		<button type="button" class="btn" aria-pressed={showLanes} onclick={() => (showLanes = !showLanes)}>Carriles</button>
		<span class="hint" aria-live="polite">
			{#if cursorT !== null}
				<b>{stamp(cursorT, span)}</b>{#if hovered}<span class="ev">· {hovered.title}</span>{/if}
			{:else if loading}Cargando sucesos…
			{:else}{stamp(domain[0], span)} — {stamp(domain[1], span)}{/if}
		</span>
	</header>

	<div class="main">
		<!-- Zona de gráfico con su propio teclado (flechas, + y −), como el globo de GEO. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="plot"
			bind:this={plot}
			bind:clientWidth={width}
			tabindex="0"
			role="application"
			aria-label="Línea de tiempo. Flechas para moverse, + y − para acercar o alejar."
			onkeydown={onKey}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
			onpointerleave={leave}
		>
			{#if width}
				<svg {width} {height} viewBox="0 0 {width} {height}">
					<defs>
						<clipPath id="tl-clip-{win}"><rect x={x0} y="0" width={x1 - x0} height={height} /></clipPath>
						<clipPath id="tl-labels-{win}"><rect x="0" y="0" width={x0 - 8} height={height} /></clipPath>
					</defs>

					{#each rows as r, i (r.lane.id)}
						<rect class="lane" class:alt={i % 2 === 1} x="0" y={r.y} width={width} height={r.h} />
						<line class="sep" x1="0" x2={width} y1={r.y + r.h - 0.5} y2={r.y + r.h - 0.5} />
					{/each}

					<g clip-path="url(#tl-clip-{win})">
						{#if nowX < x1}<rect class="future" x={Math.max(x0, nowX)} y={AXIS_H} width={x1 - Math.max(x0, nowX)} height={height - AXIS_H} />{/if}
						{#each marks as m (m.t)}
							<line class="grid" class:major={m.major} x1={r1(sc.x(m.t))} x2={r1(sc.x(m.t))} y1={AXIS_H - 4} y2={height} />
						{/each}
					</g>
					{#each marks as m (m.t)}
						{@const x = sc.x(m.t)}
						{#if x > x0 + 16 && x < x1 - 16}<text class="tick" class:major={m.major} x={x} y={AXIS_H - 8}>{m.label}</text>{/if}
					{/each}
					<line class="axis" x1={x0} x2={x1} y1={AXIS_H - 0.5} y2={AXIS_H - 0.5} />

					{#each rows as r (r.lane.id)}
						{@const ro = readout(r.lane)}
						<text class="label" x="10" y={r.y + r.h / 2 + 4} clip-path="url(#tl-labels-{win})"><title>{r.lane.desc}</title>{r.lane.label}</text>
						<text class="value" class:up={(ro.dir ?? 0) > 0} class:down={(ro.dir ?? 0) < 0} x={width - 10} y={r.y + r.h / 2 + 4}>
							<title>{ro.title}</title>{ro.text}
						</text>
					{/each}

					<g clip-path="url(#tl-clip-{win})">
						{#each rows as r (r.lane.id)}
							{#if r.lane.kind === 'market'}
								<path class="series" d={stepPath(series.get(r.lane.id) ?? [], sc, r.y + MK_PAD, r.h - 2 * MK_PAD, now)} />
							{:else}
								{@const cy = r.y + r.h / 2}
								{@const color = `var(${r.lane.color})`}
								{#each groups.get(r.lane.id) ?? [] as c (c.id)}
									{@const n = c.events.length}
									{@const rad = n > 1 ? Math.max(radius(c.weight), n > 9 ? 9 : 7) : radius(c.weight)}
									<g
										class="dot"
										class:sel={selected?.id === c.id}
										role="button"
										tabindex="0"
										aria-label={n > 1 ? `${n} sucesos: ${c.events[0].title}` : c.events[0].title}
										onclick={() => pick(c)}
										onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(c))}
										style:--c={color}
									>
										<circle cx={r1(c.x)} {cy} r={rad} />
										{#if n > 1}<text x={r1(c.x)} y={cy + 3}>{n > 99 ? '+' : n}</text>{/if}
									</g>
								{/each}
							{/if}
						{/each}
					</g>

					{#if nowX >= x0 && nowX <= x1}
						<line class="now" x1={r1(nowX)} x2={r1(nowX)} y1={AXIS_H - 6} y2={height} />
					{/if}
					{#if hoverX !== null}
						<line class="cursor" x1={hoverX} x2={hoverX} y1="0" y2={height} />
						{#each rows as r (r.lane.id)}
							{#if r.lane.kind === 'market' && cursorT !== null}
								{@const pts = series.get(r.lane.id) ?? []}
								{@const p = valueAt(pts, cursorT)}
								{#if p}<circle class="probe" cx={hoverX} cy={r.y + r.h / 2} r="2" />{/if}
							{/if}
						{/each}
					{/if}
				</svg>
			{/if}
			{#if !loading && !events.length}<p class="empty-note">No hay sucesos publicados todavía.</p>{/if}
		</div>

		{#if showLanes}
			<aside class="lanes" aria-label="Carriles">
				<p class="head">Carriles</p>
				<ul>
					{#each settings.order as id, i (id)}
						{@const l = laneOf(id)}
						{#if l}
							<li>
								<label title={l.desc}>
									<input type="checkbox" checked={!settings.hidden.includes(id)} onchange={() => saveSettings(toggleLane(settings, id))} />
									<span>{l.label}</span>
								</label>
								<button type="button" class="mini" disabled={i === 0} onclick={() => saveSettings(moveLane(settings, id, -1))} aria-label="Subir {l.label}">↑</button>
								<button type="button" class="mini" disabled={i === settings.order.length - 1} onclick={() => saveSettings(moveLane(settings, id, 1))} aria-label="Bajar {l.label}">↓</button>
							</li>
						{/if}
					{/each}
				</ul>
				<button type="button" class="btn wide" onclick={() => saveSettings({ ...parseSettings(null), range: settings.range })}>Por defecto</button>
			</aside>
		{/if}
	</div>

	{#if selected}
		<section class="detail" aria-label="Detalle">
			<header>
				<span>{selected.events.length > 1 ? `${selected.events.length} sucesos` : 'Suceso'} · {laneOf(selected.events[0].lane)?.label}</span>
				<button type="button" class="mini" onclick={() => (selected = null)} aria-label="Cerrar detalle">×</button>
			</header>
			<ul>
				{#each selected.events.slice(0, 30) as ev (ev.id)}
					<li>
						<time datetime={new Date(ev.t).toISOString()}>{when(ev.t)}</time>
						<span class="title">{ev.title}{#if ev.meta}<small>{ev.meta}</small>{/if}</span>
						<span class="acts">
							<button type="button" class="btn" onclick={() => openView(ev)}>Abrir vista</button>
							{#if ev.url}<a class="btn" href={ev.url} target="_blank" rel="noopener noreferrer">Fuente ↗</a>{/if}
						</span>
					</li>
				{/each}
			</ul>
			{#if selected.events.length > 30}<p class="more">Y {selected.events.length - 30} más: acerca el zoom para separarlos.</p>{/if}
		</section>
	{/if}

	<footer>
		Rueda o pellizco: zoom · arrastra: mover · ← → + − con el teclado · {LANES.length} carriles. Fuentes: IMP, USGS, GDACS, EASA, NGA,
		Departamento de Estado, Eurostat, BLS, INE, Finnhub, BCE, Fed, BIS, Tesoro de EE. UU., CoinGecko, FRED.
	</footer>
</div>

<style>
	.tl {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--cmd-tl-bg);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-s);
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--hair) solid var(--cmd-tl-edge);
	}

	h2 {
		margin: 0;
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		color: var(--amber);
	}

	.hint {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
		text-align: right;
	}

	.hint b {
		font-weight: var(--fw-medium);
		color: var(--fg);
	}

	.hint .ev {
		margin-left: var(--sp-6);
		font-family: var(--sans);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		border: var(--hair) solid var(--cmd-tl-edge);
		background: transparent;
		color: var(--fg);
		font: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.btn[aria-pressed='true'] {
		border-color: var(--amber-edge);
		background: var(--amber-soft);
	}
	@media (hover: hover) {
		.btn:hover {
			border-color: var(--amber-edge);
			background: var(--amber-soft);
		}
	}

	.main {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.plot {
		position: relative;
		flex: 1;
		min-width: 0;
		overflow-x: hidden;
		overflow-y: auto;
		touch-action: pan-y;
		user-select: none;
		cursor: grab;
		outline: none;
	}

	.plot:focus-visible {
		box-shadow: inset 0 0 0 var(--hair) var(--amber-edge);
	}

	.plot:active {
		cursor: grabbing;
	}

	svg {
		display: block;
	}

	.lane {
		fill: transparent;
	}

	.lane.alt {
		fill: var(--cmd-tl-alt);
	}

	.sep,
	.axis {
		stroke: var(--cmd-tl-edge);
		stroke-width: var(--hair);
	}

	.future {
		fill: var(--cmd-tl-future);
	}

	.grid {
		stroke: var(--cmd-tl-grid);
		stroke-width: var(--hair);
	}

	.grid.major {
		stroke: var(--cmd-tl-grid-major);
	}

	.tick {
		fill: var(--faint);
		font-size: var(--fs-xxs);
		text-anchor: middle;
	}

	.tick.major {
		fill: var(--muted);
	}

	.label {
		fill: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
	}

	.value {
		fill: var(--fg);
		font-size: var(--fs-xs);
		text-anchor: end;
		font-variant-numeric: tabular-nums;
	}

	.value.up {
		fill: var(--up);
	}

	.value.down {
		fill: var(--down);
	}

	.series {
		fill: none;
		stroke: var(--cmd-tl-series);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}

	.dot {
		cursor: pointer;
		outline: none;
	}

	.dot circle {
		fill: var(--c);
		fill-opacity: var(--cmd-tl-dot-fill);
		stroke: var(--c);
		stroke-width: var(--hair);
	}

	.dot:focus-visible circle {
		fill-opacity: var(--cmd-tl-dot-hover);
	}
	@media (hover: hover) {
		.dot:hover circle {
			fill-opacity: var(--cmd-tl-dot-hover);
		}
	}

	.dot.sel circle {
		stroke: var(--fg);
		fill-opacity: var(--cmd-tl-dot-sel);
	}

	.dot text {
		fill: var(--fg);
		font-size: var(--fs-xxs);
		text-anchor: middle;
		pointer-events: none;
	}

	.now {
		stroke: var(--cmd-tl-now);
		stroke-width: var(--hair);
		stroke-dasharray: var(--cmd-tl-dash);
	}

	.cursor {
		stroke: var(--cmd-tl-cursor);
		stroke-width: var(--hair);
		pointer-events: none;
	}

	.probe {
		fill: var(--fg);
		pointer-events: none;
	}

	.empty-note {
		margin: var(--sp-8) var(--pad-x);
		color: var(--muted);
	}

	.lanes {
		width: 220px;
		flex: none;
		overflow-y: auto;
		padding: var(--sp-6) var(--pad-x);
		border-left: var(--hair) solid var(--cmd-tl-edge);
	}

	.lanes .head {
		margin: 0 0 var(--sp-6);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--muted);
	}

	.lanes ul {
		margin: 0 0 var(--sp-8);
		padding: 0;
		list-style: none;
	}

	.lanes li {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		border-bottom: var(--hair) solid var(--cmd-tl-row);
	}

	.lanes label {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--sp-6);
		min-height: var(--control-h);
		min-width: 0;
		cursor: pointer;
	}

	.lanes input {
		accent-color: var(--amber);
	}

	.lanes label span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mini {
		width: var(--btn-sm);
		height: var(--btn-sm);
		border: var(--hair) solid transparent;
		background: transparent;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	@media (hover: hover) {
		.mini:hover:not(:disabled) {
			border-color: var(--cmd-tl-edge);
			color: var(--fg);
		}
	}

	.mini:disabled {
		opacity: var(--cmd-tl-disabled);
		cursor: default;
	}

	.wide {
		width: 100%;
		justify-content: center;
	}

	.detail {
		max-height: 40%;
		overflow-y: auto;
		border-top: var(--hair) solid var(--cmd-tl-edge);
		background: var(--panel);
	}

	.detail header {
		position: sticky;
		top: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--sp-2) var(--pad-x);
		background: var(--panel);
		border-bottom: var(--hair) solid var(--cmd-tl-edge);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--muted);
	}

	.detail ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.detail li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--sp-10);
		align-items: center;
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--hair) solid var(--cmd-tl-row);
	}

	.detail time {
		color: var(--muted);
		white-space: nowrap;
	}

	.detail .title {
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-snug);
		min-width: 0;
	}

	.detail small {
		display: block;
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		color: var(--muted);
	}

	.acts {
		display: flex;
		gap: var(--sp-4);
	}

	.more {
		margin: var(--sp-6) var(--pad-x);
		color: var(--muted);
	}

	footer {
		padding: var(--sp-4) var(--pad-x);
		border-top: var(--hair) solid var(--cmd-tl-edge);
		color: var(--faint);
		font-size: var(--fs-xxs);
		line-height: var(--lh-snug);
	}

	@media (max-width: 720px) {
		.lanes {
			position: absolute;
			right: 0;
			z-index: var(--z-popover);
			height: 100%;
			background: var(--panel);
		}

		.main {
			position: relative;
		}

		.detail li {
			grid-template-columns: 1fr;
			gap: var(--sp-4);
		}
	}
</style>
