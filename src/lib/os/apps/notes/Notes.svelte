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
	import { MAX_NOTES, plainText, snippetOf, titleOf, whenText } from './notes.ts';
	import { deleteNote, newNote, notes, pinNote, restoreNote, sanitize, startNotes, trashNote, updateNote } from './notes.svelte.ts';

	let { win }: AppProps = $props();

	let query = $state('');
	let trash = $state(false);
	let current = $state<string | null>(null);
	let editor = $state<HTMLDivElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		startNotes();
		// Intro crea párrafos <p> (no <div>), como en un editor de textos.
		document.execCommand('defaultParagraphSeparator', false, 'p');
		const first = notes.list.find((n) => !n.trashed);
		if (first && !notes.pending && matchMedia('(min-width: 640px)').matches) void open(first.id);
		return () => flush();
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
	const live = $derived(notes.list.filter((n) => !n.trashed).length);

	async function open(id: string) {
		flush();
		current = id;
		await tick();
		if (editor) editor.innerHTML = sanitize(notes.list.find((n) => n.id === id)?.html ?? '');
	}

	async function create() {
		trash = false;
		query = '';
		const n = newNote();
		if (!n) return;
		await open(n.id);
		editor?.focus();
	}

	function flush() {
		clearTimeout(timer);
		if (current && editor) updateNote(current, sanitize(editor.innerHTML));
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
		if (note.trashed) deleteNote(note.id);
		else trashNote(note.id);
		current = null;
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

<Tool {win}>
	<div class="wrap"><div class="notes" class:editing={current !== null}>
		<aside>
			<div class="top">
				<button type="button" class="new" onclick={create} disabled={live >= MAX_NOTES} title={live >= MAX_NOTES ? `Como mucho ${MAX_NOTES} notas` : 'Nota nueva'}>＋ Nueva</button>
				<button type="button" aria-pressed={trash} onclick={() => ((trash = !trash), (current = null))}>Papelera</button>
			</div>
			<div><Search label="Buscar en las notas" placeholder="Buscar…" bind:value={query} /></div>
			{#if trash && shown.length}<button type="button" class="link" onclick={emptyTrash}>Vaciar la papelera</button>{/if}
			<ul>
				{#each shown as n (n.id)}
					<li>
						<button type="button" aria-current={n.id === current} onclick={() => open(n.id)}>
							<b>{n.pinned ? '📌 ' : ''}{titleOf(n)}</b>
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
					<button type="button" class="back" onclick={() => (flush(), (current = null))} aria-label="Volver a la lista">‹ Notas</button>
					{#if note.trashed}
						<button type="button" onclick={() => restoreNote(note.id)}>Restaurar</button>
						<button type="button" onclick={remove}>Borrar del todo</button>
					{:else}
						{#each TOOLS as [label, title, run] (label)}
							<button type="button" {title} aria-label={title} onmousedown={(e) => e.preventDefault()} onclick={run}>{label}</button>
						{/each}
						<span class="gap"></span>
						<button type="button" aria-pressed={!!note.pinned} onclick={() => pinNote(note.id)} title="Fijar arriba">📌</button>
						<button type="button" onclick={remove} title="A la papelera" aria-label="A la papelera">🗑</button>
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

	.back {
		display: none;
	}

	.editor {
		flex: 1;
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
</style>
