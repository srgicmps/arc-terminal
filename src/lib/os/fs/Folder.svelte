<!--
	Ventana de carpeta de Arc OS (app «carpeta»): lo que hay en una carpeta del escritorio, o en la papelera.
	La carpeta va en el path de la ventana («/<id>»); navegar dentro cambia ese path, en la misma ventana.
	- Barra: «‹» sube a la carpeta madre, la ruta (cada tramo lleva a su carpeta) y «Nueva carpeta».
	- Clic: seleccionar (Ctrl o ⌘ añade). Doble clic o Intro: abrir (una carpeta, dentro). F2: cambiar el nombre.
	  Supr: a la papelera. Clic derecho: menú del icono o de la carpeta.
	- Arrastrar un icono: a otra carpeta (de aquí, del escritorio o de otra ventana), a la Papelera o al escritorio.
	- En la papelera: Restaurar, Eliminar para siempre y Vaciar papelera, con confirmación en la propia barra.
-->
<script lang="ts">
	import ContextMenu, { type MenuEntry } from '#lib/components/os/ContextMenu.svelte';
	import Tool from '../apps/kit/Tool.svelte';
	import type { AppProps } from '../apps.ts';
	import OsIcon from '../icons/OsIcon.svelte';
	import { os, setPath } from '../os.svelte.ts';
	import * as bridge from '../shell/bridge.ts';
	import { dropPlan, folderOf, folderPath } from './desk.ts';
	import { DESKTOP, isFolder, list, path as pathTo, rootOf, TRASH, type FsNode } from './fs.ts';
	import { dropTarget, emptyTrash, files, folderName, iconFor, mkdir, move, moveToDesk, openNode, purge, rename, restore, trash } from './fs.svelte.ts';

	let { win }: AppProps = $props();

	const w = $derived(os.state.desks.flatMap((d) => d.wins).find((x) => x.uid === win));
	const folder = $derived(folderOf(w?.path));
	const exists = $derived(isFolder(files.tree, folder));
	const root = $derived(rootOf(files.tree, folder));
	const isBin = $derived(folder === TRASH);
	const items = $derived(exists ? list(files.tree, folder) : []);
	const crumbs = $derived([{ id: root, name: folderName(root) }, ...pathTo(files.tree, folder).map((n) => ({ id: n.id, name: n.name }))]);
	const parent = $derived(files.tree[folder]?.parent ?? null);

	let selected = $state<string[]>([]);
	let editing = $state<string | null>(null);
	let draft = $state('');
	let menu = $state<{ x: number; y: number; items: MenuEntry[]; label: string } | null>(null);
	/** Confirmación en la barra («¿Vaciar la papelera?»). */
	let ask = $state<{ text: string; ok: string; run: () => void } | null>(null);
	let drag = $state<{ ids: string[]; x0: number; y0: number; x: number; y: number; moved: boolean } | null>(null);
	let grid = $state<HTMLElement>();

	function go(id: string) {
		selected = [];
		editing = null;
		ask = null;
		setPath(win, folderPath(id));
	}

	// «Vaciar papelera…» desde el escritorio: lo pregunta la ventana de la papelera.
	$effect(() => {
		if (isBin && files.ask) {
			files.ask = false;
			askEmpty();
		}
	});

	// Lo seleccionado que ya no está aquí (se ha movido desde otra ventana) deja de estarlo.
	$effect(() => {
		const here = new Set(items.map((n) => n.id));
		if (selected.some((id) => !here.has(id))) selected = selected.filter((id) => here.has(id));
	});

	const node = (id: string) => files.tree[id];
	const many = (n: number, one: string, more: string) => (n > 1 ? more.replace('#', String(n)) : one);

	function open(n: FsNode) {
		if (n.kind === 'folder') go(n.id);
		else openNode(n);
	}
	function startRename(id: string) {
		if (!node(id)) return;
		selected = [id];
		editing = id;
		draft = node(id).name;
	}
	function endRename(save: boolean) {
		if (editing && save && draft.trim()) rename(editing, draft);
		const id = editing;
		editing = null;
		if (id) queueMicrotask(() => grid?.querySelector<HTMLElement>(`[data-fs-item="${id}"] button`)?.focus());
	}
	function newFolder() {
		const id = mkdir(folder);
		if (id) startRename(id);
	}
	function toTrash(ids: string[]) {
		trash(ids);
		selected = [];
	}
	function askEmpty() {
		const n = list(files.tree, TRASH).length;
		if (!n) return;
		ask = { text: `¿Borrar para siempre ${many(n, 'lo que hay', '# elementos')} en la papelera?`, ok: 'Vaciar', run: emptyTrash };
	}
	function askPurge(ids: string[]) {
		ask = {
			text: ids.length > 1 ? `¿Eliminar para siempre ${ids.length} elementos?` : `¿Eliminar para siempre «${node(ids[0])?.name}»?`,
			ok: 'Eliminar',
			run: () => {
				purge(ids);
				selected = [];
			}
		};
	}

	// ---- Iconos ----
	function itemDown(e: PointerEvent, id: string) {
		if (e.button !== 0 || editing === id) return;
		if (e.ctrlKey || e.metaKey) selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
		else if (!selected.includes(id)) selected = [id];
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = { ids: selected.includes(id) ? [...selected] : [id], x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
	}
	function itemMove(e: PointerEvent) {
		if (!drag) return;
		const moved = drag.moved || Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 4;
		drag = { ...drag, x: e.clientX, y: e.clientY, moved };
		if (!moved) return;
		const t = dropTarget(e.clientX, e.clientY, drag.ids);
		const plan = dropPlan(files.tree, drag.ids, folder, t);
		files.hover = plan.kind === 'move' || plan.kind === 'trash' ? t : null;
	}
	function itemUp(e: PointerEvent) {
		if (!drag) return;
		if (drag.moved && e.type === 'pointerup') {
			const plan = dropPlan(files.tree, drag.ids, folder, dropTarget(e.clientX, e.clientY, drag.ids));
			if (plan.kind === 'trash') toTrash(plan.ids);
			else if (plan.kind === 'move' && plan.to === DESKTOP) moveToDesk(plan.ids, e.clientX, e.clientY);
			else if (plan.kind === 'move') move(plan.ids, plan.to);
			else if (plan.kind === 'desk') moveToDesk(drag.ids, e.clientX, e.clientY);
		}
		drag = null;
		files.hover = null;
	}
	function itemKey(e: KeyboardEvent, n: FsNode) {
		if (e.key === 'Enter') open(n);
		else if (e.key === 'F2' && !isBin) {
			e.preventDefault();
			startRename(n.id);
		} else if (e.key === 'Delete') {
			const ids = selected.includes(n.id) ? selected : [n.id];
			if (isBin) askPurge(ids);
			else toTrash(ids);
		} else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
			e.preventDefault();
			const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
			itemMenu(r.left + r.width / 2, r.top + r.height / 2, n);
		}
	}
	function renameKey(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Enter') endRename(true);
		else if (e.key === 'Escape') endRename(false);
	}
	/** Al aparecer el campo de nombre: foco y el nombre seleccionado. */
	function focusSelect(el: HTMLInputElement) {
		el.focus();
		el.select();
	}

	// ---- Menús ----
	function itemMenu(x: number, y: number, n: FsNode) {
		if (!selected.includes(n.id)) selected = [n.id];
		const ids = [...selected];
		const items: MenuEntry[] = isBin
			? [
					{ label: many(ids.length, 'Restaurar', 'Restaurar #'), run: () => (restore(ids), (selected = [])) },
					'sep',
					{ label: 'Eliminar para siempre…', kbd: 'Supr', run: () => askPurge(ids) }
				]
			: [
					{ label: 'Abrir', kbd: 'Intro', run: () => open(n) },
					...(n.kind === 'app' && n.app ? [{ label: 'Abrir otra ventana', run: () => bridge.openFresh(n.app!) }] : []),
					'sep',
					{ label: 'Cambiar nombre', kbd: 'F2', disabled: ids.length > 1, run: () => startRename(n.id) },
					{ label: many(ids.length, 'Mover a la papelera', 'Mover # a la papelera'), kbd: 'Supr', run: () => toTrash(ids) }
				];
		menu = { x, y, label: `Menú de ${n.name}`, items };
	}
	function bgMenu(x: number, y: number) {
		menu = {
			x,
			y,
			label: `Menú de ${folderName(folder)}`,
			items: isBin
				? [{ label: 'Vaciar papelera…', disabled: !items.length, run: askEmpty }]
				: [{ label: 'Nueva carpeta', disabled: root === TRASH, run: newFolder }, ...(parent ? ['sep' as const, { label: 'Subir', run: () => go(parent) }] : [])]
		};
	}
	function contextmenu(e: MouseEvent) {
		const el = (e.target as HTMLElement).closest<HTMLElement>('[data-fs-item]');
		e.preventDefault();
		const n = el && node(el.dataset.fsItem!);
		if (n) itemMenu(e.clientX, e.clientY, n);
		else bgMenu(e.clientX, e.clientY);
	}
	function gridDown(e: PointerEvent) {
		if (e.button === 0 && e.target === grid) selected = [];
	}
	function gridKey(e: KeyboardEvent) {
		if (e.key === 'Escape') selected = [];
		else if (e.target === grid && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
			e.preventDefault();
			const r = grid!.getBoundingClientRect();
			bgMenu(r.left + 40, r.top + 40);
		}
	}

	/** Lleva el fantasma del arrastre al final de <body>, para que salga de la ventana (que recorta lo de dentro). */
	function portal(el: HTMLElement) {
		document.body.appendChild(el);
		return { destroy: () => el.remove() };
	}
	const ghost = $derived(drag?.moved ? node(drag.ids[0]) : null);
</script>

<Tool {win}>
	{#snippet bar()}
		<div class="nav">
			<button type="button" class="up" disabled={!parent} onclick={() => parent && go(parent)} aria-label="Subir a la carpeta de arriba" title="Subir">‹</button>
			<nav class="crumbs" aria-label="Ruta">
				{#each crumbs as c, i (c.id)}
					{#if i}<span class="sep" aria-hidden="true">›</span>{/if}
					<button type="button" class="crumb" aria-current={c.id === folder ? 'page' : undefined} onclick={() => go(c.id)}>{c.name}</button>
				{/each}
			</nav>
		</div>
		<div class="acts">
			{#if ask}
				<span class="ask" role="alert">{ask.text}</span>
				<button type="button" class="danger" onclick={() => (ask!.run(), (ask = null))}>{ask.ok}</button>
				<button type="button" onclick={() => (ask = null)}>Cancelar</button>
			{:else if isBin}
				{#if selected.length}
					<button type="button" onclick={() => (restore(selected), (selected = []))}>Restaurar</button>
					<button type="button" onclick={() => askPurge([...selected])}>Eliminar para siempre</button>
				{/if}
				<button type="button" disabled={!items.length} onclick={askEmpty}>Vaciar papelera</button>
			{:else if exists && root !== TRASH}
				<button type="button" onclick={newFolder}>Nueva carpeta</button>
			{/if}
		</div>
	{/snippet}

	{#if !exists}
		<div class="empty">
			<p>Esta carpeta ya no está.</p>
			<button type="button" onclick={() => go(DESKTOP)}>Ir al Escritorio</button>
		</div>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="grid"
			class:drop={files.hover === folder && !drag}
			bind:this={grid}
			data-fs-drop={folder}
			role="group"
			aria-label={`Contenido de ${folderName(folder)}`}
			tabindex="0"
			onpointerdown={gridDown}
			oncontextmenu={contextmenu}
			onkeydown={gridKey}
		>
			{#each items as n (n.id)}
				<div
					class="item"
					class:sel={selected.includes(n.id)}
					class:drop={n.kind === 'folder' && files.hover === n.id}
					class:moving={drag?.moved && drag.ids.includes(n.id)}
					data-fs-item={n.id}
					data-fs-drop={n.kind === 'folder' ? n.id : undefined}
				>
					<button
						type="button"
						class="hit"
						aria-pressed={selected.includes(n.id)}
						title={n.trashed ? `Venía de ${folderName(n.trashed.from)}` : n.name}
						onpointerdown={(e) => itemDown(e, n.id)}
						onpointermove={itemMove}
						onpointerup={itemUp}
						onpointercancel={itemUp}
						ondblclick={() => open(n)}
						onclick={(e) => (e as unknown as PointerEvent).pointerType === 'touch' && open(n)}
						onkeydown={(e) => itemKey(e, n)}
					>
						<OsIcon id={iconFor(n)} size={48} />
						{#if editing !== n.id}<span class="name">{n.name}</span>{/if}
					</button>
					{#if editing === n.id}
						<input
							class="rename"
							aria-label="Nombre"
							maxlength="60"
							bind:value={draft}
							use:focusSelect
							onkeydown={renameKey}
							onblur={() => endRename(true)}
						/>
					{/if}
				</div>
			{:else}
				<p class="hint">{isBin ? 'La papelera está vacía.' : 'Carpeta vacía. Arrastra aquí iconos del escritorio.'}</p>
			{/each}
		</div>
	{/if}
</Tool>

{#if ghost && drag}
	<div class="ghost" use:portal style:left={`${drag.x}px`} style:top={`${drag.y}px`} aria-hidden="true">
		<OsIcon id={iconFor(ghost)} size={40} />
		{#if drag.ids.length > 1}<span class="count">{drag.ids.length}</span>{/if}
	</div>
{/if}

{#if menu}
	<ContextMenu x={menu.x} y={menu.y} items={menu.items} label={menu.label} onclose={() => (menu = null)} />
{/if}

<style>
	.nav {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		flex: 1 1 auto;
		min-width: 0;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6);
	}
	button {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		font-size: var(--fs-field);
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}
	button:disabled {
		color: var(--faint);
		cursor: default;
	}
	.up {
		width: var(--control-h);
		padding: 0;
	}
	.crumbs {
		display: flex;
		align-items: center;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
	}
	.crumb {
		height: auto;
		padding: var(--sp-2) var(--sp-4);
		border-color: transparent;
		background: none;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 16ch;
	}
	.crumb:hover {
		color: var(--fg);
		background: var(--amber-soft);
	}
	.crumb[aria-current='page'] {
		color: var(--fg);
	}
	.sep {
		color: var(--faint);
	}
	.ask {
		color: var(--muted);
		font-size: var(--fs-s);
	}
	.danger {
		border-color: var(--amber-edge);
		color: var(--amber);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
		align-content: start;
		gap: var(--sp-4);
		min-height: 100%;
		outline: none;
		border: var(--hair) solid transparent;
		border-radius: var(--radius-s);
	}
	.grid.drop {
		border-color: var(--amber-edge);
		background: var(--amber-soft);
	}
	.item {
		display: grid;
		justify-items: center;
		align-content: start;
		gap: var(--sp-4);
		padding: var(--sp-6) var(--sp-4);
		border: var(--hair) solid transparent;
		border-radius: var(--radius-s);
		min-width: 0;
	}
	.item:hover,
	.item.sel {
		background: var(--amber-soft);
	}
	.item.sel {
		border-color: var(--amber-edge);
	}
	.item.drop {
		background: var(--amber-soft);
		border-color: var(--amber);
	}
	.item.moving {
		opacity: 0.45;
	}
	.hit {
		display: grid;
		justify-items: center;
		gap: var(--sp-4);
		width: 100%;
		height: auto;
		padding: 0;
		border: 0;
		background: none;
		cursor: default;
		user-select: none;
		touch-action: none;
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-xs);
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
	.hint,
	.empty p {
		grid-column: 1 / -1;
		margin: var(--sp-24) 0 0;
		text-align: center;
		color: var(--muted);
	}
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--sp-12);
	}
	.ghost {
		position: fixed;
		z-index: var(--z-system);
		display: grid;
		place-items: center;
		transform: translate(-50%, -50%);
		opacity: 0.85;
		pointer-events: none;
	}
	.count {
		position: absolute;
		top: calc(-1 * var(--sp-4));
		right: calc(-1 * var(--sp-6));
		min-width: var(--sp-16);
		padding: 0 var(--sp-4);
		border-radius: var(--sp-8);
		background: var(--amber);
		color: var(--on-amber);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		text-align: center;
	}
</style>
