<!--
	Panel de la maqueta: cabecera ámbar con título, dato a la derecha y enlace opcional a otra vista.
	El título es un botón: al pulsarlo (o con M cuando tiene el foco), el panel se maximiza sobre la vista
	con el fondo atenuado. Se maximiza el mismo <section>, sin volver a montar el contenido (TradingView,
	estados…). Esc, ✕ o tocar fuera lo cierran, y el foco vuelve al título.
	Dentro de una <ModularGrid>, si tiene id, la cabecera lleva además el asa ⋮⋮ y el ✕.
	Con `pin` lleva el 📌 para fijarlo en TOP (registro en pins.ts); en TOP, el 📌 abre el ancho y «Quitar».
	Si la URL lleva «#panel=Su título» (M47: «ECO TIPOS» en la barra), se despliega, se desplaza a la vista y
	se resalta un momento.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { foldKey, isFolded, toggleFold } from '#lib/folded.svelte.ts';
	import { tv } from '#lib/tv.svelte.ts';
	import { isShortcut } from '#lib/shortcuts.ts';
	import { untrack, type Snippet } from 'svelte';
	import { getModular, type Span } from '#lib/layout.svelte.ts';
	import { inPinArea, isPinned, pinSpan, setPinnedSpan, togglePinned } from '#lib/pins.svelte.ts';
	import { getPanelIndex } from '#lib/panelindex.svelte.ts';
	import { hashPanel, samePanel } from '#lib/panelhash.ts';
	import type { ShareSource } from '#lib/share.ts';
	import { hiddenPanels, isSimple, setAll, trimming } from '#lib/modo.svelte.ts';
	import { isEssential, plainTitle } from '#lib/simple.ts';
	import Note from './ui/Note.svelte';
	import Term from './ui/Term.svelte';
	import Share from './ui/Share.svelte';

	interface Props {
		title: string;
		meta?: string;
		/** El dato de la derecha va en ámbar: algo que merece atención (p. ej. «5 nuevas hoy»). */
		accent?: boolean;
		/** Enlace «CÓDIGO ›» a la vista completa. */
		jump?: { code: string; href: string };
		/** Botón «Compartir»: los datos, o una función que los da al pulsar. Sin `url`, la página actual. */
		share?: ShareSource;
		children: Snippet;
		/** Pie del panel (fuente, notas). */
		note?: Snippet;
		/** Id estable del panel en la vista modular («luz», «boe»…). */
		id?: string;
		/** Se abre ya ampliado (p. ej. «NVDA GP» en la barra abre el gráfico de la ficha así). */
		expand?: boolean;
		/** Id del registro de pins.ts («pin:eco:bancos»): muestra el 📌 para fijarlo en TOP. */
		pin?: string;
	}

	let { title, meta, accent, jump, share, children, note, id, expand = false, pin }: Props = $props();

	// La vista modular, si este panel está en una (si no, undefined: el panel se ve como siempre).
	const modular = getModular();
	// Índice de paneles del móvil: el panel se apunta mientras está en la página.
	const index = getPanelIndex();
	// `section` llega con bind:this, que puede ir después de este efecto (al pasar de oculto a visible en Sencillo).
	$effect(() => (gone || !section ? undefined : index?.add(title, section)));
	const tools = $derived(modular && id ? modular : null);
	/** Menú del asa: subir, bajar y ancho. */
	let menu = $state(false);
	const SPANS: Span[] = [1, 2, 3];
	// En TOP (dentro de <PinnedPanels>) el 📌 abre su menú; en la vista de origen fija o suelta.
	const pinArea = inPinArea();
	let pinMenu = $state(false);
	const pinned = $derived(pin ? isPinned(pin) : false);

	// Modo Sencillo (modo.ts): los paneles que no son esenciales en esta vista no se pintan (salvo los fijados
	// en TOP, los que dejaste a la vista en la modular y con «Ver todos»), y el título se lee en español claro.
	// Los ocultos se apuntan para ViewHeader. El HTML prerenderizado sale en Terminal, con todos los paneles: el
	// <section> lleva data-essential y una regla CSS (abajo) esconde los demás antes de que arranque Svelte. Así,
	// cuando el {#if !gone} los quita, ya no se veían y no se mueve nada.
	const essential = $derived(!!pinArea || !!tools || isEssential(page.route.id, title, id));
	const gone = $derived(trimming() && !essential && !tv.on);
	$effect(() => {
		if (!isSimple() || essential || tv.on) return;
		hiddenPanels.add(title);
		return () => hiddenPanels.delete(title);
	});
	const shown = $derived(isSimple() ? plainTitle(title) : title);

	let max = $state(false);
	// Plegado (M20): tocar el título lo pliega o despliega y se recuerda por vista y panel. Ampliar pasa a ⤢ y M.
	const fkey = $derived(foldKey(page.route.id, title));
	// En el modo TV no hay quien despliegue: ahí todos los paneles salen abiertos.
	const shut = $derived(!max && !tv.on && isFolded(fkey));
	let titleButton = $state<HTMLButtonElement>();
	let section = $state() as HTMLElement;
	let closeButton = $state<HTMLButtonElement>();

	function open() {
		max = true;
	}

	// Como un watch de Vue con immediate: si llega `expand`, se amplía al montarse (y si cambia a true).
	$effect(() => {
		if (expand) open();
	});

	function close() {
		max = false;
		titleButton?.focus();
	}

	// M47: la barra pide este panel por el hash. Se mira al montarse y cada vez que cambia el hash (el texto: un
	// refresco de datos cambia page.url por otro objeto igual y no debe volver a llevarte al panel).
	let flash = $state(false);
	const hash = $derived(page.url.hash);
	$effect(() => {
		const want = hashPanel(hash);
		if (!want || !samePanel(want, title)) return;
		// En el modo Sencillo un panel no esencial no se pinta: para ir a él, se enseñan todos («Ver todos»).
		if (gone) {
			setAll(true);
			return;
		}
		untrack(() => isFolded(fkey) && toggleFold(fkey));
		const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
		const frame = requestAnimationFrame(() => section?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }));
		flash = true;
		const timer = setTimeout(() => (flash = false), 2000);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(timer);
		};
	});

	/** M con el foco en el título: abre o cierra. No llega a la barra de comandos (que escribiría la m). */
	function titleKeydown(e: KeyboardEvent) {
		if (isShortcut(e, 'panel') && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			e.stopPropagation();
			if (max) close();
			else open();
		}
	}

	const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

	/** Tab y ⇧Tab dan la vuelta dentro del panel: el foco no se escapa detrás del fondo atenuado. */
	function trapTab(e: KeyboardEvent) {
		const items = [...section.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
		if (!items.length) return;
		const first = items[0];
		const last = items.at(-1)!;
		const inside = section.contains(document.activeElement);
		if (e.shiftKey && (document.activeElement === first || !inside)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (document.activeElement === last || !inside)) {
			e.preventDefault();
			first.focus();
		}
	}

	// Mientras está maximizado: Esc cierra (en captura, antes que el Esc global de la barra, que llevaría
	// a la portada), Tab no sale del panel, la página de detrás no se desplaza y el foco va al ✕.
	$effect(() => {
		if (!max) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Tab') return trapTab(e);
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopImmediatePropagation();
			close();
		};
		window.addEventListener('keydown', onKey, { capture: true });
		const root = document.documentElement;
		const overflow = root.style.overflow;
		root.style.overflow = 'hidden';
		closeButton?.focus();
		return () => {
			window.removeEventListener('keydown', onKey, { capture: true });
			root.style.overflow = overflow;
		};
	});
</script>

{#if !gone}
{#if max}
	<!-- Fondo atenuado: tocarlo cierra el panel. Para teclado ya están Esc y ✕. -->
	<div class="scrim" aria-hidden="true" onclick={close}></div>
{/if}

<section bind:this={section} class="panel" data-ui="panel" data-essential={essential || undefined} class:max class:folded={shut} class:flash role={max ? 'dialog' : undefined} aria-modal={max ? 'true' : undefined} aria-label={max ? title : undefined}>
	<header class="ph" data-ui="panel-head">
		<h2>
			<button
				bind:this={titleButton}
				class="ttl"
				type="button"
				aria-expanded={max || !shut}
				title={max ? 'Volver a la vista (Esc)' : shut ? 'Desplegar' : 'Plegar · M para ampliar'}
				onclick={() => (max ? close() : toggleFold(fkey))}
				onkeydown={titleKeydown}
			>
				{#if !max}<span class="fold" data-ui="fold" aria-hidden="true">{shut ? '▸' : '▾'}</span>{/if}{shown}
			</button>{#if isSimple()}<Term of={title} />{/if}
		</h2>
		<div class="ph-r">
			{#if meta}<span class:accent data-ui="panel-meta">{meta}</span>{/if}
			{#if share}<Share source={share} />{/if}
			{#if jump}<a class="jump" href={jump.href}>{jump.code} ›</a>{/if}
			{#if pin && !max}
				<button
					class="tool pin"
					class:on={pinned}
					type="button"
					aria-pressed={pinArea ? undefined : pinned}
					aria-expanded={pinArea ? pinMenu : undefined}
					aria-label={pinArea ? `Ancho o quitar ${title} de TOP` : `Fijar ${title} en TOP`}
					title={pinArea ? 'Ancho o quitar de TOP' : pinned ? 'Fijado en TOP · toca para soltarlo' : 'Fijar en TOP'}
					onclick={() => (pinArea ? (pinMenu = !pinMenu) : togglePinned(pin))}
					><!-- Chincheta en línea (no el emoji 📌, que en el iPhone sale grande, en color y descuadrado). --><svg
						viewBox="0 0 16 16"
						aria-hidden="true"
						><path d="M5.5 1.5h5M6.5 1.5v5L4 9.5h8L9.5 6.5v-5M8 9.5v5" /></svg
					></button
				>
			{/if}
			{#if max}
				<button bind:this={closeButton} class="close" data-ui="panel-close" type="button" aria-label="Cerrar el panel ampliado" onclick={close}>✕</button>
			{:else}
				<button class="tool grow" data-ui="panel-grow" type="button" aria-label="Ampliar {title}" title="Ampliar (M)" onclick={open}>⤢</button>
			{/if}
			{#if tools && id && !max}
				<button
					class="tool grip"
					type="button"
					draggable="true"
					aria-expanded={menu}
					aria-label="Mover o cambiar el ancho de {title}"
					title="Arrastra para mover · toca para más opciones"
					onclick={() => (menu = !menu)}
					ondragstart={(e) => {
						e.dataTransfer?.setData('text/plain', id);
						tools.dragging = id;
					}}
					ondragend={() => (tools.dragging = null)}>⋮⋮</button
				>
				<button class="tool" type="button" aria-label="Ocultar {title}" title="Ocultar" onclick={() => tools.hide(id)}>✕</button>
			{/if}
		</div>
	</header>
	{#if tools && id && menu && !max}
		<div class="menu">
			<button type="button" onclick={() => tools.move(id, -1)} aria-label="Subir {title}">↑</button>
			<button type="button" onclick={() => tools.move(id, 1)} aria-label="Bajar {title}">↓</button>
			<!-- En el móvil hay una sola columna: el ancho no se ofrece. -->
			<span class="width">
				Ancho
				{#each SPANS as n (n)}
					<button type="button" aria-pressed={tools.span(id) === n} onclick={() => tools.setSpan(id, n)}>{n}</button>
				{/each}
			</span>
		</div>
	{/if}
	{#if pin && pinArea && pinMenu && !max}
		<div class="menu">
			<span class="width">
				Ancho
				{#each SPANS as n (n)}
					<button type="button" aria-pressed={pinSpan(pin) === n} onclick={() => setPinnedSpan(pin, n)}>{n}</button>
				{/each}
			</span>
			<button type="button" onclick={() => togglePinned(pin)}>Quitar de TOP</button>
		</div>
	{/if}
	{#if !shut}
		{@render children()}
		{#if note}
			<Note>{@render note()}</Note>
		{/if}
	{/if}
</section>
{/if}

<style>
	/* Modo Sencillo: los paneles que no son esenciales no se ven desde el primer pintado (antes de hidratar, el HTML
	   los trae todos). Es la misma condición que `gone`: <html data-modo> lo pone app.html antes de pintar, data-all
	   «Ver todos» (setAll) y data-tv el modo TV. Fuera de capas, para que ninguna estética lo pise. */
	:global(html[data-modo='sencillo']:not([data-all], [data-tv])) .panel:not([data-essential]) {
		display: none;
	}

	/* Al saltar desde el índice de paneles del móvil, el panel queda justo debajo de él. */
	@media (max-width: 720px) {
		.panel {
			scroll-margin-top: calc(var(--index-chip) + var(--sp-16));
		}
	}

	/* Con esquinas redondeadas (cualquier estética menos Terminal), lo de dentro se recorta con la forma del panel:
	   filas, cabeceras y tablas con scroll no asoman por las esquinas. clip y no hidden: no crea un contenedor de
	   scroll, así las cabeceras fijas siguen funcionando. El panel ampliado y el de «encajar» ya hacen scroll (auto). El foco
	   va hacia dentro para que el recorte no lo corte. */
	:global(:root:not([data-style='terminal'])) .panel:not(.max) {
		overflow: clip;
	}

	:global(:root:not([data-style='terminal'])) .panel :global(:focus-visible) {
		outline-offset: calc(-1 * var(--focus-w));
	}

	/* M47: el panel al que lleva la barra se marca con el borde del acento, que se apaga solo. */
	.panel.flash {
		outline: var(--hair) solid var(--amber);
		outline-offset: calc(-1 * var(--hair));
	}

	/* container-type: lo de dentro se adapta al ancho del panel con @container, no al de la pantalla. */
	.panel {
		background: var(--panel);
		border: var(--panel-edge);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		backdrop-filter: var(--panel-blur);
		min-width: 0;
		container-type: inline-size;
	}

	.ph {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-6) var(--sp-12);
		padding: var(--head-y) var(--pad-x);
		border-bottom: var(--border);
	}

	h2 {
		margin: 0;
		font-family: var(--title-font);
		font-size: var(--fs-title);
		font-weight: var(--fw-bold);
		letter-spacing: var(--title-track);
		text-transform: var(--title-case);
		color: var(--title-color);
	}

	.ph-r {
		/* Si no cabe junto al título y pasa a otra línea, sigue pegada a la derecha, como en una sola línea. */
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--sp-12);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.accent {
		color: var(--amber-dim);
	}

	/* Controles de la vista modular: discretos, del color del texto terciario. */
	.tool {
		background: none;
		border: 0;
		padding: 0;
		color: var(--faint);
		font-size: var(--fs-xs);
		line-height: 1;
		cursor: pointer;
		transition: color var(--dur-ui) var(--ease);
	}

	@media (hover: hover) {
		.tool:hover {
			color: var(--amber);
		}
	}

	/* La chincheta mide lo mismo que ⤢ (1 em de la letra de la cabecera); en ámbar cuando el panel está fijado. */
	.pin svg {
		width: 1em;
		height: 1em;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.pin.on {
		color: var(--amber);
	}

	@media (hover: hover) {
		.pin:hover {
			filter: none;
			opacity: 1;
		}
	}

	/* Menos ruido: con ratón, ampliar, compartir, fijar, mover y ocultar solo aparecen al pasar por el panel o
	   con el foco del teclado (no cambian de sitio: solo se encienden). En táctil siguen siempre a la vista.
	   El 📌 de un panel ya fijado no se esconde: dice algo. */
	@media (hover: hover) and (pointer: fine) {
		.ph-r > :is(.tool:not(.pin.on)),
		.ph-r > :global(.share) {
			opacity: 0;
			transition: opacity var(--dur-ui) var(--ease);
		}

		.panel:hover .ph-r > :is(.tool:not(.pin.on)),
		.panel:hover .ph-r > :global(.share),
		.ph:focus-within .ph-r > :is(.tool:not(.pin.on)),
		.ph:focus-within .ph-r > :global(.share) {
			opacity: 1;
		}
	}

	.grip {
		cursor: grab;
		letter-spacing: calc(-1 * var(--track-code));
	}

	/* En pantallas táctiles, 44 px pulsables sin que la cabecera crezca (como el enlace .jump). El título
	   (pliega el panel) también: si no, la zona que se toca es solo la línea de texto, unos 16 px. */
	@media (pointer: coarse) {
		/* h2 delante: la regla base de .ttl va más abajo y, si no, ganaría. */
		h2 .ttl {
			display: inline-flex;
			align-items: center;
			min-height: var(--touch);
			margin-block: calc((var(--touch) - 1lh) / -2);
		}

		/* 44 × 44 px pulsables (⤢ medía ~26 de ancho). El margen negativo devuelve a la cabecera el ancho de un
		   glifo más el hueco: así no se ensancha (dos herramientas vecinas solo comparten unos px del borde). */
		.tool {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: var(--touch);
			min-height: var(--touch);
			padding-inline: 0;
			margin: calc(-1 * var(--sp-14)) calc((1em + var(--sp-12) - var(--touch)) / 2);
		}
	}

	.menu {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-4) var(--sp-10);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--border);
		background: var(--raise);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.width {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-4);
	}

	@media (max-width: 720px) {
		.width {
			display: none;
		}
	}

	.menu button {
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		padding: 0 var(--sp-8);
		color: var(--muted);
		font-size: var(--fs-xs);
		cursor: pointer;
	}

	.menu button[aria-pressed='true'] {
		border-color: var(--amber-edge);
		color: var(--amber);
	}

	.jump {
		color: var(--muted);
		text-decoration: none;
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
	}

	@media (hover: hover) {
		.jump:hover {
			color: var(--amber);
		}
	}

	/* En pantallas táctiles el enlace gana 44 px de alto pulsable; el margen negativo evita que la cabecera crezca. */
	@media (pointer: coarse) {
		.jump {
			display: inline-flex;
			align-items: center;
			min-height: var(--touch);
			padding-inline: var(--pad-x);
			margin: calc(-1 * var(--sp-14)) calc(-1 * var(--pad-x));
		}
	}

	/* En «encajar en pantalla» el panel hace scroll por dentro: la cabecera se queda arriba. */
	:global(html[data-fit]) .ph {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		background: var(--panel);
	}

	/* ── Ampliar el panel ─────────────────────────────────────────────────────────────────── */

	/* El título como botón, con el mismo aspecto que el h2: sin fondo ni borde. */
	.ttl {
		all: unset;
		/* inline, como el texto del h2: así la cabecera mide exactamente lo mismo que antes. */
		display: inline;
		cursor: pointer;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: inherit;
	}

	.ttl:focus-visible {
		outline: var(--hair) solid var(--amber);
		outline-offset: var(--sp-2);
	}

	/* ▾ / ▸ delante del título: plegado o no, en --faint como los de ui/Disclosure. */
	.fold {
		display: inline-block;
		width: var(--sp-12);
		color: var(--faint);
		font-weight: var(--fw-regular);
	}

	.folded .ph {
		border-bottom: 0;
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		background: var(--scrim);
	}

	.max {
		position: fixed;
		inset: var(--gutter);
		z-index: var(--z-modal);
		/* Mide lo que la ventana y desplaza su contenido, aunque una regla de la vista le dé otro alto. */
		height: auto;
		max-height: calc(100dvh - 2 * var(--gutter));
		display: flex;
		flex-direction: column;
		overflow: auto;
		border: var(--border);
		border-radius: var(--radius-s);
		box-shadow: var(--shadow-pop);
	}

	/* Lo de dentro mide lo que necesita (no se encoge para caber): el que desplaza es el panel. */
	.max > :global(*) {
		flex-shrink: 0;
	}

	/* Dentro, la cabecera se queda fija arriba, igual que en «encajar». */
	.max .ph {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		background: var(--panel);
	}

	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--btn-sm);
		height: var(--btn-sm);
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		color: var(--muted);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	@media (hover: hover) {
		.close:hover {
			color: var(--amber);
		}
	}

	@media (pointer: coarse) {
		.close {
			width: var(--touch);
			height: var(--touch);
		}
	}

	/* En el móvil, a pantalla completa y sin márgenes. */
	@media (max-width: 720px) {
		.max {
			inset: 0;
			max-height: 100dvh;
			border: 0;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.max,
		.scrim {
			animation: appear var(--dur-fast) ease-out;
		}
	}

	@keyframes appear {
		from {
			opacity: 0;
		}
	}

	/* Impreso: cada panel entero en su página y sin los botones de la cabecera (ampliar, compartir, mover, ocultar). */
	@media print {
		.panel {
			break-inside: avoid;
		}

		.fold,
		.ph-r :global(button),
		.menu {
			display: none;
		}
	}
</style>
