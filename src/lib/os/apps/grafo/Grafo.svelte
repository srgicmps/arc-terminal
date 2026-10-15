<!--
	Grafo de entidades (Arc OS 6, Centro de mando). Lienzo con fuerzas propias (intel/force.ts): clic elige y abre
	el Expediente, doble clic carga los vecinos, arrastrar mueve un nodo o el lienzo, la rueda acerca. Filtro por
	tipo, buscador y, a la derecha, la ficha corta del nodo elegido con sus enlaces (también para teclado).
	La ventana puede llegar centrada en una entidad: path «/grafo#country:ES» (openGraph de intel/open.ts).
-->
<script lang="ts">
	import UiIcon from '../../icons/UiIcon.svelte';
	import { onMount, untrack } from 'svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import type { AppProps } from '../../apps.ts';
	import { os } from '../../os.svelte.ts';
	import EntitySearch from '../intel/EntitySearch.svelte';
	import { KIND_TOKEN, readPalette, watchTheme, type Palette } from '../intel/colors.ts';
	import { getGraph, intel, loadIntel } from '../intel/data.svelte.ts';
	import { hit, seed, settle, tick, type Body, type Spring } from '../intel/force.ts';
	import { edgesAmong, ego, expand, neighbors, overview, strength, targetOf, whyText } from '../intel/graph.ts';
	import { KINDS, kindLabel, type Graph, type IntelEdge, type Kind } from '../intel/model.ts';
	import { openDossierId } from '../intel/open.ts';

	let { win }: AppProps = $props();

	const graph = $derived(getGraph());
	const path = $derived(os.state.desks.flatMap((d) => d.wins).find((w) => w.uid === win)?.path);
	const target = $derived(targetOf(path));

	const KIND_OPTIONS = KINDS.map((k) => ({ value: k.value, label: k.label }));
	let kinds = $state<Kind[]>(KINDS.map((k) => k.value));
	let visible = $state.raw<Set<string>>(new Set());
	let selected = $state<string | null>(null);
	let hover = $state<string | null>(null);
	let edgeCount = $state(0);

	// Lo que pinta el lienzo: no es reactivo (cambia en cada fotograma).
	let bodies: Body[] = [];
	let index = new Map<string, number>();
	let edges: IntelEdge[] = [];
	let springs: Spring[] = [];
	let labelled = new Set<string>();

	let wrap: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let pal: Palette | null = null;
	let W = 0;
	let H = 0;
	let dpr = 1;
	const view = { x: 0, y: 0, k: 1 };
	let alpha = 0;
	let raf = 0;
	let reduced = false;

	const sel = $derived(graph && selected ? (graph.nodes.get(selected) ?? null) : null);
	const links = $derived(graph && selected ? neighbors(graph, selected, { max: 14 }) : []);
	const counts = $derived.by(() => {
		const out: Partial<Record<Kind, number>> = {};
		for (const id of visible) {
			const k = graph?.nodes.get(id)?.kind;
			if (k) out[k] = (out[k] ?? 0) + 1;
		}
		return out;
	});

	/** Pone en el lienzo estos nodos: los que ya estaban no se mueven; los nuevos salen junto a `around`. */
	function show(g: Graph, ids: Set<string>, around?: string) {
		const keep = new Set([...ids].filter((id) => g.nodes.has(id)));
		visible = keep;
		const old = new Map(bodies.map((b) => [b.id, b]));
		const origin = around ? old.get(around) : undefined;
		const fresh = new Map(seed([...keep].filter((id) => !old.has(id)), origin?.x ?? 0, origin?.y ?? 0, origin ? 12 : 26).map((b) => [b.id, b]));
		bodies = [...keep].map((id) => old.get(id) ?? fresh.get(id)!);
		index = new Map(bodies.map((b, i) => [b.id, i]));
		edges = edgesAmong(g, keep);
		edgeCount = edges.length;
		springs = edges.map((e) => ({ a: index.get(e.a)!, b: index.get(e.b)!, w: e.w }));
		const st = bodies.map((b) => strength(g, b.id));
		const max = Math.max(1, ...st);
		const rMin = pal?.rMin ?? 5;
		const rMax = pal?.rMax ?? 14;
		bodies.forEach((b, i) => (b.r = rMin + (rMax - rMin) * Math.sqrt(st[i] / max)));
		labelled = new Set([...bodies].sort((a, b) => b.r - a.r).slice(0, 16).map((b) => b.id));
		if (selected && !keep.has(selected)) selected = null;
		heat(around ? 0.5 : 0.9);
	}

	/** Vista nueva (al abrir, al buscar o con «Actualidad»): se coloca casi del todo antes de enseñarla. */
	function reset(g: Graph, focus: string | null) {
		bodies = [];
		if (focus && g.nodes.has(focus)) {
			selected = focus;
			show(g, ego(g, focus, kinds, 18));
		} else {
			selected = null;
			show(g, overview(g, kinds));
		}
		settle(bodies, springs, 160);
		fit();
		heat(0.25);
	}

	let lastTarget: string | null | undefined;
	$effect(() => {
		const g = graph;
		const t = target;
		void kinds.join();
		if (!g) return;
		untrack(() => {
			if (t !== lastTarget || !bodies.length) {
				lastTarget = t;
				reset(g, t);
			} else {
				const keep = new Set([...visible].filter((id) => kinds.includes(g.nodes.get(id)?.kind as Kind)));
				show(g, keep.size ? keep : overview(g, kinds));
			}
		});
	});

	function pick(id: string) {
		const g = graph;
		if (!g) return;
		if (visible.has(id)) selected = id;
		else {
			selected = id;
			show(g, new Set([...visible, ...ego(g, id, kinds, 10)]), [...visible].find((v) => g.adj.get(id)?.has(v)));
		}
		center(id);
	}

	function expandNode(id: string) {
		const g = graph;
		if (!g) return;
		selected = id;
		show(g, expand(g, visible, id, kinds, 12), id);
	}

	function removeNode(id: string) {
		const g = graph;
		if (!g) return;
		const next = new Set(visible);
		next.delete(id);
		selected = null;
		show(g, next);
	}

	// ---------- Dibujo ----------

	function heat(a: number) {
		alpha = Math.max(alpha, a);
		if (reduced) {
			settle(bodies, springs, 120);
			alpha = 0;
			draw();
		} else redraw();
	}

	function redraw() {
		if (!raf && canvas) raf = requestAnimationFrame(frame);
	}

	function frame() {
		raf = 0;
		if (alpha > 0.004) {
			tick(bodies, springs, alpha);
			alpha *= 0.975;
		}
		draw();
		if (alpha > 0.004) raf = requestAnimationFrame(frame);
	}

	/** Encaja todos los nodos en el lienzo. */
	function fit() {
		if (!bodies.length || !W || !H) return;
		const xs = bodies.map((b) => b.x);
		const ys = bodies.map((b) => b.y);
		const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
		const pad = 60;
		view.k = Math.max(0.25, Math.min(2, Math.min((W - pad) / Math.max(1, x1 - x0), (H - pad) / Math.max(1, y1 - y0))));
		view.x = -((x0 + x1) / 2) * view.k;
		view.y = -((y0 + y1) / 2) * view.k;
		redraw();
	}

	function center(id: string) {
		const b = bodies[index.get(id) ?? -1];
		if (!b) return;
		view.x = -b.x * view.k;
		view.y = -b.y * view.k;
		redraw();
	}

	const toWorld = (sx: number, sy: number) => ({ x: (sx - W / 2 - view.x) / view.k, y: (sy - H / 2 - view.y) / view.k });
	const toScreen = (b: Body) => ({ x: b.x * view.k + W / 2 + view.x, y: b.y * view.k + H / 2 + view.y });

	function shape(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, r: number) {
		ctx.beginPath();
		if (kind === 'sanction') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
		else if (kind === 'event') {
			ctx.moveTo(x, y - r * 1.1);
			ctx.lineTo(x + r, y + r * 0.75);
			ctx.lineTo(x - r, y + r * 0.75);
			ctx.closePath();
		} else if (kind === 'leader') {
			ctx.moveTo(x, y - r * 1.15);
			ctx.lineTo(x + r * 1.15, y);
			ctx.lineTo(x, y + r * 1.15);
			ctx.lineTo(x - r * 1.15, y);
			ctx.closePath();
		} else ctx.arc(x, y, r, 0, Math.PI * 2);
	}

	function draw() {
		const ctx = canvas?.getContext('2d');
		const g = graph;
		if (!ctx || !pal || !g) return;
		const c = pal.color;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.globalAlpha = 1;
		ctx.fillStyle = c['cmd-bg'];
		ctx.fillRect(0, 0, W, H);

		// Retícula fina, que se mueve con el lienzo.
		const step = 40 * view.k;
		if (step >= 14) {
			ctx.strokeStyle = c['cmd-grid'];
			ctx.lineWidth = 1;
			ctx.beginPath();
			const ox = (W / 2 + view.x) % step;
			const oy = (H / 2 + view.y) % step;
			for (let x = ox; x < W; x += step) (ctx.moveTo(Math.round(x) + 0.5, 0), ctx.lineTo(Math.round(x) + 0.5, H));
			for (let y = oy; y < H; y += step) (ctx.moveTo(0, Math.round(y) + 0.5), ctx.lineTo(W, Math.round(y) + 0.5));
			ctx.stroke();
		}

		const near = new Set<string>();
		if (selected) for (const e of edges) if (e.a === selected || e.b === selected) near.add(e.a === selected ? e.b : e.a);
		const dim = (id: string) => selected !== null && id !== selected && !near.has(id);

		ctx.save();
		ctx.translate(W / 2 + view.x, H / 2 + view.y);
		ctx.scale(view.k, view.k);
		for (const e of edges) {
			const p = bodies[index.get(e.a)!];
			const q = bodies[index.get(e.b)!];
			const hot = selected !== null && (e.a === selected || e.b === selected);
			ctx.strokeStyle = hot ? c['cmd-edge-hot'] : c['cmd-link'];
			ctx.globalAlpha = hot ? 0.85 : selected ? 0.25 : Math.min(1, 0.45 + Math.log1p(e.w) / 4);
			ctx.lineWidth = (0.5 + Math.min(2.5, Math.log1p(e.w) * 0.7)) / view.k;
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(q.x, q.y);
			ctx.stroke();
		}
		for (const b of bodies) {
			const n = g.nodes.get(b.id);
			if (!n) continue;
			ctx.globalAlpha = dim(b.id) ? 0.3 : 1;
			const col = c[KIND_TOKEN[n.kind]];
			// Tamaño fijo en la pantalla: el zoom separa los nodos, no los engorda.
			const r = b.r / view.k;
			shape(ctx, n.kind, b.x, b.y, r);
			if (n.kind === 'story') {
				ctx.lineWidth = 1.5 / view.k;
				ctx.strokeStyle = col;
				ctx.fillStyle = c['cmd-bg'];
				ctx.fill();
				ctx.stroke();
			} else {
				ctx.fillStyle = col;
				ctx.fill();
			}
			if (b.id === selected || b.id === hover) {
				ctx.globalAlpha = 1;
				ctx.lineWidth = 1.5 / view.k;
				ctx.strokeStyle = b.id === selected ? c['cmd-halo'] : c['muted'];
				ctx.beginPath();
				ctx.arc(b.x, b.y, r + 4 / view.k, 0, Math.PI * 2);
				ctx.stroke();
			}
		}
		ctx.restore();

		// Nombres, a tamaño fijo en la pantalla: los más fuertes, el elegido, sus vecinos y el que está bajo el ratón.
		ctx.font = `${pal.xxs}px ${pal.mono}`;
		ctx.textBaseline = 'middle';
		for (const b of bodies) {
			const show = b.id === hover || b.id === selected || near.has(b.id) || (!selected && labelled.has(b.id) && view.k > 0.45);
			if (!show) continue;
			const n = g.nodes.get(b.id)!;
			const text = n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label;
			const s = toScreen(b);
			const x = s.x + b.r + 5;
			const tw = ctx.measureText(text).width;
			ctx.globalAlpha = 1;
			ctx.fillStyle = c['cmd-label-bg'];
			ctx.fillRect(x - 2, s.y - pal.xxs / 2 - 2, tw + 4, pal.xxs + 4);
			ctx.fillStyle = b.id === selected ? c['amber'] : c['cmd-label'];
			ctx.fillText(text, x, s.y);
		}
	}

	// ---------- Ratón, dedo y teclado ----------

	let drag: { mode: 'node' | 'pan'; id?: string; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null = null;
	let clickTimer: ReturnType<typeof setTimeout> | undefined;

	function local(e: PointerEvent | MouseEvent) {
		const r = canvas.getBoundingClientRect();
		return { sx: e.clientX - r.left, sy: e.clientY - r.top };
	}

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		const { sx, sy } = local(e);
		const w = toWorld(sx, sy);
		const b = hit(bodies, w.x, w.y, 6 / view.k, 1 / view.k);
		canvas.setPointerCapture(e.pointerId);
		drag = { mode: b ? 'node' : 'pan', id: b?.id, sx, sy, vx: view.x, vy: view.y, moved: false };
		if (b) b.fixed = true;
	}

	function move(e: PointerEvent) {
		const { sx, sy } = local(e);
		if (!drag) {
			const w = toWorld(sx, sy);
			const id = hit(bodies, w.x, w.y, 6 / view.k, 1 / view.k)?.id ?? null;
			if (id !== hover) {
				hover = id;
				redraw();
			}
			return;
		}
		if (Math.hypot(sx - drag.sx, sy - drag.sy) > 4) drag.moved = true;
		if (drag.mode === 'pan') {
			view.x = drag.vx + sx - drag.sx;
			view.y = drag.vy + sy - drag.sy;
			redraw();
		} else if (drag.moved) {
			const b = bodies[index.get(drag.id!)!];
			const w = toWorld(sx, sy);
			b.x = w.x;
			b.y = w.y;
			heat(0.3);
		}
	}

	function up(e: PointerEvent) {
		if (!drag) return;
		const d = drag;
		drag = null;
		if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
		if (d.mode === 'node') {
			const b = bodies[index.get(d.id!)!];
			if (b) b.fixed = false;
		}
		if (d.moved) return;
		if (d.mode === 'node' && d.id) {
			const id = d.id;
			selected = id;
			redraw();
			clearTimeout(clickTimer);
			// Espera un poco por si es un doble clic (que expande y no abre el Expediente).
			clickTimer = setTimeout(() => openDossierId(id), 280);
		} else {
			selected = null;
			redraw();
		}
	}

	function dbl(e: MouseEvent) {
		clearTimeout(clickTimer);
		const { sx, sy } = local(e);
		const w = toWorld(sx, sy);
		const b = hit(bodies, w.x, w.y, 6 / view.k, 1 / view.k);
		if (b) expandNode(b.id);
	}

	function zoomAt(sx: number, sy: number, f: number) {
		const w = toWorld(sx, sy);
		view.k = Math.max(0.2, Math.min(4, view.k * f));
		view.x = sx - W / 2 - w.x * view.k;
		view.y = sy - H / 2 - w.y * view.k;
		redraw();
	}

	function keys(e: KeyboardEvent) {
		const pan: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
		if (pan[e.key]) {
			view.x += pan[e.key][0];
			view.y += pan[e.key][1];
			redraw();
		} else if (e.key === '+' || e.key === '=') zoomAt(W / 2, H / 2, 1.2);
		else if (e.key === '-') zoomAt(W / 2, H / 2, 1 / 1.2);
		else if (e.key === 'Enter' && selected) openDossierId(selected);
		else if (e.key.toLowerCase() === 'e' && selected) expandNode(selected);
		else if (e.key === 'Escape' && selected) {
			selected = null;
			redraw();
		} else return;
		e.preventDefault();
	}

	onMount(() => {
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		pal = readPalette(wrap);
		const stopTheme = watchTheme(() => {
			pal = readPalette(wrap);
			redraw();
		});
		const ro = new ResizeObserver(() => {
			const r = wrap.getBoundingClientRect();
			dpr = Math.min(2, devicePixelRatio || 1);
			const first = !W;
			W = Math.max(1, r.width);
			H = Math.max(1, r.height);
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			if (first) fit();
			redraw();
		});
		ro.observe(wrap);
		const wheel = (e: WheelEvent) => {
			e.preventDefault();
			const { sx, sy } = local(e);
			zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0015));
		};
		canvas.addEventListener('wheel', wheel, { passive: false });
		loadIntel().catch(() => {});
		return () => {
			stopTheme();
			ro.disconnect();
			canvas.removeEventListener('wheel', wheel);
			cancelAnimationFrame(raf);
			clearTimeout(clickTimer);
		};
	});

	// Al cambiar lo elegido o el filtro, se vuelve a pintar (el bucle no lo sabe).
	$effect(() => {
		void selected;
		redraw();
	});

	const at = $derived(intel.at ? new Date(intel.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
</script>

<div class="grafo" data-win={win}>
	<div class="bar">
		<EntitySearch graph={graph} onpick={pick} />
		<Seg label="Tipos de entidad" options={KIND_OPTIONS} bind:values={kinds} />
		<span class="tools">
			<button type="button" onclick={() => graph && reset(graph, null)} title="Volver a la vista de la actualidad">Actualidad</button>
			<button type="button" onclick={fit} title="Encajar todo en la ventana">Encajar</button>
			<button type="button" onclick={() => loadIntel(true)} disabled={intel.loading} title="Volver a leer los datos" aria-label="Actualizar los datos"><UiIcon id="refresh" size={14} /></button>
		</span>
	</div>

	<div class="main">
		<div class="stage" bind:this={wrap}>
			<canvas
				bind:this={canvas}
				tabindex="0"
				aria-label="Grafo de entidades: {visible.size} nodos y {edgeCount} enlaces. Flechas para mover, + y − para acercar, Intro abre el expediente del elegido, E carga sus vecinos."
				class:hand={hover !== null}
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
				onpointerleave={() => {
					if (!drag && hover) {
						hover = null;
						redraw();
					}
				}}
				ondblclick={dbl}
				onkeydown={keys}
			></canvas>
			{#if !graph}
				<p class="msg">{intel.loading ? 'Cargando titulares, sanciones y sucesos…' : 'Sin datos todavía.'}</p>
			{:else if !visible.size}
				<p class="msg">Nada que enseñar con estos tipos. Elige alguno más arriba.</p>
			{/if}
			<p class="status">
				{visible.size} entidades · {edgeCount} enlaces{at ? ` · datos de las ${at}` : ''}
			</p>
		</div>

		<aside class="side" aria-label="Entidad elegida">
			{#if sel}
				<header>
					<span class="kind"><i class="dot" data-cmd-kind={sel.kind}></i>{kindLabel(sel.kind)}</span>
					<h2>{sel.label}</h2>
					<p class="sub">{sel.sub}</p>
					{#if sel.mentions}<p class="sub">{sel.mentions} {sel.mentions === 1 ? 'titular' : 'titulares'} ahora</p>{/if}
				</header>
				<div class="acts">
					<button type="button" class="primary" onclick={() => openDossierId(sel.id)}>Abrir expediente</button>
					<button type="button" onclick={() => expandNode(sel.id)}>Vecinos</button>
					<button type="button" onclick={() => removeNode(sel.id)}>Quitar</button>
				</div>
				<h3>Enlaces</h3>
				<ul class="links">
					{#each links as l (l.node.id)}
						<li>
							<button type="button" onclick={() => pick(l.node.id)} title={whyText(l.edge)}>
								<i class="dot" data-cmd-kind={l.node.kind}></i>
								<span class="name">{l.node.label}</span>
								<span class="w">{Math.round(l.edge.w)}</span>
							</button>
							<span class="why">{whyText(l.edge)}</span>
						</li>
					{:else}
						<li class="none">Sin enlaces.</li>
					{/each}
				</ul>
			{:else}
				<h3>Leyenda</h3>
				<ul class="legend">
					{#each KINDS as k (k.value)}
						<li data-shape={k.value}>
							<i class="dot" data-cmd-kind={k.value}></i>
							<span class="name">{k.label}</span>
							<span class="w">{counts[k.value] ?? 0}</span>
						</li>
					{/each}
				</ul>
				<p class="help">
					Las líneas unen entidades que salen en los mismos titulares, además del país de cada líder o valor, el banco
					central de cada país y el país de cada sanción o suceso. Cuanto más gruesa, más peso.
				</p>
				<p class="help">Clic: abre el expediente · doble clic: carga los vecinos · arrastra: mueve · rueda: acerca.</p>
				{#if intel.error}<p class="help warn">{intel.error}</p>{/if}
			{/if}
		</aside>
	</div>
</div>

<style>
	.grafo {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100%;
		min-height: 0;
		container-type: inline-size;
		background: var(--panel);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-m);
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
	}

	.tools {
		display: flex;
		gap: var(--sp-4);
		margin-left: auto;
	}

	button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		border: var(--border);
		border-radius: var(--radius-s);
		background: var(--raise);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
		cursor: pointer;
	}

	button:hover,
	button:focus-visible {
		border-color: var(--amber-edge);
		color: var(--amber);
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.main {
		display: grid;
		grid-template-columns: 1fr var(--cmd-side);
		min-height: 0;
	}

	.stage {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: var(--cmd-bg);
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		touch-action: none;
		cursor: grab;
	}

	canvas.hand {
		cursor: pointer;
	}

	canvas:focus-visible {
		outline: var(--hair) solid var(--amber-edge);
		outline-offset: calc(-1 * var(--sp-2));
	}

	.msg {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		color: var(--muted);
		font-family: var(--sans);
		pointer-events: none;
	}

	.status {
		position: absolute;
		left: var(--sp-10);
		bottom: var(--sp-8);
		margin: 0;
		color: var(--faint);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
		pointer-events: none;
	}

	.side {
		overflow: auto;
		min-height: 0;
		padding: var(--sp-10) var(--pad-x);
		border-left: var(--border);
		background: var(--panel);
	}

	.kind {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
		color: var(--faint);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}

	h2 {
		margin: var(--sp-4) 0 var(--sp-2);
		font-family: var(--sans);
		font-size: var(--fs-l);
		font-weight: var(--fw-bold);
		line-height: var(--lh-tight);
	}

	h3 {
		margin: var(--sp-12) 0 var(--sp-6);
		color: var(--title-color);
		font-family: var(--title-font);
		font-size: var(--fs-title);
		font-weight: var(--fw-medium);
		letter-spacing: var(--title-track);
		text-transform: var(--title-case);
	}

	.sub {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4);
		margin-top: var(--sp-10);
	}

	.acts .primary {
		border-color: var(--amber-edge);
		background: var(--amber-soft);
		color: var(--amber);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.links li {
		padding: var(--sp-4) 0;
		border-bottom: var(--border);
	}

	.links button {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		width: 100%;
		height: auto;
		min-height: var(--control-h);
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.w {
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
	}

	.why {
		display: block;
		padding-left: calc(var(--swatch) + var(--sp-6));
		color: var(--faint);
		font-size: var(--fs-xxs);
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		padding: var(--sp-4) 0;
		border-bottom: var(--border);
		font-family: var(--sans);
	}

	.dot {
		flex: none;
		display: inline-block;
		width: var(--swatch);
		height: var(--swatch);
		border-radius: 50%;
		background: var(--kc);
	}

	/* La misma forma que en el lienzo: rombo (líder), cuadrado (sanción), triángulo (suceso), aro (tema). */
	.dot[data-cmd-kind='leader'] {
		border-radius: 0;
		transform: rotate(45deg) scale(0.85);
	}

	.dot[data-cmd-kind='sanction'] {
		border-radius: 0;
	}

	.dot[data-cmd-kind='event'] {
		border-radius: 0;
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
	}

	.dot[data-cmd-kind='story'] {
		background: none;
		border: var(--hair) solid var(--kc);
	}

	.none,
	.help {
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
		line-height: var(--lh-text);
	}

	.help.warn {
		color: var(--amber-dim);
	}

	@container (max-width: 680px) {
		.main {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr auto;
		}

		.side {
			max-height: 40cqh;
			border-left: 0;
			border-top: var(--border);
		}

		.tools {
			margin-left: 0;
		}
	}
</style>
