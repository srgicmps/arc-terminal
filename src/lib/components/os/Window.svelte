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
	import { untrack } from 'svelte';
	import type { OsApp } from '#lib/os/apps.ts';
	import { embedSrc } from '#lib/os/apps.ts';
	import { routeHref } from '#lib/routes.ts';
	import type { EmbedMessage } from '#lib/os/embed.ts';
	import { close, focus, maximize, minimize, os, place, setPath, snap } from '#lib/os/os.svelte.ts';
	import { snapTo, type Rect, type Snap, type Win } from '#lib/os/wm.ts';

	let {
		win,
		app,
		active,
		onpreview,
		onkey
	}: {
		win: Win;
		app: OsApp;
		/** Tiene el foco (la de delante del escritorio que se ve). */
		active: boolean;
		/** Dónde encajará si se suelta ahora (o null): lo pinta WindowLayer. */
		onpreview: (s: Snap | null) => void;
		/** Un atajo pulsado con el foco dentro del iframe. */
		onkey: (e: Pick<KeyboardEvent, 'key' | 'code' | 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>) => void;
	} = $props();

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

	const r = $derived(ghost ?? win);
	const title = $derived(win.path && win.path !== app.href ? `${app.name} · ${win.path}` : app.name);
</script>

<section
	class="win"
	class:active
	class:min={win.min}
	class:busy={drag !== null}
	class:snapped={!!win.snap}
	data-ui="os-win"
	data-app={app.id}
	style:left="{r.x}px"
	style:top="{r.y}px"
	style:width="{r.w}px"
	style:height="{r.h}px"
	style:z-index={win.z}
	aria-label={app.name}
	aria-hidden={win.min || undefined}
	onpointerdown={() => !active && focus(win.uid)}
>
	<!-- svelte-ignore a11y_no_static_element_interactions (con teclado: los atajos Alt de WindowLayer y los botones) -->
	<header
		class="title"
		data-ui="os-title"
		onpointerdown={(e) => down(e, 'move')}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		ondblclick={(e) => !(e.target as HTMLElement).closest('button') && maximize(win.uid)}
	>
		<span class="icon" aria-hidden="true">{app.icon}</span>
		<span class="name" {title}>{title}</span>
		<span class="btns">
			<button type="button" onclick={() => minimize(win.uid)} aria-label="Minimizar {app.name}" title="Minimizar">–</button>
			<button type="button" onclick={() => maximize(win.uid)} aria-label={win.snap === 'max' ? `Restaurar ${app.name}` : `Maximizar ${app.name}`} title={win.snap === 'max' ? 'Restaurar' : 'Maximizar'}>{win.snap === 'max' ? '❐' : '□'}</button>
			<button type="button" class="x" onclick={() => close(win.uid)} aria-label="Cerrar {app.name}" title="Cerrar">×</button>
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
	}

	.win.active {
		border: var(--os-win-edge-active);
	}

	/* Minimizada: oculta sin desmontar (el iframe y sus widgets siguen cargados). */
	.win.min {
		visibility: hidden;
		pointer-events: none;
	}

	.win.snapped {
		border-radius: 0;
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
		border-bottom: var(--border);
		font-size: var(--fs-s);
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.busy .title {
		cursor: grabbing;
	}

	.active .title {
		color: var(--os-title-fg-active);
	}

	.icon {
		color: var(--amber);
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.btns {
		display: flex;
		align-self: stretch;
	}

	.btns button {
		width: var(--os-title-h);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.btns button:hover {
		background: var(--amber-soft);
		color: var(--fg);
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

	@media (prefers-reduced-motion: no-preference) {
		.win:not(.busy) {
			transition:
				left var(--dur-ui) var(--ease),
				top var(--dur-ui) var(--ease),
				width var(--dur-ui) var(--ease),
				height var(--dur-ui) var(--ease);
		}
	}
</style>
