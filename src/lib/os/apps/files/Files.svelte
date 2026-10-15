<!--
	Archivos de Arc OS, como el Explorador de Windows o el Finder: a la izquierda los sitios (Inicio, Apps, Notas,
	Valores de MIS, Escritorios, Favoritos de la barra, Papelera) y a la derecha lo que hay, en iconos o en lista.
	Doble clic (o Intro) abre; F2 renombra; Supr manda a la papelera; arrastrar a una carpeta tuya la mueve (o crea
	un acceso directo, si viene de un sitio del sistema). En táctil, «Mover a…» hace lo mismo que arrastrar.
	Lo tuyo (carpetas, accesos, papelera) va en la cuenta: fs.ts y la clave arc-os-files.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Search from '../../../components/ui/Search.svelte';
	import Seg from '../../../components/ui/Seg.svelte';
	import { resolveInput, targetPath } from '../../../cmdline.ts';
	import { readFavs } from '../../../bar/favs.ts';
	import { hasWords, queryWords } from '../../../search.ts';
	import { initWatchlist, watchlist } from '../../../watchlist.svelte.ts';
	import { APPS, findApp, type AppProps } from '../../apps.ts';
	import { goDesk, openApp, openPath, os } from '../../os.svelte.ts';
	import Tool from '../kit/Tool.svelte';
	import { readJson, writeJson } from '../kit/store.ts';
	import { titleOf } from '../notes/notes.ts';
	import { deleteNote, notes, openNote, restoreNote, startNotes, trashNote } from '../notes/notes.svelte.ts';
	import * as fs from './fs.ts';

	let { win }: AppProps = $props();

	interface Item {
		key: string;
		name: string;
		icon: string;
		sub?: string;
		/** Carpeta a la que entra. */
		to?: string;
		/** Lo que abre (un archivo). */
		target?: fs.Target;
		/** Carpeta o acceso tuyo (se renombra, se mueve, se tira). */
		entry?: string;
		/** Nota (se tira a su papelera). */
		note?: string;
		trashed?: number;
		missing?: boolean;
	}

	let vfs = $state<fs.FsState>(fs.emptyFs());
	let cwd = $state<string>(fs.ROOT);
	let history = $state<string[]>([]);
	let view = $state<'icons' | 'list'>('icons');
	let query = $state('');
	let selected = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let draft = $state('');
	let favs = $state<string[]>([]);
	let note = $state('');

	function load() {
		vfs = fs.readFs(readJson<unknown>(fs.FILES_KEY, null, (v): v is unknown => true));
	}
	function save() {
		writeJson(fs.FILES_KEY, $state.snapshot(vfs));
	}
	onMount(() => {
		load();
		startNotes();
		initWatchlist();
		favs = readFavs();
		try {
			view = localStorage.getItem('arc-os-files-view') === 'list' ? 'list' : 'icons';
		} catch {}
		const onStorage = (e: StorageEvent) => e.key === fs.FILES_KEY && load();
		addEventListener('storage', onStorage);
		return () => removeEventListener('storage', onStorage);
	});
	$effect(() => {
		try {
			localStorage.setItem('arc-os-files-view', view);
		} catch {}
	});

	const PLACES = [
		[fs.ROOT, 'Inicio', '⌂'],
		['sys:apps', 'Apps', '▦'],
		['sys:notes', 'Notas', '✎'],
		['sys:mis', 'Valores', '☆'],
		['sys:desks', 'Escritorios', '▣'],
		['sys:favs', 'Favoritos', '★'],
		[fs.TRASH, 'Papelera', '🗑']
	] as const;
	const KIND_NAME = { vista: 'Vistas', exp: 'Experiencias', herramienta: 'Del sistema' } as const;

	/** Lo que abre cada destino: nombre, icono y si aún existe. */
	function describe(t: fs.Target): { name: string; icon: string; missing?: boolean; sub?: string } {
		const [kind, ...rest] = t.split(':');
		const id = rest.join(':');
		if (kind === 'app') {
			const a = findApp(id);
			return a ? { name: a.name, icon: a.icon, sub: a.code } : { name: id, icon: '?', missing: true };
		}
		if (kind === 'note') {
			const n = notes.list.find((x) => x.id === id);
			return n && !n.trashed ? { name: titleOf(n), icon: '✎', sub: 'Nota' } : { name: 'Nota borrada', icon: '✎', missing: true };
		}
		if (kind === 'tick') return { name: id, icon: '☆', sub: 'Valor' };
		if (kind === 'desk') {
			const d = os.state.desks.find((x) => x.id === id);
			return d ? { name: d.name, icon: '▣', sub: 'Escritorio' } : { name: 'Escritorio cerrado', icon: '▣', missing: true };
		}
		if (kind === 'fav') return { name: id, icon: '★', sub: 'Favorito' };
		return { name: t, icon: '?', missing: true };
	}

	function openTarget(t: fs.Target) {
		const [kind, ...rest] = t.split(':');
		const id = rest.join(':');
		if (kind === 'app') openApp(id);
		else if (kind === 'note') openNote(id);
		else if (kind === 'desk') goDesk(id);
		else if (kind === 'tick') openRoute(`/s?sym=${encodeURIComponent(id)}`);
		else if (kind === 'fav') {
			const target = resolveInput(id, []);
			if (target) {
				const { route, search } = targetPath(target);
				openRoute(route + search);
			}
		}
	}
	/** Una ruta de la web en una ventana; la ficha de un valor (/s) no es una app: va en la ventana de MIS. */
	const openRoute = (path: string) => openPath(path) ?? openApp('mis', path, true);

	const link = (l: fs.Link): Item => {
		const d = describe(l.target);
		return { key: `e:${l.id}`, name: l.name || d.name, icon: d.icon, sub: d.sub ?? 'Acceso directo', target: l.target, entry: l.id, trashed: l.trashed, missing: d.missing };
	};
	const folder = (f: fs.Folder): Item => ({ key: `e:${f.id}`, name: f.name, icon: '📁', to: f.id, entry: f.id, trashed: f.trashed, sub: 'Carpeta' });
	const sys = (to: string, name: string, icon: string, sub?: string): Item => ({ key: `s:${to}`, name, icon, to, sub });
	const file = (target: fs.Target): Item => ({ key: `t:${target}`, ...describe(target), target, note: target.startsWith('note:') ? target.slice(5) : undefined });

	function list(at: string): Item[] {
		if (at === fs.ROOT || vfs.folders.some((f) => f.id === at)) {
			const { folders, links } = fs.childrenOf(vfs, at);
			const head = at === fs.ROOT ? PLACES.slice(1, -1).map(([id, name, icon]) => sys(id, name, icon, 'Del sistema')) : [];
			return [...head, ...folders.map(folder), ...links.map(link)];
		}
		if (at === 'sys:apps') return (['vista', 'exp', 'herramienta'] as const).map((k) => sys(`sys:apps:${k}`, KIND_NAME[k], '📁', `${APPS.filter((a) => a.kind === k).length} apps`));
		if (at.startsWith('sys:apps:')) return APPS.filter((a) => a.kind === at.slice(9)).sort((a, b) => a.name.localeCompare(b.name, 'es')).map((a) => file(`app:${a.id}`));
		if (at === 'sys:notes') return notes.list.filter((n) => !n.trashed).map((n) => file(`note:${n.id}`));
		if (at === 'sys:mis') return watchlist.lists.map((l, i) => sys(`sys:mis:${i}`, l.name, '📁', `${l.codes.length} valores`));
		if (at.startsWith('sys:mis:')) return (watchlist.lists[Number(at.slice(8))]?.codes ?? []).map((c) => file(`tick:${c.split(':').pop()}`));
		if (at === 'sys:desks') return os.state.desks.map((d) => file(`desk:${d.id}`));
		if (at === 'sys:favs') return favs.map((f) => file(`fav:${f}`));
		if (at === fs.TRASH)
			return [
				...fs.trashed(vfs).map((e) => ('target' in e ? link(e) : folder(e))),
				...notes.list.filter((n) => n.trashed).map((n) => ({ ...file(`note:${n.id}`), name: titleOf(n), missing: false, trashed: n.trashed }))
			];
		return [];
	}

	const words = $derived(queryWords(query));
	const items = $derived(list(cwd).filter((i) => !words.length || hasWords(i.name, words)));
	const sel = $derived(items.find((i) => i.key === selected));
	const crumbs = $derived.by((): [string, string][] => {
		const place = PLACES.find(([id]) => id === cwd);
		if (place) return [[place[0], place[1]]];
		if (cwd.startsWith('sys:apps:')) return [['sys:apps', 'Apps'], [cwd, KIND_NAME[cwd.slice(9) as keyof typeof KIND_NAME]]];
		if (cwd.startsWith('sys:mis:')) return [['sys:mis', 'Valores'], [cwd, watchlist.lists[Number(cwd.slice(8))]?.name ?? '']];
		return [[fs.ROOT, 'Inicio'], ...fs.pathTo(vfs, cwd).map((f): [string, string] => [f.id, f.name])];
	});
	const mine = $derived(cwd === fs.ROOT || vfs.folders.some((f) => f.id === cwd && !f.trashed));
	const inTrash = $derived(cwd === fs.TRASH);
	/** Carpetas tuyas para «Mover a…» y «Acceso directo en…». */
	const targets = $derived([[fs.ROOT, 'Inicio'] as [string, string], ...vfs.folders.filter((f) => !f.trashed).map((f): [string, string] => [f.id, [...fs.pathTo(vfs, f.id).map((x) => x.name)].join(' › ')])]);

	function go(to: string, push = true) {
		if (push && to !== cwd) history = [...history, cwd].slice(-30);
		cwd = to;
		selected = null;
		renaming = null;
		query = '';
		note = '';
	}
	function back() {
		const prev = history.at(-1);
		if (prev === undefined) return;
		history = history.slice(0, -1);
		go(prev, false);
	}
	function up() {
		if (crumbs.length > 1) go(crumbs[crumbs.length - 2][0]);
		else if (cwd !== fs.ROOT) go(fs.ROOT);
	}

	function open(i: Item) {
		if (i.trashed) return;
		if (i.to) go(i.to);
		else if (i.target && !i.missing) openTarget(i.target);
	}

	async function newFolder() {
		if (!mine) return;
		const f = fs.addFolder(vfs, cwd);
		if (!f) return (note = `Como mucho ${fs.MAX_ENTRIES} carpetas y accesos.`);
		save();
		selected = `e:${f.id}`;
		await startRename(folder(f));
	}

	async function startRename(i: Item) {
		if (!i.entry || i.trashed) return;
		renaming = i.key;
		draft = i.name;
		await tick();
		const input = document.querySelector<HTMLInputElement>(`[data-win="${win}"] input.rename`);
		input?.focus();
		input?.select();
	}
	function endRename(i: Item, ok: boolean) {
		if (renaming !== i.key) return;
		if (ok && i.entry && fs.rename(vfs, i.entry, draft)) save();
		renaming = null;
	}

	function remove(i: Item) {
		if (i.trashed) {
			if (!confirm(`¿Borrar «${i.name}» del todo?`)) return;
			if (i.entry) fs.purge(vfs, i.entry);
			else if (i.note) deleteNote(i.note);
		} else if (i.entry) fs.trash(vfs, i.entry);
		else if (i.note) trashNote(i.note);
		else return (note = 'Esto es del sistema: no se puede tirar. Puedes crear accesos directos a ello.');
		save();
		selected = null;
	}
	function restoreItem(i: Item) {
		if (i.entry) fs.restore(vfs, i.entry);
		else if (i.note) restoreNote(i.note);
		save();
	}
	function emptyAll() {
		if (!confirm('¿Vaciar la papelera? No se puede deshacer.')) return;
		fs.emptyTrash(vfs);
		for (const n of notes.list.filter((x) => x.trashed)) deleteNote(n.id);
		save();
	}

	/** Llevar algo a una carpeta tuya: lo tuyo se mueve; lo del sistema deja un acceso directo. */
	function putIn(i: Item, dest: string) {
		if (dest === fs.TRASH) return remove(i);
		if (i.trashed) return;
		let ok = false;
		if (i.entry) ok = fs.move(vfs, i.entry, dest);
		else if (i.target) ok = !!fs.addLink(vfs, dest, i.target);
		else if (i.to?.startsWith('sys:')) return (note = 'Las carpetas del sistema no se mueven: entra y arrastra lo que quieras.');
		if (ok) {
			save();
			note = i.entry ? `Movido a «${targets.find(([id]) => id === dest)?.[1] ?? 'Inicio'}».` : 'Acceso directo creado.';
		}
	}

	// Arrastrar y soltar (HTML5): lo que se arrastra va en dataTransfer como su clave.
	let dragging = $state<Item | null>(null);
	let over = $state<string | null>(null);
	function dragStart(e: DragEvent, i: Item) {
		if (i.to?.startsWith('sys:') || i.trashed) return e.preventDefault();
		dragging = i;
		e.dataTransfer?.setData('text/plain', i.name);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = i.entry ? 'move' : 'link';
	}
	const canDrop = (dest: string) => !!dragging && (dest === fs.TRASH || dest === fs.ROOT || vfs.folders.some((f) => f.id === dest && !f.trashed)) && dragging.entry !== dest;
	function dragOver(e: DragEvent, dest: string) {
		if (!canDrop(dest)) return;
		e.preventDefault();
		over = dest;
	}
	function drop(e: DragEvent, dest: string) {
		e.preventDefault();
		if (dragging && canDrop(dest)) putIn(dragging, dest);
		dragging = null;
		over = null;
	}

	function key(e: KeyboardEvent) {
		if (renaming) return;
		const idx = items.findIndex((i) => i.key === selected);
		const step = { ArrowRight: 1, ArrowDown: view === 'list' ? 1 : 0, ArrowLeft: -1, ArrowUp: view === 'list' ? -1 : 0 }[e.key];
		if (step) {
			e.preventDefault();
			selected = items[Math.max(0, Math.min(items.length - 1, idx + step))]?.key ?? null;
		} else if (e.key === 'Enter' && sel) open(sel);
		else if (e.key === 'F2' && sel) (e.preventDefault(), startRename(sel));
		else if (e.key === 'Delete' && sel) remove(sel);
		else if (e.key === 'Backspace') (e.preventDefault(), up());
	}

	const VIEWS = [
		{ value: 'icons', label: 'Iconos' },
		{ value: 'list', label: 'Lista' }
	] as const;
	const when = (ms: number) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
</script>

<Tool {win}>
	{#snippet bar()}
		<button type="button" onclick={back} disabled={!history.length} aria-label="Atrás" title="Atrás">‹</button>
		<button type="button" onclick={up} disabled={cwd === fs.ROOT} aria-label="Subir" title="Subir (Retroceso)">↑</button>
		<nav class="crumbs" aria-label="Ruta">
			{#each crumbs as [id, name], i (id)}
				{#if i}<span class="mut">›</span>{/if}
				<button type="button" class="crumb" class:over={over === id} onclick={() => go(id)} ondragover={(e) => dragOver(e, id)} ondragleave={() => (over = null)} ondrop={(e) => drop(e, id)}>{name}</button>
			{/each}
		</nav>
		<span class="gap"></span>
		{#if mine}<button type="button" onclick={newFolder}>＋ Carpeta</button>{/if}
		<Seg label="Vista" options={VIEWS} bind:value={view} />
	{/snippet}
	<div class="wrap">
		<div class="files">
			<aside>
				{#each PLACES as [id, name, icon] (id)}
					<button
						type="button"
						aria-current={cwd === id || (id !== fs.ROOT && cwd.startsWith(id + ':')) || (id === fs.ROOT && vfs.folders.some((f) => f.id === cwd))}
						class:over={over === id}
						onclick={() => go(id)}
						ondragover={(e) => dragOver(e, id)}
						ondragleave={() => (over = null)}
						ondrop={(e) => drop(e, id)}><span aria-hidden="true">{icon}</span> {name}</button
					>
				{/each}
			</aside>
			<section>
				<div class="tools">
					<div class="q"><Search label="Buscar aquí" placeholder="Buscar aquí…" bind:value={query} /></div>
					{#if inTrash && items.length}<button type="button" onclick={emptyAll}>Vaciar la papelera</button>{/if}
				</div>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<ul class={view} role="listbox" aria-label="Contenido" tabindex="0" onkeydown={key} ondragover={(e) => mine && dragOver(e, cwd)} ondrop={(e) => mine && drop(e, cwd)}>
					{#each items as i (i.key)}
						<!-- svelte-ignore a11y_click_events_have_key_events (el teclado va en la lista: flechas, Intro, F2, Supr) -->
						<li
							role="option"
							aria-selected={selected === i.key}
							class:missing={i.missing}
							class:over={over === i.entry && !!i.to}
							draggable={!i.to?.startsWith('sys:') && !i.trashed}
							ondragstart={(e) => dragStart(e, i)}
							ondragend={() => ((dragging = null), (over = null))}
							ondragover={(e) => i.to && !i.to.startsWith('sys:') && (e.stopPropagation(), dragOver(e, i.to))}
							ondrop={(e) => i.to && !i.to.startsWith('sys:') && (e.stopPropagation(), drop(e, i.to))}
							onclick={() => (selected = i.key)}
							ondblclick={() => open(i)}
						>
							<span class="ic" aria-hidden="true">{i.icon}</span>
							{#if renaming === i.key}
								<!-- svelte-ignore a11y_autofocus -->
								<input class="rename" bind:value={draft} maxlength="60" aria-label="Nombre nuevo" onkeydown={(e) => (e.key === 'Enter' ? endRename(i, true) : e.key === 'Escape' && endRename(i, false))} onblur={() => endRename(i, true)} />
							{:else}
								<span class="nm">{i.name}</span>
							{/if}
							<span class="sub">{i.trashed ? `Tirado el ${when(i.trashed)}` : (i.sub ?? '')}</span>
						</li>
					{:else}
						<li class="empty">{query ? 'Nada con esas palabras.' : inTrash ? 'La papelera está vacía.' : mine ? 'Vacía. Crea una carpeta o arrastra aquí apps, notas o valores.' : 'Nada por aquí.'}</li>
					{/each}
				</ul>
				<footer>
					{#if sel}
						<b>{sel.name}</b>
						{#if sel.trashed}
							<button type="button" onclick={() => restoreItem(sel)}>Restaurar</button>
							<button type="button" onclick={() => remove(sel)}>Borrar del todo</button>
						{:else}
							<button type="button" onclick={() => open(sel)} disabled={sel.missing}>Abrir</button>
							{#if sel.entry}<button type="button" onclick={() => startRename(sel)}>Renombrar</button>{/if}
							{#if !sel.to?.startsWith('sys:')}
								<label class="move"
									>{sel.entry ? 'Mover a' : 'Acceso en'}
									<select onchange={(e) => (putIn(sel, e.currentTarget.value), (e.currentTarget.value = ''))}>
										<option value="">…</option>
										{#each targets as [id, name] (id)}<option value={id}>{name}</option>{/each}
									</select></label
								>
							{/if}
							{#if sel.entry || sel.note}<button type="button" onclick={() => remove(sel)}>A la papelera</button>{/if}
						{/if}
					{:else}
						<span class="mut">{note || `${items.length} elementos · doble clic abre · F2 renombra · Supr tira`}</span>
					{/if}
				</footer>
			</section>
		</div>
	</div>
</Tool>

<style>
	button,
	select {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.crumbs {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		min-width: 0;
		overflow: hidden;
	}

	.crumb {
		background: none;
		border-color: transparent;
		white-space: nowrap;
	}

	.gap {
		flex: 1;
	}

	.wrap {
		container-type: inline-size;
		height: 100%;
	}

	.files {
		display: grid;
		grid-template-columns: 170px 1fr;
		gap: var(--sp-12);
		height: 100%;
		min-height: 0;
	}

	aside {
		display: grid;
		align-content: start;
		gap: var(--sp-2);
		border-right: var(--border);
		padding-right: var(--sp-8);
	}

	aside button {
		text-align: left;
		background: none;
		border-color: transparent;
	}

	aside [aria-current='true'] {
		background: var(--amber-soft);
		color: var(--amber);
	}

	.over {
		outline: var(--hair) dashed var(--amber);
		background: var(--amber-soft);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
		min-height: 0;
		min-width: 0;
	}

	.tools {
		display: flex;
		gap: var(--sp-8);
	}

	.q {
		flex: 1;
	}

	ul {
		flex: 1;
		margin: 0;
		padding: var(--sp-4);
		list-style: none;
		overflow: auto;
		outline: none;
		border: var(--border);
		border-radius: var(--radius-s);
		background: var(--bg);
		align-content: start;
	}

	ul:focus-visible {
		border-color: var(--amber-dim);
	}

	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: var(--sp-4);
	}

	li {
		border-radius: var(--radius-s);
		cursor: default;
		user-select: none;
	}

	.icons li {
		display: grid;
		justify-items: center;
		align-content: start;
		gap: var(--sp-2);
		padding: var(--sp-8) var(--sp-4);
		text-align: center;
	}

	.icons .ic {
		font-size: var(--fs-big);
		line-height: 1;
		color: var(--amber);
	}

	.icons .nm {
		overflow-wrap: anywhere;
		font-family: var(--sans);
	}

	.icons .sub {
		display: none;
	}

	.list li {
		display: grid;
		grid-template-columns: 1.5em 1fr auto;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--row-y) var(--sp-8);
		border-bottom: var(--border);
	}

	.list .ic {
		color: var(--amber);
		text-align: center;
	}

	.sub {
		color: var(--muted);
		font-size: var(--fs-s);
	}

	li[aria-selected='true'] {
		background: var(--amber-soft);
	}

	.missing {
		opacity: 0.5;
	}

	.empty {
		grid-column: 1 / -1;
		padding: var(--sp-12);
		color: var(--muted);
		font-family: var(--sans);
	}

	.rename {
		width: 100%;
		height: var(--control-h);
		font: inherit;
		font-size: var(--fs-field);
		text-align: center;
		color: var(--fg);
		background: var(--panel);
		border: var(--hair) solid var(--amber-dim);
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6);
		min-height: var(--control-h);
		font-size: var(--fs-s);
	}

	footer b {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: var(--fw-medium);
	}

	.move {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		color: var(--muted);
	}

	.mut {
		color: var(--muted);
	}

	@container (max-width: 560px) {
		.files {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		aside {
			display: flex;
			overflow-x: auto;
			border-right: 0;
			border-bottom: var(--border);
			padding: 0 0 var(--sp-6);
		}

		aside button {
			flex: none;
			white-space: nowrap;
		}
	}
</style>
