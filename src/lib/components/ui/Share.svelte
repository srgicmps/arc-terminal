<!--
	Botón «Compartir» de la cabecera de un panel. Con el menú del sistema (móvil) comparte; si no lo hay,
	copia título, texto y enlace al portapapeles y avisa «Copiado» durante 2 s. Todo pasa al pulsar:
	al construir la web (prerender) solo se genera el botón.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { absoluteUrl, legacyCopy, shareOrCopy, type ShareSource } from '#lib/share.ts';

	let { source }: { source: ShareSource } = $props();

	let notice = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function onclick() {
		const info = typeof source === 'function' ? source() : source;
		const url = absoluteUrl(info.url, location.href);
		const result = await shareOrCopy({ ...info, url }, navigator, (text) => legacyCopy(text, document));
		if (result !== 'copied' && result !== 'failed') return;
		notice = result === 'copied' ? 'Copiado' : 'No se ha podido copiar';
		clearTimeout(timer);
		timer = setTimeout(() => (notice = ''), 2000);
	}

	onDestroy(() => clearTimeout(timer));
</script>

<button class="share" type="button" {onclick} aria-label="Compartir">
	<svg viewBox="0 0 16 16" aria-hidden="true">
		<path d="M8 10V2M5 5l3-3 3 3M3 8v6h10V8" />
	</svg>
	<span class:done={notice} aria-hidden="true">{notice || 'Compartir'}</span>
</button>
<!-- .sr (app.css): solo lo oyen los lectores de pantalla. -->
<span class="sr" role="status">{notice}</span>

<style>
	/* Igual que el enlace «CÓDIGO ›» de la cabecera del panel. */
	.share {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-4);
		background: none;
		border: 0;
		padding: 0;
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
		cursor: pointer;
	}

	.share:hover {
		color: var(--amber);
	}

	svg {
		width: 1em;
		height: 1em;
		fill: none;
		stroke: currentColor;
		stroke-width: var(--hair);
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.done {
		color: var(--amber);
	}

	/* En pantallas táctiles, 44 px de alto pulsable sin que crezca la cabecera (como .jump). */
	@media (pointer: coarse) {
		.share {
			min-height: var(--touch);
			padding-inline: var(--pad-x);
			margin: calc(-1 * var(--sp-14)) calc(-1 * var(--pad-x));
		}
	}
</style>
