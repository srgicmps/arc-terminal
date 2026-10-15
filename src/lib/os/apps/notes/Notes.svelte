<!--
	Notas de Arc OS: lista a la izquierda (buscar, fijar, papelera) y el editor a la derecha, con formato básico
	(negrita, cursiva, subrayado, título, listas, cita y enlace). En una ventana estrecha o en el móvil se ve una
	cosa cada vez, como en Notas del teléfono. Se guardan solas en la cuenta.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Search from '../../../components/ui/Search.svelte';
	import { hasWords, queryWords } from '../../../search.ts';
	import type { AppProps } from '../../apps.ts';
	import Tool from '../kit/Tool.svelte';
	import { isBlank, makeRoom, MAX_NOTES, plainText, snippetOf, titleOf, whenText } from './notes.ts';
	import { deleteNote, newNote, notes, pinNote, restoreNote, sanitize, startNotes, trashNote, updateNote } from './notes.svelte.ts';

	let { win }: AppProps = $props();

	let query = $state('');
	let trash = $state(false);
	let current = $state<string | null>(null);
	let editor = $state<HTMLDivElement>();
	let wrap: HTMLDivElement;
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		startNotes();
		// Intro crea párrafos <p> (no <div>), como en un editor de textos.
		document.execCommand('defaultParagraphSeparator', false, 'p');
		const first = notes.list.find((n) => !n.trashed);
		// Lista y nota a la vez solo si la ventana es ancha (el mismo corte que el @container de abajo), no la pantalla.
		if (first && !notes.pending && wrap.clientWidth > NARROW) void open(first.id);
		return () => leave();
	});

	// Archivos ha pedido abrir una nota.
	$effect(() => {
		const id = notes.pending;
		if (!id) return;
		notes.pending = null;
		trash = !!notes.list.find((n) => n.id === id)?.trashed;
		query = '';
		void open(id);
	});

	const words = $derived(queryWords(query));
	const shown = $derived(notes.list.filter((n) => !!n.trashed === trash && (!words.length || hasWords(plainText(n.html), words))));
	const note = $derived(notes.list.find((n) => n.id === current));
	const room = $derived(makeRoom(notes.list, MAX_NOTES).ok);
	/** Ancho (px) por debajo del cual se ve una cosa cada vez: el mismo del @container. */
	const NARROW = 560;

	async function open(id: string) {
		if (id !== current) leave();
		current = id;
		await tick();
		const html = sanitize(notes.list.find((n) => n.id === id)?.html ?? '');
		// Vacía, con un párrafo: así la primera línea también va en <p>, como las demás.
		if (editor) editor.innerHTML = isBlank(html) ? '<p><br></p>' : html;
	}

	async function create() {
		trash = false;
		query = '';
		leave();
		const n = newNote();
		if (!n) return;
		await open(n.id);
		editor?.focus();
	}

	function flush() {
		clearTimeout(timer);
		if (current && editor) updateNote(current, sanitize(editor.innerHTML));
	}

	/** Al dejar una nota: se guarda y, si se ha quedado sin nada escrito, se borra (no quedan «Nota nueva» vacías). */
	function leave() {
		flush();
		const n = notes.list.find((x) => x.id === current);
		if (n && !n.trashed && isBlank(n.html)) deleteNote(n.id);
		current = null;
	}

	const changed = () => {
		clearTimeout(timer);
		timer = setTimeout(flush, 500);
	};

	function cmd(name: string, value?: string) {
		editor?.focus();
		document.execCommand(name, false, value);
		changed();
	}

	function link() {
		const url = prompt('Dirección del enlace (https://…)');
		if (url && /^https?:\/\//i.test(url)) cmd('createLink', url);
	}

	/** Lo pegado entra limpio: sin estilos, scripts ni etiquetas raras. */
	function paste(e: ClipboardEvent) {
		const html = e.clipboardData?.getData('text/html');
		if (!html) return;
		e.preventDefault();
		document.execCommand('insertHTML', false, sanitize(html));
		changed();
	}

	function keys(e: KeyboardEvent) {
		if (!(e.ctrlKey || e.metaKey)) return;
		const k = e.key.toLowerCase();
		if (k === 'k') (e.preventDefault(), link());
	}

	function remove() {
		if (!note) return;
		flush();
		if (note.trashed || isBlank(note.html)) deleteNote(note.id);
		else trashNote(note.id);
		current = null;
	}

	/** Restaurada, vuelve a la lista de notas y sigue abierta para escribir. */
	function restore() {
		if (!note) return;
		restoreNote(note.id);
		trash = false;
		query = '';
	}

	function toggleTrash() {
		leave();
		trash = !trash;
	}

	function emptyTrash() {
		if (!confirm('¿Borrar del todo las notas de la papelera?')) return;
		for (const n of notes.list.filter((x) => x.trashed)) deleteNote(n.id);
		current = null;
	}

	const TOOLS: [string, string, () => void][] = [
		['B', 'Negrita (Ctrl+B)', () => cmd('bold')],
		['I', 'Cursiva (Ctrl+I)', () => cmd('italic')],
		['U', 'Subrayado (Ctrl+U)', () => cmd('underline')],
		['S', 'Tachado', () => cmd('strikeThrough')],
		['H', 'Título', () => cmd('formatBlock', 'h3')],
		['¶', 'Texto normal', () => cmd('formatBlock', 'p')],
		['•', 'Lista', () => cmd('insertUnorderedList')],
		['1.', 'Lista numerada', () => cmd('insertOrderedList')],
		['❝', 'Cita', () => cmd('formatBlock', 'blockquote')],
		['↗', 'Enlace (Ctrl+K)', link],
		['⌫', 'Quitar el formato', () => cmd('removeFormat')]
	];
</script>

<!-- Iconos de trazo fino (currentColor), en lugar de emojis: siguen el color del tema. -->
{#snippet pin()}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.5h4M6.8 2.5 6.2 7 4.5 9h7L9.8 7l-.6-4.5M8 9v4.5" /></svg>{/snippet}

<Tool {win}>
	<div class="wrap" bind:this={wrap}><div class="notes" class:editing={current !== null}>
		<aside>
			<div class="top">
				<button type="button" class="new" onclick={create} disabled={!room} title={room ? 'Nota nueva' : `Como mucho ${MAX_NOTES} notas: borra alguna para hacer sitio`}>＋ Nueva</button>
				<button type="button" aria-pressed={trash} onclick={toggleTrash}>Papelera</button>
			</div>
			<div><Search label="Buscar en las notas" placeholder="Buscar…" bind:value={query} /></div>
			{#if trash && shown.length}<button type="button" class="link" onclick={emptyTrash}>Vaciar la papelera</button>{/if}
			<ul>
				{#each shown as n (n.id)}
					<li>
						<button type="button" aria-current={n.id === current} onclick={() => open(n.id)}>
							<b>{#if n.pinned}{@render pin()}<span class="sr">Fijada: </span>{/if}{titleOf(n)}</b>
							<span><span class="when">{whenText(n.updated)}</span> {snippetOf(n)}</span>
						</button>
					</li>
				{:else}
					<li class="empty">{trash ? 'La papelera está vacía.' : query ? 'Nada con esas palabras.' : 'Sin notas. Pulsa «Nueva».'}</li>
				{/each}
			</ul>
		</aside>
		<section>
			{#if note}
				<div class="tools" role="toolbar" aria-label="Formato">
					<button type="button" class="back" onclick={leave} aria-label="Volver a la lista">‹ Notas</button>
					{#if note.trashed}
						<button type="button" onclick={restore}>Restaurar</button>
						<button type="button" onclick={remove}>Borrar del todo</button>
					{:else}
						{#each TOOLS as [label, title, run] (label)}
							<button type="button" {title} aria-label={title} onmousedown={(e) => e.preventDefault()} onclick={run}>{label}</button>
						{/each}
						<span class="gap"></span>
						<button type="button" aria-pressed={!!note.pinned} onclick={() => pinNote(note.id)} title="Fijar arriba" aria-label="Fijar arriba">{@render pin()}</button>
						<button type="button" onclick={remove} title="A la papelera" aria-label="A la papelera">
							<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v4M9 7v4" /></svg>
						</button>
					{/if}
				</div>
				<div
					class="editor"
					bind:this={editor}
					contenteditable={!note.trashed}
					role="textbox"
					aria-multiline="true"
					aria-label="Texto de la nota"
					tabindex="0"
					oninput={changed}
					onblur={flush}
					onpaste={paste}
					onkeydown={keys}
				></div>
				<p class="meta">Editada {whenText(note.updated)} · se guarda sola en tu cuenta</p>
			{:else}
				<p class="empty pick">Elige una nota o crea una nueva.</p>
			{/if}
		</section>
	</div></div>
</Tool>

<style>
	/* El contenedor de la consulta @container es el de fuera: un elemento no puede consultarse a sí mismo. */
	.wrap {
		container-type: inline-size;
		height: 100%;
		min-height: 0;
	}

	.notes {
		display: grid;
		grid-template-columns: minmax(200px, 32%) 1fr;
		gap: var(--sp-12);
		height: 100%;
		min-height: 0;
	}

	aside,
	section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
		min-height: 0;
		min-width: 0;
	}

	aside {
		border-right: var(--border);
		padding-right: var(--sp-12);
	}

	.top {
		display: flex;
		gap: var(--sp-6);
	}

	button {
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
		opacity: 0.5;
		cursor: default;
	}

	.new {
		flex: 1;
		color: var(--amber);
	}

	[aria-pressed='true'] {
		color: var(--amber);
		border-color: var(--amber-dim);
		background: var(--amber-soft);
	}

	ul {
		flex: 1;
		margin: 0;
		padding: 0;
		list-style: none;
		overflow: auto;
	}

	li button {
		display: grid;
		gap: var(--sp-2);
		width: 100%;
		height: auto;
		padding: var(--sp-6) var(--sp-8);
		text-align: left;
		background: none;
		border: 0;
		border-bottom: var(--border);
		border-radius: 0;
	}

	li button[aria-current='true'] {
		background: var(--amber-soft);
	}

	li b {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--sans);
		font-weight: var(--fw-medium);
		font-size: var(--fs-l);
	}

	li span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.when {
		color: var(--fg);
	}

	.empty {
		padding: var(--sp-8);
		color: var(--muted);
		font-family: var(--sans);
	}

	.pick {
		margin: auto;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.tools button {
		min-width: var(--control-h);
		padding: 0 var(--sp-6);
	}

	.gap {
		flex: 1;
	}

	svg {
		width: var(--fs-l);
		height: var(--fs-l);
		vertical-align: middle;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	li b svg {
		margin-right: var(--sp-4);
		color: var(--amber);
	}

	.back {
		display: none;
	}

	.editor {
		flex: 1;
		/* En una ventana muy baja no se aplasta: hace scroll la ventana. */
		min-height: calc(var(--control-h) * 4);
		overflow: auto;
		padding: var(--sp-12);
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh);
		outline: none;
	}

	.editor:focus {
		border-color: var(--amber-dim);
	}

	.editor :global(h3) {
		margin: 0 0 var(--sp-8);
		font-size: var(--fs-xl);
	}

	.editor :global(p) {
		margin: 0 0 var(--sp-6);
	}

	.editor :global(blockquote) {
		margin: var(--sp-6) 0;
		padding-left: var(--sp-12);
		border-left: var(--sp-2) solid var(--amber-dim);
		color: var(--muted);
	}

	.editor :global(a) {
		color: var(--amber);
	}

	.meta {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.link {
		align-self: start;
		height: auto;
		padding: 0;
		border: 0;
		background: none;
		color: var(--amber);
		text-decoration: underline;
	}

	/* Estrecho (móvil o ventana pequeña): lista o nota, una cosa cada vez. */
	@container (max-width: 560px) {
		.notes {
			grid-template-columns: 1fr;
		}

		aside {
			border-right: 0;
			padding-right: 0;
		}

		.editing aside,
		.notes:not(.editing) section {
			display: none;
		}

		.back {
			display: inline-block;
		}
	}
	/* iPhone e iPad: con menos de 16 px, Safari amplía la página al escribir (--fs-field vale 16 px en táctil). */
	@media (pointer: coarse) {
		.editor {
			font-size: var(--fs-field);
		}
	}
</style>
