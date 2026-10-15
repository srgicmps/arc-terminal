<!-- «Apariencia»: el único botón de aspecto de la cabecera. Abre una hoja (un <dialog> nativo: Esc cierra y el foco
	se queda dentro, como un modal de Vue con teleport, pero sin librerías) con la galería de estéticas, el tema
	(automático, día o noche), el acento y la densidad. Lo demás de «A tu gusto» sigue en HELP. -->
<script lang="ts">
	import StylePicker from '#lib/components/StylePicker.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { takesAccent } from '#lib/estilos.ts';
	import { ACCENTS, DENSITIES, setAccent, setDensity, taste } from '#lib/taste.svelte.ts';
	import { setTheme, theme, type ThemeMode } from '#lib/theme.svelte.ts';
	import { resolve } from '$app/paths';

	const THEMES: { value: ThemeMode; label: string }[] = [
		{ value: 'auto', label: 'Automático' },
		{ value: 'light', label: 'Día' },
		{ value: 'dark', label: 'Noche' }
	];

	let dialog = $state<HTMLDialogElement>();
	// La galería (y las hojas de todas las estéticas) solo se monta al abrir: no pesa si no se usa.
	let open = $state(false);

	function show() {
		open = true;
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	// Tocar fuera de la hoja (en el fondo atenuado) también cierra.
	function onBackdrop(e: MouseEvent) {
		if (e.target === dialog) close();
	}
</script>

<button class="trigger" data-ui="appearance" type="button" onclick={show} title="Apariencia: estética, tema, acento y densidad" aria-label="Apariencia" aria-haspopup="dialog">
	<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 0 1 0 12z" /></svg>
</button>

<dialog bind:this={dialog} class="sheet" aria-labelledby="appearance-title" onclose={() => (open = false)} onclick={onBackdrop}>
	<div class="in">
		<header>
			<h2 id="appearance-title">Apariencia</h2>
			<button class="close" type="button" onclick={close} aria-label="Cerrar">✕</button>
		</header>
		<dl>
			<dt>Tema</dt>
			<dd><Seg label="Tema" options={THEMES} bind:value={() => theme.mode, setTheme} /></dd>
			<dt>Acento</dt>
			<dd>
				{#if takesAccent(taste.style)}
					<Seg label="Color de acento" options={ACCENTS} bind:value={() => taste.accent, setAccent} />
				{:else}
					<span class="note">Esta estética lleva su propio color.</span>
				{/if}
			</dd>
			<dt>Densidad</dt>
			<dd><Seg label="Densidad" options={DENSITIES} bind:value={() => taste.density, setDensity} /></dd>
		</dl>
		<h3>Estética</h3>
		{#if open}<StylePicker />{/if}
		<p class="more">Modo, secciones de la barra y vista de inicio: <a href={resolve('/help')} onclick={close}>HELP, «A tu gusto»</a>.</p>
	</div>
</dialog>

<style>
	.trigger {
		display: grid;
		place-items: center;
		width: var(--btn-sm);
		height: var(--btn-sm);
		padding: 0;
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		color: var(--muted);
		cursor: pointer;
		transition: color var(--dur-ui) var(--ease), border-color var(--dur-ui) var(--ease);
	}

	.trigger:hover {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	.trigger svg {
		width: var(--sp-14);
		height: var(--sp-14);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}

	.trigger path {
		fill: currentColor;
		stroke: none;
	}

	/* En pantallas táctiles se ve igual, pero la zona pulsable llega a 44 × 44 px. */
	@media (pointer: coarse) {
		.trigger {
			position: relative;
		}

		.trigger::after {
			content: '';
			position: absolute;
			inset: calc(-1 * var(--sp-8));
		}
	}

	/* La hoja: a la derecha en escritorio, desde abajo en el móvil. */
	.sheet {
		margin: 0 0 0 auto;
		width: min(560px, 100vw);
		max-width: 100vw;
		height: 100dvh;
		max-height: 100dvh;
		padding: 0;
		background: var(--panel);
		color: var(--fg);
		border: 0;
		border-left: var(--border);
		box-shadow: var(--shadow-pop);
	}

	.sheet::backdrop {
		background: var(--scrim);
	}

	@media (max-width: 720px) {
		.sheet {
			margin: auto 0 0;
			width: 100vw;
			height: auto;
			max-height: 88dvh;
			border-left: 0;
			border-top: var(--border);
			border-radius: var(--radius) var(--radius) 0 0;
		}
	}

	.in {
		padding: var(--sp-12) var(--sp-16) var(--sp-24);
		font-family: var(--font-ui);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--sp-12);
	}

	h2,
	h3 {
		margin: 0;
		font-family: var(--title-font);
		font-weight: var(--fw-bold);
		color: var(--title-color);
	}

	h2 {
		font-size: var(--fs-l);
	}

	h3 {
		margin: var(--sp-16) 0 var(--sp-8);
		font-size: var(--fs-m);
	}

	.close {
		min-width: var(--control-h);
		min-height: var(--control-h);
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		color: var(--muted);
		cursor: pointer;
	}

	dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--sp-10) var(--sp-14);
		align-items: center;
		margin: 0;
	}

	dt {
		color: var(--muted);
		font-size: var(--fs-s);
	}

	dd {
		margin: 0;
	}

	.note,
	.more {
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.more {
		margin: var(--sp-16) 0 0;
	}

	.more a {
		color: var(--amber);
	}

	@media (prefers-reduced-motion: no-preference) {
		.sheet[open] {
			animation: enter var(--dur-fast) var(--ease);
		}

		@keyframes enter {
			from {
				opacity: 0;
			}
		}
	}
</style>
