<!--
	Página de error propia (F12), dentro del layout: cabecera, barra y teclas siguen ahí. Tres casos, según
	page.status y si hay conexión (nunca según el texto del error, que es de SvelteKit y en inglés):
	- 404: esa dirección no es ninguna vista. «¿Querías decir ECO?» con guessCommand (src/lib/notfound.ts).
	- 401: la sesión de Cloudflare Access ha caducado. El layout ya recarga y lleva al login: mensaje neutro.
	- El resto: no se ha podido cargar. «Reintentar» y, sin conexión, las vistas guardadas en este dispositivo
	  (la caché de páginas del service worker).
	Sin Panel: en una página de error route.id es null y guardaría sus ajustes de plegado con esa clave.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import ButtonRow from '#lib/components/ui/ButtonRow.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import { findCommand } from '#lib/cmdline.ts';
	import type { Command } from '#lib/commands.ts';
	import { guessCommand, PAGES_CACHE, savedViews } from '#lib/notfound.ts';
	import { routeHref } from '#lib/routes.ts';

	/** La carpeta de la web («» en la raíz): resolve('/') la lleva delante. */
	const base = resolve('/').replace(/\/$/, '');
	const path = $derived(page.url.pathname.slice(base.length) || '/');

	// Sin conexión: se lee en el navegador y se sigue con los eventos online y offline (la página no se prerenderiza).
	let online = $state(true);
	$effect(() => {
		const update = () => (online = navigator.onLine);
		update();
		addEventListener('online', update);
		addEventListener('offline', update);
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});

	const kind = $derived(page.status === 404 ? 'missing' : page.status === 401 ? 'login' : online ? 'failed' : 'offline');
	const guess = $derived(kind === 'missing' ? guessCommand(path) : undefined);

	/** La dirección del 404 como se escribió («€» y no «%E2%82%AC») y recortada si es muy larga. */
	const shownPath = $derived.by(() => {
		let text = path;
		try {
			text = decodeURIComponent(path);
		} catch {}
		return text.length > 60 ? `${text.slice(0, 59)}…` : text;
	});

	// Vistas guardadas en este dispositivo (la caché de páginas del service worker), la más reciente primero. Si
	// el navegador no tiene Cache API o falla (Safari en privado), la lista no sale y ya está.
	let saved = $state.raw<Command[]>([]);
	$effect(() => {
		if (kind !== 'offline') return;
		let alive = true;
		(async () => {
			try {
				if (!('caches' in window) || !(await caches.has(PAGES_CACHE))) return;
				const keys = await (await caches.open(PAGES_CACHE)).keys();
				// Sin TOP (ya está en los botones de arriba) ni la vista que ha fallado.
				const here = path.replace(/\/$/, '') || '/';
				const views = savedViews(keys.map((r) => r.url).reverse(), base).filter((c) => c.route !== '/' && c.route !== here);
				if (alive) saved = views;
			} catch {}
		})();
		return () => {
			alive = false;
		};
	});

	/** TOP, HELP y STATUS: siempre a mano. TOP y HELP abren también sin conexión (TOP está siempre guardada). */
	const EXITS = ['TOP', 'HELP', 'STATUS'].map((code) => findCommand(code)).filter((c): c is Command => !!c);

	const head = $derived(
		kind === 'missing'
			? { code: '404', title: 'Esta vista no existe', sub: 'Esa dirección no lleva a ninguna vista.' }
			: kind === 'login'
				? { code: '401', title: 'Tu sesión ha caducado', sub: 'Te llevamos a la pantalla de entrada…' }
				: kind === 'offline'
					? { code: 'SIN RED', title: 'Sin conexión', sub: 'Esta vista no está guardada en este dispositivo: se guarda al abrirla con conexión.' }
					: { code: String(page.status), title: 'No se ha podido cargar esta vista', sub: 'Ha fallado algo al abrirla. Vuelve a intentarlo en un momento.' }
	);
</script>

<ViewHeader code={head.code} title={head.title} sub={head.sub} />

<section class="box" data-ui="error" aria-label="Qué puedes hacer">
	<ButtonRow>
		{#if kind === 'failed' || kind === 'offline'}
			<button type="button" class="warn" onclick={() => location.reload()}>Reintentar</button>
		{/if}
		{#each EXITS as c (c.code)}
			<button type="button" title={c.desc} onclick={() => goto(routeHref(c.route))}>{c.code}</button>
		{/each}
	</ButtonRow>

	{#if guess}
		<h2>¿Querías decir…?</h2>
		<ul class="mini">
			<li><a href={routeHref(guess.route)}><span class="code">{guess.code}</span><span class="desc">{guess.desc}</span></a></li>
		</ul>
	{/if}

	{#if kind === 'offline' && saved.length}
		<h2>Vistas guardadas en este dispositivo</h2>
		<ul class="mini">
			{#each saved as c (c.code)}
				<li><a href={routeHref(c.route)}><span class="code">{c.code}</span><span class="desc">{c.desc}</span></a></li>
			{/each}
		</ul>
	{/if}

	<Note>
		{#if kind === 'missing'}
			<code>{shownPath}</code> no es ninguna vista. Para abrir una, escribe su código en la barra (ECO, FUEL…) o búscala
			por su nombre.
		{:else if kind === 'login'}
			Si no pasa nada en unos segundos, vuelve a abrir Arc Terminal.
		{:else if kind === 'offline'}
			Cuando vuelva la conexión, «Reintentar» la abre.
		{:else}
			Si se repite, mira en STATUS si alguna fuente está caída.
		{/if}
	</Note>
</section>

<style>
	/* La misma caja que un panel (Panel.svelte), sin su cabecera. */
	.box {
		background: var(--panel);
		border: var(--panel-edge);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		backdrop-filter: var(--panel-blur);
		overflow: clip;
		/* Lo que ocupan dos columnas de paneles: en una pantalla ancha, los botones no se estiran de lado a lado. */
		max-width: calc(2 * var(--col-min));
	}

	/* La caja recorta: el foco va hacia dentro, como en Panel, para que el contorno de los botones no se corte. */
	.box :global(:focus-visible) {
		outline-offset: calc(-1 * var(--focus-w));
	}

	/* Sin nada entre los botones y la nota, ya las separa la línea de abajo de los botones: 1 px, no 2. */
	.box > :global([data-ui='note']:nth-child(2)) {
		border-top: 0;
	}

	/* La dirección del 404 se parte por cualquier sitio: una muy larga no ensancha la página en el móvil. */
	code {
		font-family: var(--mono);
		overflow-wrap: anywhere;
	}

	h2 {
		margin: 0;
		padding: var(--head-y) var(--pad-x) 0;
		font-family: var(--title-font);
		font-size: var(--fs-title);
		font-weight: var(--fw-bold);
		letter-spacing: var(--title-track);
		text-transform: var(--title-case);
		color: var(--title-color);
	}

	/* Código y descripción en dos columnas iguales en todas las filas: la del código mide lo que el más largo
	   (BIENVENIDA). Cada fila y su enlace heredan las columnas de la lista (subgrid). */
	.mini {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		column-gap: var(--sp-12);
	}

	.mini li,
	.mini a {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
		column-gap: var(--sp-12);
		align-items: baseline;
	}

	.code {
		font-family: var(--mono);
		font-weight: var(--fw-medium);
		color: var(--amber);
	}

	/* Entera, aunque ocupe dos líneas: aquí hay pocas filas y en el móvil se corta enseguida. */
	.desc {
		font-family: var(--sans);
		font-size: var(--fs-m);
		min-width: 0;
	}
</style>
