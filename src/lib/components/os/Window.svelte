<!--
	Una ventana de Arc OS. Se mueve arrastrando la barra de título y se redimensiona por los bordes derecho e inferior
	y la esquina (Pointer Events con setPointerCapture, sin librerías). Al soltarla contra un borde del escritorio
	se encaja a una mitad, y contra una esquina a un cuarto; arriba, a pantalla entera. Doble clic en el título:
	maximizar o volver.
	Dentro va la vista en un iframe (?embed=1, sin la cabecera de la web) o, si la app es una herramienta, su
	componente. Mover, minimizar o cambiar de escritorio no desmonta nada (solo CSS): los widgets de TradingView
	no se recargan.
-->
<script lang="ts">
	import OsIcon from '#lib/os/icons/OsIcon.svelte';
	import UiIcon from '#lib/os/icons/UiIcon.svelte';
	import { untrack } from 'svelte';
	import type { OsApp } from '#lib/os/apps.ts';
	import { embedSrc } from '#lib/os/apps.ts';
	import { routeHref } from '#lib/routes.ts';
	import type { EmbedMessage } from '#lib/os/embed.ts';
	import { close, closeNow, focus, maximize, minimize, nudge, os, place, setPath, snap } from '#lib/os/os.svelte.ts';
	import { snapTo, stackZ, type Rect, type Snap, type Win } from '#lib/os/wm.ts';

	let {
		win,
		app,
		active,
		onpreview,
		onkey,
		onmenu
	}: {
		win: Win;
		app: OsApp;
		/** Tiene el foco (la de delante del escritorio que se ve). */
		active: boolean;
		/** Dónde encajará si se suelta ahora (o null): lo pinta WindowLayer. */
		onpreview: (s: Snap | null) => void;
		/** Un atajo pulsado con el foco dentro del iframe. */
		onkey: (e: Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>) => void;
		/** Clic derecho en la barra de título (o ⇧F10 / tecla de menú): WindowLayer abre el menú de la ventana. */
		onmenu: (x: number, y: number) => void;
	} = $props();

	let el = $state<HTMLElement>();
	const closing = $derived(os.closing.includes(win.uid));
	// Al cerrar: se anima (--os-anim-close) y al acabar se quita. Sin animación (0 ms o movimiento reducido), ya.
	$effect(() => {
		if (!closing || !el) return;
		const ms = parseFloat(getComputedStyle(el).animationDuration) || 0;
		if (ms === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) closeNow(win.uid);
		else {
			const t = setTimeout(() => closeNow(win.uid), ms * 1000 + 50);
			return () => clearTimeout(t);
		}
	});

	/** La base de la web (vacía si se publica en la raíz). */
	const base = routeHref('/').replace(/\/$/, '');
	let frame = $state<HTMLIFrameElement>();
	// La ruta se lee una vez: si cambia porque navegas dentro, no se vuelve a cargar el iframe.
	const src = untrack(() => (app.href !== undefined ? base + embedSrc(win.path ?? app.href) : ''));

	type Drag = { kind: 'move' | 'e' | 's' | 'se'; px: number; py: number; start: Rect; moved: boolean };
	let drag = $state<Drag | null>(null);
	let ghost = $state<Rect | null>(null);
	let target: Snap | null = null;

	const EDGE = 6;
	function snapAt(x: number, y: number): Snap | null {
		const { w, h } = os.area;
		const corner = y < h / 4 ? 'top-' : y > (h * 3) / 4 ? 'bottom-' : '';
		if (x <= EDGE) return `${corner}left` as Snap;
		if (x >= w - EDGE) return `${corner}right` as Snap;
		return y <= EDGE ? 'max' : null;
	}

	function down(e: PointerEvent, kind: Drag['kind']) {
		if (e.button !== 0) return;
		if (kind === 'move' && (e.target as HTMLElement).closest('button')) return;
		focus(win.uid);
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { kind, px: e.clientX, py: e.clientY, start: { x: win.x, y: win.y, w: win.w, h: win.h }, moved: false };
		e.preventDefault();
	}

	function move(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.px;
		const dy = e.clientY - drag.py;
		if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
		drag.moved = true;
		const s = drag.start;
		if (drag.kind === 'move') {
			// Una ventana encajada se suelta al arrastrarla: recupera su tamaño, bajo el puntero.
			const from = win.snap && win.restore ? win.restore : s;
			const x = win.snap && win.restore ? e.clientX - layerX() - from.w / 2 : s.x + dx;
			ghost = { x: snapTo(x), y: snapTo(Math.max(0, s.y + dy)), w: from.w, h: from.h };
			const host = (e.currentTarget as HTMLElement).closest('[data-os-layer]')?.getBoundingClientRect();
			target = host ? snapAt(e.clientX - host.left, e.clientY - host.top) : null;
			onpreview(target);
		} else {
			ghost = {
				x: s.x,
				y: s.y,
				w: drag.kind === 'e' || drag.kind === 'se' ? snapTo(s.w + dx) : s.w,
				h: drag.kind === 's' || drag.kind === 'se' ? snapTo(s.h + dy) : s.h
			};
		}
	}

	const layerX = () => frame?.closest('[data-os-layer]')?.getBoundingClientRect().left ?? 0;

	function up() {
		if (!drag) return;
		if (drag.moved) {
			if (drag.kind === 'move' && target) snap(win.uid, target);
			else if (ghost) place(win.uid, ghost);
		}
		drag = null;
		ghost = null;
		target = null;
		onpreview(null);
	}

	// Lo que dice la vista de dentro (src/lib/os/embed.ts): la has tocado, ha navegado o un atajo.
	$effect(() => {
		const onMessage = (e: MessageEvent<EmbedMessage>) => {
			if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
			const m = e.data;
			if (m?.type === 'arcos:focus') focus(win.uid);
			else if (m?.type === 'arcos:path') setPath(win.uid, m.path.startsWith(base) ? m.path.slice(base.length) || '/' : m.path);
			else if (m?.type === 'arcos:key') onkey({ key: m.key, code: m.code, altKey: m.alt, shiftKey: m.shift, ctrlKey: m.ctrl, metaKey: m.meta });
		};
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	});

	const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
	/** Con el foco en la barra de título: flechas para mover, ⇧+flechas para cambiar el tamaño, Intro para maximizar. */
	function onTitleKey(e: KeyboardEvent) {
		if (e.altKey || e.ctrlKey || e.metaKey || e.target !== e.currentTarget) return;
		const d = ARROWS[e.key];
		if (d) nudge(win.uid, d[0], d[1], e.shiftKey);
		else if (e.key === 'Enter') maximize(win.uid);
		else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
			const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
			onmenu(r.left + 8, r.bottom);
		}
		else return;
		e.preventDefault();
	}

	const r = $derived(ghost ?? win);
	const title = $derived(app.title ? app.title(win.path) : win.path && win.path !== app.href ? `${app.name} · ${win.path}` : app.name);
</script>

<section
	class="win"
	class:active
	class:min={win.min}
	class:closing
	class:busy={drag !== null}
	class:snapped={!!win.snap}
	data-ui="os-win"
	data-app={app.id}
	style:left="{r.x}px"
	style:top="{r.y}px"
	style:width="{r.w}px"
	style:height="{r.h}px"
	style:z-index={stackZ(win)}
	bind:this={el}
	onanimationend={(e) => closing && e.animationName.endsWith('os-close') && closeNow(win.uid)}
	aria-label={app.name}
	aria-hidden={win.min || undefined}
	onpointerdown={() => !active && focus(win.uid)}
>
	<header
		class="title"
		data-ui="os-title"
		role="toolbar"
		tabindex="0"
		aria-label="{app.name}: flechas para mover, ⇧ y flechas para cambiar el tamaño, Intro para maximizar, ⇧F10 para el menú"
		onkeydown={onTitleKey}
		onfocus={() => !active && focus(win.uid)}
		onpointerdown={(e) => down(e, 'move')}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		ondblclick={(e) => !(e.target as HTMLElement).closest('button') && maximize(win.uid)}
		oncontextmenu={(e) => {
			e.preventDefault();
			focus(win.uid);
			onmenu(e.clientX, e.clientY);
		}}
	>
		<span class="icon" data-ui="os-icon" aria-hidden="true"><OsIcon id={app.id} size={14} /></span>
		<span class="name" data-ui="os-name" {title}>{title}</span>
		<span class="btns" data-ui="os-btns">
			<button type="button" data-ui="os-btn" data-btn="min" onclick={() => minimize(win.uid)} aria-label="Minimizar {app.name}" title="Minimizar"><span class="glyph" aria-hidden="true"><UiIcon id="min" /></span></button>
			<button type="button" data-ui="os-btn" data-btn="max" onclick={() => maximize(win.uid)} aria-label={win.snap === 'max' ? `Restaurar ${app.name}` : `Maximizar ${app.name}`} title={win.snap === 'max' ? 'Restaurar' : 'Maximizar'}><span class="glyph" aria-hidden="true"><UiIcon id={win.snap === 'max' ? 'restore' : 'max'} /></span></button>
			<button type="button" data-ui="os-btn" data-btn="close" onclick={() => close(win.uid)} aria-label="Cerrar {app.name}" title="Cerrar"><span class="glyph" aria-hidden="true"><UiIcon id="close" /></span></button>
		</span>
	</header>
	<div class="body">
		{#if app.load}
			{#await app.load() then m}
				<m.default win={win.uid} />
			{/await}
		{:else}
			<iframe bind:this={frame} {src} title={app.name} loading="lazy"></iframe>
		{/if}
	</div>
	{#each ['e', 's', 'se'] as const as k (k)}
		<div
			class="grip {k}"
			aria-hidden="true"
			onpointerdown={(e) => down(e, k)}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		></div>
	{/each}
</section>

<style>
	/*
	 * La decoración sale de los tokens --os-* (tokens.css): cada aspecto del escritorio (data-os-skin en el
	 * contenedor de /os: Windows, Mac, Linux…) y cada estética los redefinen sin tocar este archivo.
	 */
	.win {
		position: absolute;
		display: flex;
		flex-direction: column;
		min-width: 0;
		background: var(--os-win-bg);
		border: var(--os-win-edge);
		border-radius: var(--os-win-radius);
		box-shadow: var(--os-win-shadow);
		overflow: hidden;
		contain: layout paint;
		animation: os-open var(--os-anim-open) var(--ease);
	}

	.win.active {
		border: var(--os-win-edge-active);
		box-shadow: var(--os-win-shadow-active);
	}

	/* Minimizada: oculta sin desmontar (el iframe y sus widgets siguen cargados). */
	.win.min {
		visibility: hidden;
		pointer-events: none;
		opacity: 0;
		transform: translateY(var(--os-min-shift)) scale(var(--os-min-scale));
	}

	.win.snapped {
		border-radius: var(--os-win-radius-snapped);
	}

	.win.closing {
		pointer-events: none;
		animation: os-close var(--os-anim-close) var(--ease) forwards;
	}

	@keyframes os-close {
		to {
			opacity: 0;
			transform: scale(var(--os-open-scale));
		}
	}

	@keyframes os-open {
		from {
			opacity: 0;
			transform: scale(var(--os-open-scale));
		}
	}

	.title {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		flex: none;
		height: var(--os-title-h);
		padding: 0 0 0 var(--pad-x);
		background: var(--os-title-bg);
		color: var(--os-title-fg);
		border-bottom: var(--os-title-edge);
		font-family: var(--os-title-font);
		font-size: var(--fs-s);
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.title:focus-visible {
		outline: var(--focus-w) solid var(--amber);
		outline-offset: calc(-1 * var(--focus-w));
	}

	.busy .title {
		cursor: grabbing;
	}

	.active .title {
		background: var(--os-title-bg-active);
		color: var(--os-title-fg-active);
	}

	.icon {
		display: var(--os-icon-display);
		line-height: 0;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		text-align: var(--os-title-align);
	}

	/* Los botones: a la derecha (order alto) o a la izquierda (order negativo), y en el orden de cada aspecto. */
	.btns {
		order: var(--os-btns-order);
		display: flex;
		align-items: center;
		align-self: stretch;
		gap: var(--os-btn-gap);
		padding: 0 var(--os-btns-pad);
	}

	.btns button {
		display: grid;
		place-items: center;
		width: var(--os-btn-w);
		height: var(--os-btn-h);
		padding: 0;
		border: 0;
		border-radius: var(--os-btn-radius);
		background: var(--os-btn-bg);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.btns [data-btn='min'] {
		order: var(--os-btn-min-order);
		background: var(--os-btn-min-bg, var(--os-btn-bg));
	}

	.btns [data-btn='max'] {
		order: var(--os-btn-max-order);
		background: var(--os-btn-max-bg, var(--os-btn-bg));
	}

	.btns [data-btn='close'] {
		order: var(--os-btn-close-order);
		background: var(--os-btn-close-bg, var(--os-btn-bg));
	}

	/* Símbolo SVG (ui.ts) del tamaño de la letra del título, y nunca mayor que el botón (los círculos del Mac). */
	.glyph {
		display: grid;
		place-items: center;
		width: min(var(--sp-12), 100%);
		height: min(var(--sp-12), 100%);
		opacity: var(--os-btn-glyph);
	}
	.glyph :global(svg) {
		width: 100%;
		height: 100%;
	}

	.btns button:hover .glyph,
	.btns button:focus-visible .glyph {
		opacity: 1;
	}

	.btns button:hover {
		box-shadow: inset 0 0 0 100vmax var(--os-btn-hover);
		color: var(--fg);
	}

	.btns [data-btn='close']:hover {
		box-shadow: inset 0 0 0 100vmax var(--os-btn-close-hover, var(--os-btn-hover));
		color: var(--os-btn-close-hover-fg, var(--fg));
	}

	.body {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		background: var(--bg);
	}

	/* Mientras se arrastra, el iframe no se queda los movimientos del puntero. */
	.busy iframe {
		pointer-events: none;
	}

	.grip {
		position: absolute;
		touch-action: none;
	}

	.grip.e {
		top: var(--os-title-h);
		right: 0;
		bottom: var(--sp-8);
		width: var(--sp-4);
		cursor: ew-resize;
	}

	.grip.s {
		left: 0;
		right: var(--sp-8);
		bottom: 0;
		height: var(--sp-4);
		cursor: ns-resize;
	}

	.grip.se {
		right: 0;
		bottom: 0;
		width: var(--sp-12);
		height: var(--sp-12);
		cursor: nwse-resize;
	}

	/* Maximizar, encajar y mosaico: el cambio de sitio se anima (salvo al arrastrar). */
	.win:not(.busy) {
		transition:
			left var(--os-anim-max) var(--ease),
			top var(--os-anim-max) var(--ease),
			width var(--os-anim-max) var(--ease),
			height var(--os-anim-max) var(--ease),
			opacity var(--os-anim-min) var(--ease),
			transform var(--os-anim-min) var(--ease),
			visibility 0s;
	}

	.win.min:not(.busy) {
		transition:
			opacity var(--os-anim-min) var(--ease),
			transform var(--os-anim-min) var(--ease),
			visibility 0s var(--os-anim-min);
	}

	@media (prefers-reduced-motion: reduce) {
		.win,
		.win.min,
		.win:not(.busy) {
			animation: none;
			transition: none;
		}
	}
</style>
