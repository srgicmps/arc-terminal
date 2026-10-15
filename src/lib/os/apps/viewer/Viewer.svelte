<!--
	Visor de Arc OS: imágenes y PDF de tu dispositivo. Se eligen o se arrastran; no se suben a ningún sitio ni se
	guardan (se leen con URL.createObjectURL, solo en esta ventana). Imágenes con zoom (botones, + −, Ctrl+rueda),
	giro y arrastre para moverse por ellas; el PDF, con el visor del propio navegador. Con varias, ← → pasan de una
	a otra. La geometría (encajar, caja girada, pasos de zoom) está en fit.ts.
-->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { AppProps } from '../../apps.ts';
	import Tool from '../kit/Tool.svelte';
	import { fileSize, fitScale, frame, keepPoint, ZOOM_MAX, ZOOM_MIN, zoomStep } from './fit.ts';

	let { win }: AppProps = $props();

	interface Doc {
		name: string;
		url: string;
		pdf: boolean;
		size: number;
	}
	let docs = $state<Doc[]>([]);
	let at = $state(0);
	/** 0: encajar; si no, la escala sobre el tamaño real. */
	let zoom = $state(0);
	let turn = $state(0);
	let over = $state(false);
	let note = $state('');
	let input = $state<HTMLInputElement>();
	let stage = $state<HTMLDivElement>();
	let box = $state<HTMLDivElement>();
	let boxW = $state(0);
	let boxH = $state(0);
	/** Tamaño real de cada imagen, por URL, al cargarla. */
	let dims = $state<Record<string, [number, number]>>({});

	const doc = $derived(docs[at]);
	const MAX = 40;
	const nat = $derived(doc ? dims[doc.url] : undefined);
	const fit = $derived(nat ? fitScale(nat[0], nat[1], boxW, boxH, turn) : 1);
	const scale = $derived(zoom || fit);
	const geo = $derived(nat ? frame(nat[0], nat[1], scale, turn) : null);
	/** ¿Se sale del hueco? Entonces se puede arrastrar. */
	const pans = $derived(!!geo && (geo.boxW > boxW + 1 || geo.boxH > boxH + 1));

	function add(files: FileList | null | undefined) {
		const all = [...(files ?? [])];
		const ok = all.filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
		const skipped = all.length - ok.length;
		const fresh = ok.slice(0, MAX).map((f) => ({ name: f.name, url: URL.createObjectURL(f), pdf: f.type === 'application/pdf', size: f.size }));
		note = skipped ? (ok.length ? `${skipped} sin abrir: solo imágenes y PDF.` : 'Solo imágenes y PDF.') : ok.length > MAX ? `Abiertos los ${MAX} primeros.` : '';
		if (input) input.value = ''; // para poder volver a elegir el mismo archivo
		if (!fresh.length) return;
		at = docs.length;
		docs = [...docs, ...fresh];
		reset();
		tick().then(() => stage?.focus({ preventScroll: true }));
	}
	function reset() {
		zoom = 0;
		turn = 0;
	}
	function go(d: number) {
		if (docs.length < 2) return;
		at = (at + d + docs.length) % docs.length;
		note = '';
		reset();
	}
	function closeDoc() {
		if (!doc) return;
		URL.revokeObjectURL(doc.url);
		docs = docs.filter((_, i) => i !== at);
		at = Math.min(at, Math.max(0, docs.length - 1));
		reset();
	}
	onDestroy(() => docs.forEach((d) => URL.revokeObjectURL(d.url)));

	/** Cambia el zoom dejando quieto el punto del centro (o el del puntero, `px`/`py` dentro del hueco). */
	async function setZoom(next: number, px?: number, py?: number) {
		if (!nat || !box) return void (zoom = next);
		const before = frame(nat[0], nat[1], scale, turn);
		const sx = box.scrollLeft;
		const sy = box.scrollTop;
		zoom = next;
		await tick();
		const after = frame(nat[0], nat[1], next || fit, turn);
		box.scrollLeft = keepPoint(sx, boxW, before.boxW, after.boxW, px);
		box.scrollTop = keepPoint(sy, boxH, before.boxH, after.boxH, py);
	}
	const step = (dir: 1 | -1) => setZoom(zoomStep(scale, dir));
	/** «Encajar» ↔ tamaño real. */
	const toggleFit = () => setZoom(zoom ? 0 : 1);

	function key(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const img = doc && !doc.pdf;
		if (e.key === 'ArrowRight' && docs.length > 1) go(1);
		else if (e.key === 'ArrowLeft' && docs.length > 1) go(-1);
		else if (img && (e.key === '+' || e.key === '=')) step(1);
		else if (img && e.key === '-') step(-1);
		else if (img && e.key === '0') setZoom(0);
		else if (img && e.key === '1') setZoom(1);
		else if (img && e.key.toLowerCase() === 'r') turn = (turn + 90) % 360;
		else return;
		e.preventDefault();
	}

	// Ctrl+rueda (o el pellizco del panel táctil, que llega igual) acerca bajo el puntero; la rueda sola desplaza.
	function wheel(e: WheelEvent) {
		if (!(e.ctrlKey || e.metaKey) || !box) return;
		e.preventDefault();
		const r = box.getBoundingClientRect();
		setZoom(zoomStep(scale, e.deltaY < 0 ? 1 : -1), e.clientX - r.left, e.clientY - r.top);
	}

	// Arrastrar con el ratón mueve la imagen ampliada (con el dedo ya lo hace el scroll del navegador).
	let drag: { x: number; y: number; sx: number; sy: number } | null = $state(null);
	// Pellizco con dos dedos: el zoom sigue la distancia entre ellos (un dedo, el scroll normal del navegador).
	const touches = new Map<number, { x: number; y: number }>();
	let pinch: { d: number; scale: number } | null = null;
	const spread = () => {
		const [a, b] = [...touches.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	};
	function down(e: PointerEvent) {
		if (e.pointerType === 'touch') {
			touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
			if (touches.size === 2 && nat) pinch = { d: spread(), scale };
			return;
		}
		if (!pans || e.pointerType !== 'mouse' || e.button !== 0 || !box) return;
		e.preventDefault();
		box.setPointerCapture(e.pointerId);
		drag = { x: e.clientX, y: e.clientY, sx: box.scrollLeft, sy: box.scrollTop };
	}
	function move(e: PointerEvent) {
		if (touches.has(e.pointerId)) {
			touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
			if (pinch && touches.size === 2 && box) {
				const [a, b] = [...touches.values()];
				const r = box.getBoundingClientRect();
				const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (pinch.scale * spread()) / (pinch.d || 1)));
				if (Math.abs(next - scale) / scale > 0.01) setZoom(next, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
			}
			return;
		}
		if (!drag || !box) return;
		box.scrollLeft = drag.sx - (e.clientX - drag.x);
		box.scrollTop = drag.sy - (e.clientY - drag.y);
	}
	function up(e: PointerEvent) {
		touches.delete(e.pointerId);
		if (touches.size < 2) pinch = null;
		drag = null;
	}

	function loaded(e: Event, url: string) {
		const img = e.currentTarget as HTMLImageElement;
		dims[url] = [img.naturalWidth, img.naturalHeight];
	}
</script>

<Tool {win}>
	{#snippet bar()}
		<button type="button" onclick={() => input?.click()}>Abrir…</button>
		<input bind:this={input} type="file" accept="image/*,application/pdf" multiple hidden onchange={(e) => add(e.currentTarget.files)} />
		{#if doc}
			{#if docs.length > 1}
				<span class="pager">
					<button type="button" onclick={() => go(-1)} aria-label="Anterior" title="Anterior (←)">‹</button>
					<span class="mut">{at + 1} / {docs.length}</span>
					<button type="button" onclick={() => go(1)} aria-label="Siguiente" title="Siguiente (→)">›</button>
				</span>
			{/if}
			<span class="name" title={doc.name}>{doc.name} <span class="mut">· {fileSize(doc.size)}</span></span>
			<span class="gap"></span>
			<span class="tools">
				{#if !doc.pdf}
					<button type="button" onclick={() => step(-1)} aria-label="Alejar" title="Alejar (−)">−</button>
					<button type="button" class="pct" onclick={toggleFit} title="Encajar o tamaño real (0, 1)">{zoom ? `${Math.round(zoom * 100)} %` : 'Encajar'}</button>
					<button type="button" onclick={() => step(1)} aria-label="Acercar" title="Acercar (+)">+</button>
					<button type="button" onclick={() => (turn = (turn + 90) % 360)} aria-label="Girar" title="Girar (R)">↻</button>
				{:else}
					<a class="btn" href={doc.url} target="_blank" rel="noopener" title="Abrir en una pestaña del navegador">Abrir aparte</a>
				{/if}
				<button type="button" onclick={closeDoc} aria-label="Cerrar este archivo" title="Cerrar este archivo">×</button>
			</span>
		{/if}
	{/snippet}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="stage"
		class:over
		role="region"
		aria-label="Visor"
		tabindex="0"
		bind:this={stage}
		onkeydown={key}
		ondragover={(e) => (e.preventDefault(), (over = true))}
		ondragleave={() => (over = false)}
		ondrop={(e) => (e.preventDefault(), (over = false), add(e.dataTransfer?.files))}
	>
		{#if !doc}
			<div class="empty">
				<p>Arrastra aquí imágenes o PDF, o pulsa «Abrir…».</p>
				<p class="mut">Se quedan en tu dispositivo: no se suben ni se guardan.</p>
				{#if note}<p class="note" role="status">{note}</p>{/if}
			</div>
		{:else if doc.pdf}
			<iframe src={doc.url} title={doc.name}></iframe>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="img"
				class:pans
				class:dragging={!!drag}
				bind:this={box}
				bind:clientWidth={boxW}
				bind:clientHeight={boxH}
				onwheel={wheel}
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={up}
				ondblclick={toggleFit}
			>
				<div class="canvas" style:width="{geo ? geo.boxW : 0}px" style:height="{geo ? geo.boxH : 0}px">
					{#key doc.url}
						<img
							src={doc.url}
							alt={doc.name}
							draggable="false"
							class:ready={!!geo}
							style:width="{geo?.w ?? 0}px"
							style:height="{geo?.h ?? 0}px"
							style:transform="translate(-50%, -50%) rotate({turn}deg)"
							onload={(e) => loaded(e, doc.url)}
						/>
					{/key}
				</div>
			</div>
		{/if}
		{#if doc && note}<p class="toast" role="status">{note}</p>{/if}
	</div>
</Tool>

<style>
	button,
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--control-h);
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		color: var(--fg);
		text-decoration: none;
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	.pager,
	.tools {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-4);
	}

	.pct {
		min-width: 7ch;
	}

	.name {
		flex: 1 1 8ch;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gap {
		flex: 0 0 0;
	}

	.mut {
		color: var(--muted);
	}

	.stage {
		position: relative;
		height: 100%;
		min-height: 0;
		outline: none;
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
		overflow: hidden;
	}

	.stage:focus-visible {
		border-color: var(--amber-dim);
	}

	.over {
		border-color: var(--amber);
		background: var(--amber-soft);
	}

	.empty {
		display: grid;
		place-content: center;
		height: 100%;
		padding: var(--sp-16);
		text-align: center;
		font-family: var(--sans);
	}

	.empty p {
		margin: var(--sp-4) 0;
	}

	.note,
	.toast {
		color: var(--amber);
		font-family: var(--sans);
	}

	.toast {
		position: absolute;
		left: var(--sp-8);
		bottom: var(--sp-8);
		margin: 0;
		padding: var(--sp-2) var(--sp-8);
		background: var(--panel);
		border: var(--border);
		pointer-events: none;
	}

	iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}

	/* El hueco con scroll; dentro, una caja del tamaño de la imagen ya girada, centrada si cabe. */
	.img {
		display: flex;
		width: 100%;
		height: 100%;
		overflow: auto;
		overscroll-behavior: contain;
		/* Un dedo desplaza; el pellizco lo hace el Visor (no la página entera). */
		touch-action: pan-x pan-y;
	}

	.pans {
		cursor: grab;
	}

	.dragging {
		cursor: grabbing;
		user-select: none;
	}

	.canvas {
		position: relative;
		flex: none;
		margin: auto;
	}

	img {
		position: absolute;
		left: 50%;
		top: 50%;
		max-width: none;
		visibility: hidden;
		transition: transform var(--dur-fast);
	}

	img.ready {
		visibility: visible;
	}
</style>
