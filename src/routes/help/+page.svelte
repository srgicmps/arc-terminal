<script lang="ts">
	import { routeHref } from '#lib/routes.ts';
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { COMMANDS } from '#lib/commands.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import { exampleTarget } from '#lib/cmdline.ts';
	import Table from '#lib/components/ui/Table.svelte';
	import { keyJoin, SHORTCUTS } from '#lib/shortcuts.ts';
	import { FUNCTIONS } from '#lib/functions.ts';
	import Select from '#lib/components/ui/Select.svelte';
	import { HOME_KEY, homeChoices, isHomeCode } from '#lib/home.ts';
	import { EXPERIENCES, homeValue } from '#lib/experiences.ts';
	import { persisted } from '#lib/persisted.svelte.ts';

	// Vista de inicio (home.ts): la que se abre al entrar, guardada en este navegador.
	const home = persisted(HOME_KEY, 'TOP', isHomeCode);
	import Seg from '#lib/components/ui/Seg.svelte';
	import { modo, MODOS, setModo } from '#lib/modo.svelte.ts';
	import Share from '#lib/components/ui/Share.svelte';
	import { collect, decode, encode, HASH } from '#lib/transfer.ts';
	import { cloud } from '#lib/cloud.svelte.ts';
	import StylePicker from '#lib/components/StylePicker.svelte';
	import { takesAccent } from '#lib/estilos.ts';
	import Tour from '#lib/onboarding/Tour.svelte';
	import { startTour, tour } from '#lib/onboarding/tour.svelte.ts';
	import { ACCENTS, DEFAULT_THUMB, DEFAULT_TOP, DENSITIES, resetTaste, setAccent, setDensity, setThumb, setTop, taste, THUMB_MAX, VISIBLE_KEYS } from '#lib/taste.svelte.ts';

	// «A tu gusto»: todas las vistas que se abren sin texto detrás pueden ir en la fila de arriba o abajo.
	const sections = COMMANDS.map((c) => ({ value: c.code, label: c.code }));
	// Llevar los ajustes a otro dispositivo (M21): un enlace a esta página con todo en el #.
	const transferLink = () => {
		const url = new URL(location.href);
		url.search = '';
		url.hash = HASH.slice(1) + encode(collect(localStorage));
		return { title: 'Mis ajustes de Arc Terminal', url: url.href };
	};
	// Al abrir ese enlace: se pregunta antes de tocar nada.
	let incoming = $state<Record<string, string> | null>(null);
	$effect(() => {
		if (location.hash.startsWith(HASH)) incoming = decode(location.hash.slice(HASH.length));
	});
	function forget() {
		incoming = null;
		history.replaceState(history.state, '', location.pathname + location.search);
	}
	function bring() {
		if (!incoming) return;
		try {
			for (const [key, value] of Object.entries(incoming)) localStorage.setItem(key, value);
		} catch {}
		forget();
		location.reload();
	}
	const custom = $derived(
		taste.accent !== 'auto' || taste.density !== 'normal' || taste.top.join() !== DEFAULT_TOP.join() || taste.thumb.join() !== DEFAULT_THUMB.join()
	);
</script>

{#if tour.open}<Tour />{/if}

<ViewHeader code="HELP" title="Comandos y atajos" sub="Escribe un comando o un valor en la barra de arriba y pulsa Intro" />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Comandos" meta="{COMMANDS.length} funciones" jump={{ code: 'MANUAL', href: resolve('/manual') }}>
			<Table>
				<thead><tr><th>Comando</th><th class="l">Qué abre</th><th class="l side">Equivalente Bloomberg</th><th class="l side">Fuentes</th></tr></thead>
				<tbody>
					{#each COMMANDS as c (c.code)}
						<tr>
							<td><a class="code" href={routeHref(c.route)}>{c.code}</a></td>
							<td class="l wrap">
								{c.desc}
								{#if c.aliases}<small class="mut">También: {c.aliases.join(', ')}</small>{/if}
								<!-- En el móvil, Bloomberg y fuentes van aquí debajo en vez de en sus columnas (sin scroll lateral). -->
								<small class="mut narrow">
									{#if c.bloomberg?.length}Bloomberg: {c.bloomberg.map((b) => b.code).join(', ')} · {/if}{c.sources}
								</small>
							</td>
							<td class="l wrap side">
								{#each c.bloomberg ?? [] as b, i (b.code)}{i ? ', ' : ''}<span title={b.panel ?? c.code}>{b.code}</span>{/each}
							</td>
							<td class="l wrap mut side">{c.sources}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		</Panel>
	</div>
	<div class="col">
		<Panel title="Atajos de teclado">
			<ul class="mini keys">
				{#each SHORTCUTS as s (s.id)}
					<li>
						<span class="l">{#each s.keys as k, i (i)}{#if i}{keyJoin(s)}{/if}<kbd>{k}</kbd>{/each}{#if 'how' in s}{s.keys.length ? ' ' : ''}{s.how}{/if}</span><b>{s.action}</b>
					</li>
				{/each}
			</ul>
		</Panel>
		<Panel title="A tu gusto" meta={cloud.user ? 'En tu cuenta' : 'Solo en este navegador'}>
			{#if incoming}
				{@const n = Object.keys(incoming).length}
				<div class="incoming" role="status">
					<p>Este enlace trae {n} {n === 1 ? 'ajuste' : 'ajustes'} de otro dispositivo. {n === 1 ? 'Sustituye al' : 'Sustituyen a los'} de aquí.</p>
					<button type="button" class="go" onclick={bring}>Traerlos</button>
					<button type="button" class="no" onclick={forget}>No</button>
				</div>
			{/if}
			<dl class="taste">
				<dt>Modo</dt>
				<dd><Seg label="Modo" options={MODOS} bind:value={() => modo.value, setModo} /></dd>
				<dt>Estética</dt>
				<dd><StylePicker /></dd>
				<dt>Acento</dt>
				<dd>
					{#if takesAccent(taste.style)}
						<Seg label="Color de acento" options={ACCENTS} bind:value={() => taste.accent, setAccent} />
					{:else}
						<span class="fixed">Esta estética lleva su propio color; el acento vale en las demás.</span>
					{/if}
				</dd>
				<dt>Densidad</dt>
				<dd><Seg label="Densidad" options={DENSITIES} bind:value={() => taste.density, setDensity} /></dd>
				<dt>Fila de arriba <small>(se ven las {VISIBLE_KEYS} primeras; el resto, en «Más»)</small></dt>
				<dd><Seg label="Secciones de la fila de arriba" options={sections} bind:values={() => taste.top, setTop} /></dd>
				<dt>Barra del móvil <small>({taste.thumb.length} de {THUMB_MAX})</small></dt>
				<dd><Seg label="Secciones de la barra inferior del móvil" options={sections} bind:values={() => taste.thumb, setThumb} /></dd>
				<dt>Al entrar</dt>
				<dd>
					<Select label="Vista" bind:value={() => home.value, (v) => (home.value = v)}>
						<optgroup label="Vistas">
							{#each homeChoices() as c (c.code)}<option value={c.code}>{c.code} · {c.key}</option>{/each}
						</optgroup>
						{#if EXPERIENCES.length}
							<optgroup label="Experiencias">
								{#each EXPERIENCES as e (e.id)}<option value={homeValue(e)}>{e.icon} {e.name}</option>{/each}
							</optgroup>
						{/if}
					</Select>
				</dd>
				<dt>Primeros pasos</dt>
				<dd class="send"><a href={resolve('/bienvenida')}>Repetir la bienvenida</a> · <button class="tourbtn" type="button" onclick={() => startTour()}>Ver el recorrido</button></dd>
				{#if cloud.user}
					<dt>Tu cuenta</dt>
					<dd>Todo esto se guarda en tu cuenta ({cloud.user}) y llega solo a tus otros dispositivos.</dd>
				{/if}
				<dt>Otro dispositivo</dt>
				<dd class="send"><Share source={transferLink} /> Enlace con todo lo tuyo: estos ajustes, MIS, palabras vigiladas, tu sitio…</dd>
			</dl>
			{#snippet note()}
				En la barra del móvil caben {THUMB_MAX}: al elegir otra, sale la primera de la lista. El enlace de
				«Otro dispositivo» lleva tu sitio y tus favoritos: es para ti, no lo compartas en público.
				{#if custom}<button class="reset" type="button" onclick={resetTaste}>Volver a lo de siempre</button>{/if}
			{/snippet}
		</Panel>
		<Panel title="Con texto detrás" meta="Comando, espacio y lo que buscas">
			<ul class="mini">
				{#each COMMANDS.filter((c) => c.arg) as c (c.code)}
					{@const ex = exampleTarget(c)}
					<li>
						<a class="l" href="{routeHref(ex.route)}{ex.search}">
							<b class="code">{c.arg!.example}</b>
						</a>
						<b>{c.arg!.label}</b>
					</li>
				{/each}
			</ul>
		</Panel>
		<Panel title="Funciones por valor" meta="Valor, espacio y función: NVDA GP">
			<ul class="mini">
				{#each FUNCTIONS as f (f.code)}
					<li>
						<a class="l" href="{resolve('/s')}?sym=NVDA&fn={f.code.toLowerCase()}"><b class="code">NVDA {f.code}</b> {f.desc}</a>
					</li>
				{/each}
			</ul>
			{#snippet note()}Con cualquier valor (BME:REP DES). Los comandos ganan: para un valor llamado como un comando, escribe la bolsa delante (NYSE:AI DES).{/snippet}
		</Panel>
		<Panel title="Valores" meta="Escribe el código: abre su ficha">
			<ul class="tickers">
				{#each TICKERS as t (t.code)}
					<li><a href="{resolve('/s')}?sym={encodeURIComponent(t.code)}"><b>{t.code}</b> {t.name}</a></li>
				{/each}
			</ul>
			{#snippet note()}Cualquier otro código de TradingView también funciona: AAPL, BME:REP, FX:GBPUSD…{/snippet}
		</Panel>
	</div>
</div>

<style>
	.fixed {
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.taste {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--sp-8) var(--sp-12);
		align-items: center;
		margin: 0;
		padding: var(--sp-10) var(--pad-x);
	}

	.taste dt {
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.taste dt small {
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.taste dd {
		margin: 0;
		min-width: 0;
	}

	/* En un panel estrecho (el móvil), cada etiqueta encima de sus botones. */
	@container (max-width: 520px) {
		.taste {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--sp-4);
		}

		.taste dd + dt {
			margin-top: var(--sp-8);
		}
	}

	.send {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		color: var(--faint);
		font-size: var(--fs-s);
	}

	.incoming {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--sp-10) var(--pad-x);
		border-bottom: var(--border);
		background: var(--amber-soft);
	}

	.incoming p {
		flex: 1 1 100%;
		margin: 0;
		font-size: var(--fs-s);
	}

	.incoming .no {
		height: var(--control-h);
		padding: 0 var(--pad-x);
		border: var(--hair) solid var(--amber-edge);
		background: none;
		color: var(--amber);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.reset {
		margin-left: var(--sp-6);
		padding: 0;
		border: 0;
		background: none;
		color: var(--amber);
		font: inherit;
		cursor: pointer;
	}

	.code {
		color: var(--amber);
		font-weight: var(--fw-medium);
		text-decoration: none;
	}

	.wrap {
		white-space: normal;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.wrap small {
		display: block;
		font-size: var(--fs-s);
	}

	.wrap small.narrow {
		display: none;
	}

	/* Atajos: la acción puede ser larga; en el móvil baja de línea en vez de salirse del panel. */
	/* Las teclas también bajan de línea: en una ventana estrecha de Arc OS, «Alt + ⇧ + ← / →» no cabe en una. */
	.keys li {
		grid-template-columns: minmax(0, max-content) minmax(6em, 1fr);
	}

	.keys .l {
		white-space: normal;
		min-width: 0;
	}

	.keys b {
		white-space: normal;
		overflow-wrap: anywhere;
		text-align: right;
	}

	/* Móvil: cuatro columnas no caben; Bloomberg y fuentes pasan bajo la descripción. */
	@media (max-width: 640px) {
		.side {
			display: none;
		}

		.wrap small.narrow {
			display: block;
		}
	}

	.tickers {
		list-style: none;
		margin: 0;
		padding: var(--row-y) var(--pad-x);
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--sp-4) var(--sp-12);
	}

	/* Cada enlace ocupa 24 px de alto (mínimo de WCAG 2.2) y las filas solo se separan 4 px más. */
	.tickers a {
		display: block;
		padding-block: var(--sp-4);
		margin-block: calc(-1 * var(--sp-2));
		color: var(--muted);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.tickers b {
		color: var(--amber);
		font-family: var(--mono);
		font-weight: var(--fw-medium);
	}

	.tickers a:hover {
		color: var(--fg);
	}

	/* Pantallas táctiles: 44 px de alto pulsable. */
	@media (pointer: coarse) {
		.tickers a {
			display: flex;
			align-items: center;
			min-height: var(--touch);
			margin-block: 0;
		}
	}

	.tourbtn {
		padding: 0;
		font: inherit;
		color: var(--amber-dim);
		background: none;
		border: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: var(--sp-2);
	}
</style>
