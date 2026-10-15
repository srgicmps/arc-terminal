<!--
	«Tu sitio»: chip discreto en la cabecera («Madrid · cambiar», con un pin de trazo) que abre un buscador de ciudades (Open-Meteo, sin
	clave), «Usar mi ubicación» y tus favoritos (hasta 5). El sitio elegido lo usan WX, la portada y el reloj.
	Medidas y espaciados con los tokens de src/styles/tokens.css.
-->
<script lang="ts">
	import {
		isFavorite,
		locate,
		place,
		samePlace,
		searchPlaces,
		setPlace,
		toggleFavorite,
		type Place
	} from '#lib/place.svelte.ts';

	let open = $state(false);
	let query = $state('');
	let results = $state<Place[]>([]);
	let status = $state('');
	let root: HTMLDivElement;
	let chip: HTMLButtonElement;
	// Posición del desplegable, calculada desde el chip para que nunca se salga de la pantalla (en el móvil
	// el chip queda a la izquierda; en el escritorio, a la derecha).
	let pos = $state({ top: 0, left: 0 });
	const POP_W = 320;

	function toggle() {
		open = !open;
		if (!open) return;
		const r = chip.getBoundingClientRect();
		const width = Math.min(POP_W, innerWidth - 24);
		pos = { top: r.bottom + 4, left: Math.max(12, Math.min(r.right - width, innerWidth - width - 12)) };
	}
	let input = $state<HTMLInputElement>();

	// Buscar al escribir, con una pausa de 250 ms y cancelando la búsqueda anterior (como un watch con debounce).
	$effect(() => {
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			status = '';
			return;
		}
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			status = 'Buscando…';
			try {
				results = await searchPlaces(q, ctrl.signal);
				status = results.length ? '' : 'Sin resultados';
			} catch {
				if (!ctrl.signal.aborted) status = 'No se pudo buscar';
			}
		}, 250);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	});

	$effect(() => {
		if (open) input?.focus();
	});

	function choose(p: Place) {
		setPlace(p);
		open = false;
		query = '';
	}

	async function useMyLocation() {
		status = 'Ubicando…';
		try {
			choose(await locate());
			status = '';
		} catch (e) {
			status = (e as Error).message;
		}
	}

	/** «Tokio · Japón», «Maó · Islas Baleares, España». */
	const where = (p: Place) => [p.admin1, p.country].filter(Boolean).join(', ');

	function onWindowClick(e: MouseEvent) {
		if (open && !root.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} onscroll={() => (open = false)} />

<div class="place" data-ui="place" bind:this={root}>
	<button
		class="chip"
		bind:this={chip}
		type="button"
		aria-expanded={open}
		aria-haspopup="dialog"
		title="Tu sitio: el tiempo, el aire y el reloj de aquí · toca para cambiar"
		onclick={toggle}
	>
		<svg class="pin" viewBox="0 0 16 16" aria-hidden="true">
			<path d="M8 14.5s-4.5-4.6-4.5-8a4.5 4.5 0 0 1 9 0c0 3.4-4.5 8-4.5 8z" />
			<circle cx="8" cy="6.5" r="1.6" />
		</svg>
		<span class="name">{place.current.name}</span>
		<span class="caret">· cambiar</span>
	</button>

	{#if open}
		<div class="pop" role="dialog" aria-label="Elegir tu sitio" style:top="{pos.top}px" style:left="{pos.left}px">
			<input
				bind:this={input}
				bind:value={query}
				type="text"
				enterkeyhint="search"
				aria-label="Buscar una ciudad"
				placeholder="Busca una ciudad: Tokio, Lisboa…"
				spellcheck="false"
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						e.stopPropagation();
						open = false;
					} else if (e.key === 'Enter' && results[0]) choose(results[0]);
				}}
			/>
			<ul>
				{#each results as r (`${r.lat},${r.lon}`)}
					<li>
						<button type="button" class="opt" onclick={() => choose(r)}>
							{r.name}<small>{where(r)}</small>
						</button>
					</li>
				{/each}
				{#if !query.trim()}
					<li>
						<button type="button" class="opt" onclick={useMyLocation}>
							⌖ Usar mi ubicación<small>Solo se piden el tiempo y el aire de esas coordenadas</small>
						</button>
					</li>
					{#each place.favorites as f (`${f.lat},${f.lon}`)}
						<li class:on={samePlace(f, place.current)}>
							<button type="button" class="opt" onclick={() => choose(f)}>
								{f.name}<small>{where(f)}</small>
							</button>
						</li>
					{/each}
				{/if}
			</ul>
			{#if status}<p class="status" role="status">{status}</p>{/if}
			<button
				type="button"
				class="fav"
				aria-pressed={isFavorite(place.current)}
				onclick={() => toggleFavorite(place.current)}
			>
				{isFavorite(place.current) ? '★ Quitar' : '☆ Guardar'}
				{place.current.name} de favoritos
			</button>
		</div>
	{/if}
</div>

<style>
	.place {
		/* Ancho del desplegable: el mismo valor que POP_W en el script. */
		--pop-w: 320px;
		position: relative;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		height: var(--btn-sm);
		padding-inline: var(--sp-8);
		background: none;
		border: var(--border);
		border-radius: var(--radius-s);
		color: var(--muted);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.chip:hover,
	.chip[aria-expanded='true'] {
		color: var(--amber);
		border-color: var(--amber-edge);
	}

	/* Icono de trazo fino con el color del texto (como el de Compartir), no un emoji de color. */
	.pin {
		width: 1em;
		height: 1em;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: var(--hair);
	}

	.name {
		max-width: 14ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--fg);
	}

	/* En el móvil el nombre largo se recorta para que el chip quepa en la línea del logo. */
	@media (max-width: 720px) {
		.name {
			max-width: 10ch;
		}
	}

	/* «· cambiar» solo al pasar el ratón: en reposo, el chip es el pin y el nombre. */
	.caret {
		display: none;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.chip:is(:hover, :focus-visible) .caret {
		display: inline;
	}

	.pop {
		position: fixed;
		z-index: 30;
		width: min(var(--pop-w), calc(100vw - 2 * var(--sp-12)));
		background: var(--raise);
		border: var(--hair) solid var(--amber);
	}

	input {
		width: 100%;
		padding: var(--sp-8) var(--sp-10);
		background: transparent;
		border: 0;
		border-bottom: var(--border);
		outline: none;
		font-size: var(--fs-m);
	}

	input::placeholder {
		color: var(--faint);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 50vh;
		overflow: auto;
	}

	li + li {
		border-top: var(--border);
	}

	.opt {
		display: block;
		width: 100%;
		text-align: left;
		padding: var(--sp-6) var(--sp-10);
		background: none;
		border: 0;
		font-family: var(--sans);
		font-size: var(--fs-m);
		cursor: pointer;
	}

	.opt:hover,
	li.on .opt {
		background: var(--amber-soft);
	}

	.opt small {
		display: block;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.status {
		margin: 0;
		padding: var(--sp-6) var(--sp-10);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.fav {
		width: 100%;
		padding: var(--sp-6) var(--sp-10);
		background: none;
		border: 0;
		border-top: var(--border);
		color: var(--muted);
		font-size: var(--fs-s);
		text-align: left;
		cursor: pointer;
	}

	.fav:hover,
	.fav[aria-pressed='true'] {
		color: var(--amber);
	}
</style>
