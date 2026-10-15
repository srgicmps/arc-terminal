<!--
	Visor de Arc OS: imágenes y PDF de tu dispositivo. Se eligen o se arrastran; no se suben a ningún sitio ni se
	guardan (se leen con URL.createObjectURL, solo en esta ventana). Imágenes con zoom y giro; el PDF, con el visor
	del propio navegador. Con varias, ← → pasan de una a otra.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { AppProps } from '../../apps.ts';
	import Tool from '../kit/Tool.svelte';

	let { win }: AppProps = $props();

	interface Doc {
		name: string;
		url: string;
		pdf: boolean;
		size: number;
	}
	let docs = $state<Doc[]>([]);
	let at = $state(0);
	let zoom = $state(0); // 0: encajar
	let turn = $state(0);
	let over = $state(false);
	let note = $state('');
	let input = $state<HTMLInputElement>();

	const doc = $derived(docs[at]);
	const MAX = 40;

	function add(files: FileList | null | undefined) {
		const ok = [...(files ?? [])].filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
		note = files?.length && !ok.length ? 'Solo imágenes y PDF.' : '';
		if (!ok.length) return;
		const fresh = ok.slice(0, MAX).map((f) => ({ name: f.name, url: URL.createObjectURL(f), pdf: f.type === 'application/pdf', size: f.size }));
		at = docs.length;
		docs = [...docs, ...fresh];
		reset();
	}
	function reset() {
		zoom = 0;
		turn = 0;
	}
	function go(d: number) {
		if (!docs.length) return;
		at = (at + d + docs.length) % docs.length;
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

	function key(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
		else if (e.key === '+' || e.key === '=') zoom = Math.min(8, (zoom || 1) * 1.25);
		else if (e.key === '-') zoom = Math.max(0.1, (zoom || 1) / 1.25);
		else if (e.key === '0') zoom = 0;
		else if (e.key.toLowerCase() === 'r') turn = (turn + 90) % 360;
		else return;
		e.preventDefault();
	}
	const mb = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1024)} KB`);
</script>

<Tool {win}>
	{#snippet bar()}
		<button type="button" onclick={() => input?.click()}>Abrir…</button>
		<input bind:this={input} type="file" accept="image/*,application/pdf" multiple hidden onchange={(e) => add(e.currentTarget.files)} />
		{#if doc}
			{#if docs.length > 1}
				<button type="button" onclick={() => go(-1)} aria-label="Anterior">‹</button>
				<span class="mut">{at + 1} / {docs.length}</span>
				<button type="button" onclick={() => go(1)} aria-label="Siguiente">›</button>
			{/if}
			<span class="name" title={doc.name}>{doc.name} <span class="mut">· {mb(doc.size)}</span></span>
			<span class="gap"></span>
			{#if !doc.pdf}
				<button type="button" onclick={() => (zoom = Math.max(0.1, (zoom || 1) / 1.25))} aria-label="Alejar">−</button>
				<button type="button" onclick={() => (zoom = zoom ? 0 : 1)} title="Encajar o tamaño real">{zoom ? `${Math.round(zoom * 100)} %` : 'Encajar'}</button>
				<button type="button" onclick={() => (zoom = Math.min(8, (zoom || 1) * 1.25))} aria-label="Acercar">+</button>
				<button type="button" onclick={() => (turn = (turn + 90) % 360)} aria-label="Girar" title="Girar (R)">↻</button>
			{/if}
			<button type="button" onclick={closeDoc} aria-label="Cerrar este archivo">×</button>
		{/if}
	{/snippet}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="stage"
		class:over
		role="region"
		aria-label="Visor"
		tabindex="0"
		onkeydown={key}
		ondragover={(e) => (e.preventDefault(), (over = true))}
		ondragleave={() => (over = false)}
		ondrop={(e) => (e.preventDefault(), (over = false), add(e.dataTransfer?.files))}
	>
		{#if !doc}
			<div class="empty">
				<p>Arrastra aquí imágenes o PDF, o pulsa «Abrir…».</p>
				<p class="mut">Se quedan en tu dispositivo: no se suben ni se guardan.{note ? ` ${note}` : ''}</p>
			</div>
		{:else if doc.pdf}
			<iframe src={doc.url} title={doc.name}></iframe>
		{:else}
			<div class="img" class:fit={!zoom}>
				<img src={doc.url} alt={doc.name} style:transform="rotate({turn}deg) scale({zoom || 1})" />
			</div>
		{/if}
	</div>
</Tool>

<style>
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

	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gap {
		flex: 1;
	}

	.mut {
		color: var(--muted);
	}

	.stage {
		height: 100%;
		min-height: 0;
		outline: none;
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
		overflow: hidden;
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

	iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.img {
		width: 100%;
		height: 100%;
		overflow: auto;
		display: grid;
		place-items: center;
	}

	img {
		transition: transform var(--dur-fast);
	}

	.fit img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
</style>
