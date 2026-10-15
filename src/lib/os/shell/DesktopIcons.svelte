<!--
	Iconos del escritorio de Arc OS (las apps ancladas), como en un escritorio de verdad:
	- Clic: seleccionar (Ctrl o ⌘ para añadir o quitar). Doble clic o Intro: abrir. Con el dedo, un toque abre.
	- Arrastrar: mueve el icono (o todos los seleccionados) y al soltar caen en la casilla libre más cercana.
	- Arrastrar sobre el fondo: rectángulo de selección. Clic en el fondo: quita la selección.
	- Clic derecho: menú del icono (abrir, abrir otra ventana, quitar del escritorio) o del escritorio (apps,
	  organizar iconos, mostrar escritorio, escritorio nuevo, widgets, fondo y aspecto). Teclado: Mayús+F10 o la
	  tecla de menú.
	Usa el ContextMenu común del núcleo.
-->
<script lang="ts">
	import OsIcon from '../icons/OsIcon.svelte';
	import ContextMenu, { type MenuEntry } from '#lib/components/os/ContextMenu.svelte';
	import * as os from './bridge.ts';
	import { arrange, cellSize, cellToPx, inRect, moveGroup, pxToCell, rectOf, type Cell, type Rect } from './icons.ts';
	import { pin, setIcons, setWallpaper, setWidgets, shell } from './shell.svelte.ts';
	import type { StartApp } from './start.ts';
	import { addWidget, defaultWidgets, removeWidget, WIDGET_KINDS, WIDGET_LABEL } from './widgets.ts';

	interface Props {
		apps: StartApp[];
		w: number;
		h: number;
	}
	let { apps, w, h }: Props = $props();

	const size = $derived(cellSize(shell.skin));
	const cols = $derived(Math.max(1, Math.floor((w - 24) / size.w)));
	const rows = $derived(Math.max(1, Math.floor((h - 24) / size.h)));
	const icons = $derived(shell.pinned.map((id) => apps.find((a) => a.id === id)).filter((a): a is StartApp => !!a));
	const spots = $derived(arrange(icons.map((a) => a.id), shell.icons, cols, rows));

	let selected = $state<string[]>([]);
	let drag = $state<{ id: string; from: Cell; start: { x: number; y: number }; dx: number; dy: number; moved: boolean } | null>(null);
	let band = $state<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
	let menu = $state<{ x: number; y: number; items: MenuEntry[]; label: string } | null>(null);
	let layer = $state<HTMLElement>();

	const local = (e: { clientX: number; clientY: number }) => {
		const r = layer!.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};
	const bandRect = $derived<Rect | null>(band ? rectOf(band.a, band.b) : null);

	// ---- Iconos ----
	function iconDown(e: PointerEvent, id: string) {
		if (e.button !== 0) return;
		e.stopPropagation();
		if (e.ctrlKey || e.metaKey) selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
		else if (!selected.includes(id)) selected = [id];
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { id, from: spots[id], start: { x: e.clientX, y: e.clientY }, dx: 0, dy: 0, moved: false };
	}
	function iconMove(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.start.x;
		const dy = e.clientY - drag.start.y;
		drag = { ...drag, dx, dy, moved: drag.moved || Math.abs(dx) + Math.abs(dy) > 4 };
	}
	function iconUp() {
		if (!drag) return;
		if (drag.moved) {
			const p = cellToPx(drag.from, size);
			const to = pxToCell(p.x + drag.dx, p.y + drag.dy, size, cols, rows);
			const group = selected.includes(drag.id) ? selected : [drag.id];
			setIcons({ ...shell.icons, ...moveGroup(spots, group, drag.from, to, cols, rows) });
		}
		drag = null;
	}
	const offset = (id: string) => (drag?.moved && (selected.includes(id) || drag.id === id) ? { x: drag.dx, y: drag.dy } : { x: 0, y: 0 });

	function open(id: string) {
		os.open(id);
	}
	function iconKey(e: KeyboardEvent, id: string) {
		if (e.key === 'Enter') open(id);
		else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
			e.preventDefault();
			const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
			iconMenu(r.left + r.width / 2, r.top + r.height / 2, id);
		}
	}

	// ---- Fondo: selección rectangular ----
	function bgDown(e: PointerEvent) {
		if (e.button !== 0 || e.target !== layer) return;
		selected = [];
		layer.setPointerCapture(e.pointerId);
		const p = local(e);
		band = { a: p, b: p };
	}
	function bgMove(e: PointerEvent) {
		if (!band) return;
		band = { ...band, b: local(e) };
		selected = inRect(bandRect!, spots, size);
	}
	function bgUp() {
		band = null;
	}

	// ---- Menús ----
	function iconMenu(x: number, y: number, id: string) {
		if (!selected.includes(id)) selected = [id];
		const app = apps.find((a) => a.id === id);
		menu = {
			x,
			y,
			label: `Menú de ${app?.title ?? 'app'}`,
			items: [
				{ label: 'Abrir', kbd: 'Intro', run: () => selected.forEach(open) },
				{ label: 'Abrir otra ventana', run: () => os.openFresh(id) },
				'sep',
				{ label: selected.length > 1 ? `Quitar ${selected.length} del escritorio` : 'Quitar del escritorio', run: () => (selected.forEach(pin), (selected = [])) }
			]
		};
	}
	function deskMenu(x: number, y: number) {
		const current = shell.widgets ?? defaultWidgets(w, shell.skin);
		const has = (k: (typeof WIDGET_KINDS)[number]) => current.some((x) => x.kind === k);
		menu = {
			x,
			y,
			label: 'Menú del escritorio',
			items: [
				{ label: 'Todas las apps…', run: () => (shell.open = 'launchpad') },
				{ label: 'Buscar…', kbd: 'Ctrl+Espacio', run: () => (shell.open = 'spotlight') },
				'sep',
				{ label: 'Organizar iconos', run: () => setIcons({}) },
				{ label: 'Mostrar escritorio', run: os.showDesktop },
				{ label: 'Ventanas en mosaico', run: os.tileWins },
				{ label: 'Escritorio nuevo', run: os.addDesk },
				'sep',
				...WIDGET_KINDS.map((k): MenuEntry => ({ label: `Widget: ${WIDGET_LABEL[k]}`, checked: has(k), run: () => setWidgets(has(k) ? removeWidget(current, k) : addWidget(current, k, w)) })),
				'sep',
				{ label: 'Siguiente fondo', run: nextWallpaper },
				{ label: 'Aspecto y apariencia…', run: () => (shell.open = 'control') }
			]
		};
	}
	function nextWallpaper() {
		const ids = ['sistema', 'estilo', 'liso', 'rejilla', 'degradado'] as const;
		const i = ids.indexOf(shell.wallpaper as (typeof ids)[number]);
		setWallpaper(ids[(i + 1) % ids.length]);
	}
	function contextmenu(e: MouseEvent) {
		const icon = (e.target as HTMLElement).closest<HTMLElement>('[data-icon]');
		if (!icon && e.target !== layer) return;
		e.preventDefault();
		if (icon) iconMenu(e.clientX, e.clientY, icon.dataset.icon!);
		else deskMenu(e.clientX, e.clientY);
	}
	function layerKey(e: KeyboardEvent) {
		if (e.target === layer && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
			e.preventDefault();
			const r = layer.getBoundingClientRect();
			deskMenu(r.left + 40, r.top + 40);
		}
		if (e.key === 'Escape') selected = [];
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class="layer"
	bind:this={layer}
	role="group"
	aria-label="Escritorio: arrastra para seleccionar, clic derecho para el menú"
	tabindex="0"
	onpointerdown={bgDown}
	onpointermove={bgMove}
	onpointerup={bgUp}
	onpointercancel={bgUp}
	oncontextmenu={contextmenu}
	onkeydown={layerKey}
>
	{#each icons as a (a.id)}
		{@const p = cellToPx(spots[a.id], size)}
		{@const o = offset(a.id)}
		<button
			type="button"
			class="icon"
			class:sel={selected.includes(a.id)}
			class:moving={o.x || o.y}
			data-icon={a.id}
			style:left={`${p.x + o.x}px`}
			style:top={`${p.y + o.y}px`}
			style:width={`${size.w - 8}px`}
			aria-pressed={selected.includes(a.id)}
			title={a.desc}
			onpointerdown={(e) => iconDown(e, a.id)}
			onpointermove={iconMove}
			onpointerup={iconUp}
			onpointercancel={iconUp}
			ondblclick={() => open(a.id)}
			onclick={(e) => (e as unknown as PointerEvent).pointerType === 'touch' && open(a.id)}
			onkeydown={(e) => iconKey(e, a.id)}
		>
			<OsIcon id={a.id} size={shell.skin === 'mando' ? 64 : shell.skin === 'dsm' ? 56 : 48} />
			<span class="name">{a.title}</span>
		</button>
	{/each}
	{#if bandRect}
		<div class="band" style:left={`${bandRect.x}px`} style:top={`${bandRect.y}px`} style:width={`${bandRect.w}px`} style:height={`${bandRect.h}px`}></div>
	{/if}
</div>

{#if menu}
	<ContextMenu x={menu.x} y={menu.y} items={menu.items} label={menu.label} onclose={() => (menu = null)} />
{/if}

<style>
	.layer {
		position: absolute;
		inset: 0;
		outline: none;
		touch-action: none;
	}
	.icon {
		position: absolute;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: var(--sp-4);
		padding: var(--sp-6) var(--sp-4);
		border: var(--hair) solid transparent;
		border-radius: var(--radius-s);
		background: none;
		color: inherit;
		font: inherit;
		cursor: default;
		user-select: none;
		touch-action: none;
	}
	.icon:hover {
		background: var(--amber-soft);
	}
	.icon.sel {
		background: var(--amber-soft);
		border-color: var(--amber-edge);
	}
	.icon.moving {
		opacity: 0.8;
		z-index: 1;
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-xs);
		text-shadow: 0 0 var(--sp-4) var(--bg);
	}
	.sel .name {
		white-space: normal;
	}
	.band {
		position: absolute;
		background: var(--amber-soft);
		border: var(--hair) solid var(--amber);
		pointer-events: none;
	}
</style>
