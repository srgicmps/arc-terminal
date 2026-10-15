<!--
	Iconos del escritorio de Arc OS: lo que hay en la carpeta Escritorio (src/lib/os/fs/: accesos a apps y carpetas)
	y la Papelera, como en un escritorio de verdad:
	- Clic: seleccionar (Ctrl o ⌘ para añadir o quitar). Doble clic o Intro: abrir. Con el dedo, un toque abre.
	  F2: cambiar el nombre. Supr: a la papelera. Ctrl+A: todos. Flechas: al icono de al lado.
	- Arrastrar: mueve el icono (o todos los seleccionados). Al soltar en el escritorio caen en la casilla libre más
	  cercana; sobre una carpeta (de aquí o de una ventana) entran en ella, y sobre la Papelera, a la papelera.
	- Arrastrar sobre el fondo: rectángulo de selección. Clic en el fondo: quita la selección.
	- Clic derecho: menú del icono (abrir, abrir otra ventana, cambiar nombre, a la papelera) o del escritorio (nueva
	  carpeta, apps, organizar iconos, mostrar escritorio, escritorio nuevo, widgets, fondo y aspecto). Teclado:
	  Mayús+F10 o la tecla de menú.
	Usa el ContextMenu común del núcleo.
-->
<script lang="ts">
	import OsIcon from '../icons/OsIcon.svelte';
	import ContextMenu, { type MenuEntry } from '#lib/components/os/ContextMenu.svelte';
	import { dropPlan } from '../fs/desk.ts';
	import { DESKTOP, list, TRASH, type FsNode } from '../fs/fs.ts';
	import { dropTarget, files, iconFor, mkdir, move, onDeskPlace, openNode, openTrash, rename, trash } from '../fs/fs.svelte.ts';
	import * as os from './bridge.ts';
	import { arrange, cellSize, cellToPx, inRect, moveGroup, nearestFree, neighbor, pxToCell, rectOf, type Cell, type Rect, type Spots } from './icons.ts';
	import { setIcons, setWidgets, shell } from './shell.svelte.ts';
	import type { StartApp } from './start.ts';
	import { addWidget, defaultWidgets, removeWidget, WIDGET_KINDS, WIDGET_LABEL } from './widgets.ts';

	interface Props {
		apps: StartApp[];
		w: number;
		h: number;
	}
	let { apps, w, h }: Props = $props();

	interface Entry {
		id: string;
		name: string;
		icon: string;
		desc?: string;
		node?: FsNode;
		/** Se puede soltar encima (carpetas y la Papelera). */
		drop?: string;
	}

	const size = $derived(cellSize(shell.skin));
	const cols = $derived(Math.max(1, Math.floor((w - 24) / size.w)));
	const rows = $derived(Math.max(1, Math.floor((h - 24) / size.h)));
	const binFull = $derived(list(files.tree, TRASH).length > 0);
	const icons = $derived<Entry[]>(
		files.ready
			? [
					...list(files.tree, DESKTOP).map((n) => ({
						id: n.id,
						name: n.name,
						icon: iconFor(n),
						desc: n.kind === 'app' ? apps.find((a) => a.id === n.app)?.desc : undefined,
						node: n,
						drop: n.kind === 'folder' ? n.id : undefined
					})),
					{ id: TRASH, name: 'Papelera', icon: binFull ? 'trash-full' : 'trash', desc: 'Lo que has tirado: ábrela para restaurarlo o vaciarla', drop: TRASH }
				]
			: []
	);
	/**
	 * Dónde se vio cada icono la última vez (en memoria). Los que no tienen casilla guardada conservan la suya cuando
	 * aparece otro (una app añadida desde el Launchpad o la barra, un archivo restaurado): sin esto, se correrían todos.
	 */
	let seen: Spots = {};
	const spots = $derived.by(() => {
		const out = arrange(icons.map((a) => a.id), { ...seen, ...shell.icons }, cols, rows);
		if (w > 0 && h > 0) seen = out;
		return out;
	});

	let selected = $state<string[]>([]);
	let drag = $state<{ id: string; from: Cell; start: { x: number; y: number }; dx: number; dy: number; moved: boolean } | null>(null);
	let band = $state<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
	let menu = $state<{ x: number; y: number; items: MenuEntry[]; label: string } | null>(null);
	let editing = $state<string | null>(null);
	let draft = $state('');
	let layer = $state<HTMLElement>();

	const local = (e: { clientX: number; clientY: number }) => {
		const r = layer!.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};
	const bandRect = $derived<Rect | null>(band ? rectOf(band.a, band.b) : null);
	/** La casilla de un punto de la pantalla (el puntero está en el centro del icono). */
	const cellAt = (x: number, y: number) => {
		const p = local({ clientX: x, clientY: y });
		return pxToCell(p.x - size.w / 2, p.y - size.h / 2, size, cols, rows);
	};
	/** Pone esos iconos en la casilla libre más cercana a `cell`. */
	function placeAt(ids: string[], cell: Cell) {
		const out: Spots = Object.fromEntries(Object.entries({ ...spots, ...underWidgets() }).filter(([id]) => !ids.includes(id)));
		for (const id of ids) out[id] = nearestFree(cell, out, [], cols, rows);
		setIcons({ ...shell.icons, ...real(out) });
	}
	/** Las casillas que tapa un widget, como si las ocupara un icono «#col,row»: ahí no se suelta nada (se escondería). */
	function underWidgets(): Spots {
		if (!layer || shell.widgetsHidden) return {};
		const base = layer.getBoundingClientRect();
		const all: Spots = {};
		for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) all[`#${col},${row}`] = { col, row };
		const out: Spots = {};
		for (const el of layer.parentElement?.querySelectorAll('.widget') ?? []) {
			const r = el.getBoundingClientRect();
			for (const k of inRect({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }, all, size)) out[k] = all[k];
		}
		return out;
	}
	const real = (s: Spots): Spots => Object.fromEntries(Object.entries(s).filter(([id]) => !id.startsWith('#')));
	/**
	 * Apunta la casilla de todos los iconos tal y como se ven ahora. Se hace antes de añadir o quitar uno: los que no
	 * tenían casilla guardada se colocan por orden, y sin esto se correrían todos al entrar o salir otro.
	 */
	const freeze = () => setIcons({ ...spots });
	// Lo que se suelta en el escritorio desde una ventana de carpeta cae en la casilla del puntero.
	$effect(() => onDeskPlace((ids, x, y) => layer && placeAt(ids, cellAt(x, y))));

	// ---- Iconos ----
	const group = (id: string) => (selected.includes(id) ? selected : [id]);
	function iconDown(e: PointerEvent, id: string) {
		if (e.button !== 0 || editing === id) return;
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
		if (!drag.moved) return;
		const ids = group(drag.id);
		const t = dropTarget(e.clientX, e.clientY, ids);
		const plan = dropPlan(files.tree, ids, DESKTOP, t);
		files.hover = plan.kind === 'move' || plan.kind === 'trash' ? t : null;
	}
	function iconUp(e: PointerEvent) {
		if (!drag) return;
		if (drag.moved && e.type === 'pointerup') {
			const ids = group(drag.id);
			const plan = dropPlan(files.tree, ids, DESKTOP, dropTarget(e.clientX, e.clientY, ids));
			if (plan.kind === 'desk') {
				const p = cellToPx(drag.from, size);
				const to = pxToCell(p.x + drag.dx, p.y + drag.dy, size, cols, rows);
				setIcons({ ...shell.icons, ...real(moveGroup({ ...spots, ...underWidgets() }, ids, drag.from, to, cols, rows)) });
			} else if (plan.kind === 'move') {
				freeze();
				move(plan.ids, plan.to);
			} else if (plan.kind === 'trash') {
				freeze();
				trash(plan.ids);
			}
			if (plan.kind !== 'desk') selected = selected.filter((id) => !files.tree[id] || files.tree[id].parent === DESKTOP || id === TRASH);
		}
		drag = null;
		files.hover = null;
	}
	const offset = (id: string) => (drag?.moved && (selected.includes(id) || drag.id === id) ? { x: drag.dx, y: drag.dy } : { x: 0, y: 0 });

	function open(id: string) {
		if (id === TRASH) openTrash();
		else if (files.tree[id]) openNode(files.tree[id]);
	}
	function toTrash(ids: string[]) {
		freeze();
		trash(ids.filter((id) => id !== TRASH));
		selected = [];
	}
	function startRename(id: string) {
		if (!files.tree[id]) return;
		selected = [id];
		editing = id;
		draft = files.tree[id].name;
	}
	function endRename(save: boolean) {
		if (editing && save && draft.trim()) rename(editing, draft);
		const id = editing;
		editing = null;
		if (id) queueMicrotask(() => layer?.querySelector<HTMLElement>(`[data-icon="${id}"] button`)?.focus());
	}
	function renameKey(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') endRename(true);
		else if (e.key === 'Escape') endRename(false);
	}
	function focusSelect(el: HTMLInputElement) {
		el.focus();
		el.select();
	}
	function newFolder(x: number, y: number) {
		freeze();
		const id = mkdir(DESKTOP);
		if (!id) return;
		placeAt([id], cellAt(x, y));
		startRename(id);
	}
	function iconKey(e: KeyboardEvent, id: string) {
		const next = e.key.startsWith('Arrow') ? neighbor(spots, id, e.key) : null;
		if (next) {
			// Flechas: al icono de al lado (con Mayúsculas, añadiéndolo a la selección).
			e.preventDefault();
			selected = e.shiftKey ? [...new Set([...selected, id, next])] : [next];
			layer?.querySelector<HTMLElement>(`[data-icon="${next}"] button`)?.focus();
		} else if (e.key === 'Enter') open(id);
		else if (e.key === 'F2') {
			e.preventDefault();
			startRename(id);
		} else if (e.key === 'Delete') toTrash(group(id));
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
		const ids = [...selected];
		const nodes = ids.filter((i) => i !== TRASH);
		const n = files.tree[id];
		if (id === TRASH) {
			menu = {
				x,
				y,
				label: 'Menú de la Papelera',
				items: [
					{ label: 'Abrir', kbd: 'Intro', run: openTrash },
					'sep',
					{ label: 'Vaciar papelera…', disabled: !binFull, run: () => ((files.ask = true), openTrash()) }
				]
			};
			return;
		}
		menu = {
			x,
			y,
			label: `Menú de ${n?.name ?? 'icono'}`,
			items: [
				{ label: 'Abrir', kbd: 'Intro', run: () => ids.forEach(open) },
				...(n?.kind === 'app' && n.app ? [{ label: 'Abrir otra ventana', run: () => os.openFresh(n.app!) }] : []),
				'sep',
				{ label: 'Cambiar nombre', kbd: 'F2', disabled: nodes.length > 1, run: () => startRename(id) },
				{ label: nodes.length > 1 ? `Mover ${nodes.length} a la papelera` : 'Mover a la papelera', kbd: 'Supr', run: () => toTrash(nodes) }
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
				{ label: 'Nueva carpeta', run: () => newFolder(x, y) },
				'sep',
				{ label: 'Todas las apps…', run: () => (shell.open = 'launchpad') },
				{ label: 'Buscar…', kbd: 'Ctrl+Espacio', run: () => (shell.open = 'spotlight') },
				'sep',
				{ label: 'Organizar iconos', run: () => ((seen = {}), setIcons({})) },
				{ label: 'Mostrar escritorio', run: os.showDesktop },
				{ label: 'Ventanas en mosaico', run: os.tileWins },
				{ label: 'Escritorio nuevo', run: os.addDesk },
				'sep',
				...WIDGET_KINDS.map((k): MenuEntry => ({ label: `Widget: ${WIDGET_LABEL[k]}`, checked: has(k), run: () => setWidgets(has(k) ? removeWidget(current, k) : addWidget(current, k, w, h)) })),
				'sep',
				{ label: 'Cambiar fondo…', run: () => os.open('wallpaper') },
				{ label: 'Aspecto y apariencia…', run: () => (shell.open = 'control') },
				...(apps.some((a) => a.id === 'ajustes') ? [{ label: 'Ajustes…', run: () => os.open('ajustes') }] : [])
			]
		};
	}
	function contextmenu(e: MouseEvent) {
		const icon = (e.target as HTMLElement).closest<HTMLElement>('[data-icon]');
		if (!icon && e.target !== layer) return;
		e.preventDefault();
		if (icon) iconMenu(e.clientX, e.clientY, icon.dataset.icon!);
		else deskMenu(e.clientX, e.clientY);
	}
	function layerKey(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
			e.preventDefault();
			selected = icons.map((a) => a.id);
		}
		if (e.key === 'Escape') selected = [];
		// Con el foco en el fondo (tras un rectángulo de selección), las teclas actúan sobre lo seleccionado.
		if (e.target !== layer) return;
		if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
			e.preventDefault();
			const r = layer.getBoundingClientRect();
			deskMenu(r.left + 40, r.top + 40);
		} else if (e.key === 'Enter') selected.forEach(open);
		else if (e.key === 'Delete') toTrash(selected);
		else if (e.key === 'F2' && selected.length === 1) {
			e.preventDefault();
			startRename(selected[0]);
		}
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
		<div
			class="icon"
			class:sel={selected.includes(a.id)}
			class:moving={o.x || o.y}
			class:drop={a.drop && files.hover === a.drop}
			data-icon={a.id}
			data-fs-item={a.id}
			data-fs-drop={a.drop}
			style:left={`${p.x + o.x}px`}
			style:top={`${p.y + o.y}px`}
			style:width={`${size.w - 8}px`}
		>
			<button
				type="button"
				class="hit"
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
				<OsIcon id={a.icon} size={shell.skin === 'mando' ? 64 : shell.skin === 'dsm' ? 56 : 48} />
				{#if editing !== a.id}<span class="name">{a.name}</span>{/if}
			</button>
			{#if editing === a.id}
				<input class="rename" aria-label="Nombre" maxlength="60" bind:value={draft} use:focusSelect onkeydown={renameKey} onblur={() => endRename(true)} />
			{/if}
		</div>
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
		user-select: none;
	}
	@media (hover: hover) {
		.icon:hover {
			background: var(--amber-soft);
		}
	}
	.icon.sel {
		background: var(--amber-soft);
		border-color: var(--amber-edge);
	}
	.icon.drop {
		background: var(--amber-soft);
		border-color: var(--amber);
	}
	.icon.moving {
		/* Deja ver la carpeta de debajo, resaltada, al pasar por encima. */
		opacity: 0.6;
		z-index: 1;
	}
	.hit {
		display: grid;
		justify-items: center;
		gap: var(--sp-4);
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: default;
		touch-action: none;
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
		overflow-wrap: anywhere;
	}
	.rename {
		width: 100%;
		min-width: 0;
		padding: 0 var(--sp-2);
		font: inherit;
		font-size: var(--fs-xs);
		text-align: center;
		color: var(--fg);
		background: var(--bg);
		border: var(--hair) solid var(--amber);
		border-radius: var(--radius-s);
		outline: none;
	}
	.band {
		position: absolute;
		background: var(--amber-soft);
		border: var(--hair) solid var(--amber);
		pointer-events: none;
	}
	/* iPhone e iPad: con menos de 16 px, Safari amplía la página al escribir (--fs-field vale 16 px en táctil). */
	@media (pointer: coarse) {
		.rename {
			font-size: var(--fs-field);
		}
	}
</style>
