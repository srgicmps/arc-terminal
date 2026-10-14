<!--
	MANUAL: todo Arc Terminal en una página. Sale de los registros, no de un texto escrito a mano:
	los comandos con su ficha (`manual` de src/lib/commands/*.ts), los atajos (shortcuts.ts), lo que se
	guarda en el navegador (prefs.ts) y la guía (manual.ts, con los avisos de scripts/alerts/config.ts).
	Un test (src/lib/manual.test.ts) falla si algo queda sin documentar.
	Cada sección es un <details>: en el escritorio, abierta; en el móvil, plegada (acordeón). Al buscar se
	abren solas las que tienen algo.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { asset } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { resolveInput, targetPath } from '#lib/cmdline.ts';
	import { COMMANDS, MANUAL_SECTIONS, type Command } from '#lib/commands.ts';
	import {
		ALERT_LEVELS,
		ALERTS,
		CHESS_GUIDE,
		commandText,
		FAQ,
		matches,
		OFFLINE,
		PERSONAL,
		PLACE,
		sectionText,
		STOCK,
		thumbSlug,
		type GuideSection
	} from '#lib/manual.ts';
	import { PREFS } from '#lib/prefs.ts';
	import { routeHref } from '#lib/routes.ts';
	import { keyJoin, SHORTCUTS, type ShortcutGroup } from '#lib/shortcuts.ts';

	let { data } = $props();
	/** Miniaturas que hay en static/manual/ (+page.server.ts): sin la suya, la ficha sale sin imagen. */
	const thumbs = $derived(new Set(data.thumbs));

	let query = $state('');
	const searching = $derived(query.trim() !== '');
	const hit = (text: string) => matches(text, query);

	/** Lo que abre un ejemplo, como si se escribiera en la barra: «FUEL Madrid» → /fuel?zona=Madrid. */
	function exampleHref(example: string): string | undefined {
		const target = resolveInput(example, []);
		if (!target) return undefined;
		const { route, search } = targetPath(target);
		return routeHref(route) + search;
	}

	const slug = (s: string) =>
		s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');

	// ---- Qué se ve con la búsqueda ----
	const commandGroups = $derived(
		MANUAL_SECTIONS.map((section) => ({
			id: `sec-${slug(section)}`,
			title: section,
			commands: COMMANDS.filter((c) => c.manual?.section === section && hit(commandText(c)))
		}))
	);

	const GROUPS: ShortcutGroup[] = ['Barra', 'Paneles', 'Listas', 'Pantalla', 'TV'];
	const shortcuts = $derived(
		GROUPS.map((group) => ({
			group,
			items: SHORTCUTS.filter((s) => s.group === group && hit([group, ...s.keys, 'how' in s ? s.how : '', s.action].join(' ')))
		})).filter((g) => g.items.length)
	);

	const STORAGE = { local: 'localStorage', session: 'sessionStorage (esta pestaña)', cache: 'Caché sin conexión' };
	const prefs = $derived(PREFS.filter((p) => hit([p.key, p.what, p.where, p.kind, STORAGE[p.storage]].join(' '))));
	const levels = $derived(ALERT_LEVELS.filter((l) => hit([`P${l.level}`, l.name, ...l.what, sectionText(ALERTS)].join(' '))));
	const faq = $derived(FAQ.filter((f) => hit(`${f.q} ${f.a}`)));
	const stockHit = $derived(hit([sectionText(STOCK), ...STOCK.examples, ...STOCK.panels.flatMap((p) => [p.name, p.what])].join(' ')));
	const guideHit = (s: GuideSection) => hit(sectionText(s));

	/** Las secciones, en orden, con si tienen algo que enseñar ahora. */
	const sections = $derived([
		...commandGroups.map((g) => ({ id: g.id, title: g.title, has: g.commands.length > 0 })),
		{ id: STOCK.id, title: STOCK.title, has: stockHit },
		{ id: 'atajos', title: 'Atajos de teclado', has: shortcuts.length > 0 },
		{ id: PERSONAL.id, title: PERSONAL.title, has: guideHit(PERSONAL) },
		{ id: 'navegador', title: 'Lo que se guarda en tu navegador', has: prefs.length > 0 },
		{ id: ALERTS.id, title: ALERTS.title, has: levels.length > 0 || guideHit(ALERTS) },
		{ id: OFFLINE.id, title: OFFLINE.title, has: guideHit(OFFLINE) },
		{ id: PLACE.id, title: PLACE.title, has: guideHit(PLACE) },
		{ id: CHESS_GUIDE.id, title: CHESS_GUIDE.title, has: guideHit(CHESS_GUIDE) },
		{ id: 'preguntas', title: 'Preguntas frecuentes', has: faq.length > 0 }
	]);
	const has = $derived(new Map(sections.map((s) => [s.id, s.has])));
	const nothing = $derived(searching && sections.every((s) => !s.has));

	// ---- Acordeón en el móvil (por debajo de 720 px, el punto de corte de tokens.css) ----
	let mobile = $state(false);
	/** Secciones que has abierto o cerrado a mano. */
	let toggled = $state<Record<string, boolean>>({});

	onMount(() => {
		const media = matchMedia('(max-width: 720px)');
		const update = () => (mobile = media.matches);
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	const isOpen = (id: string) => (searching ? !!has.get(id) : (toggled[id] ?? !mobile));

	function ontoggle(id: string, e: Event) {
		if (!searching) toggled[id] = (e.currentTarget as HTMLDetailsElement).open;
	}
</script>

<ViewHeader code="MANUAL" title="Manual" sub="Todo Arc Terminal: vistas y paneles, comandos, atajos, ajustes y avisos" />

<div class="controls">
	<input type="search" bind:value={query} placeholder="Buscar en el manual: hipoteca, atajos, sin conexión…" aria-label="Buscar en el manual" />
</div>

<nav class="index" aria-label="Índice del manual">
	{#each sections as s (s.id)}
		{#if !searching || s.has}
			<a href="#{s.id}" onclick={() => (toggled[s.id] = true)}>{s.title}</a>
		{/if}
	{/each}
</nav>

{#if nothing}
	<p class="empty">Nada en el manual con «{query}».</p>
{/if}

{#snippet section(id: string, title: string, body: Snippet)}
	{#if !searching || has.get(id)}
		<details class="sec" {id} open={isOpen(id)} ontoggle={(e) => ontoggle(id, e)}>
			<summary>{title}</summary>
			{@render body()}
		</details>
	{/if}
{/snippet}

{#snippet commandBlock(c: Command)}
	{@const m = c.manual}
	{@const thumb = thumbSlug(c.route)}
	<div class="col" id="cmd-{c.code}">
		<Panel title="{c.code} · {c.key}" meta={c.desc} jump={{ code: c.code, href: routeHref(c.route) }}>
			{#if thumbs.has(thumb)}
				<a class="thumb" href={routeHref(c.route)}>
					<img
						src={asset(`manual/${thumb}.jpg` as Parameters<typeof asset>[0])}
						alt="Vista {c.code}"
						loading="lazy"
						width="480"
						height="300"
					/>
				</a>
			{/if}
			{#if m}
				<p class="what">{m.what}</p>
				{#each m.args ?? [] as a (a.label)}
					<div class="block">
						<h3>{a.label}</h3>
						<p class="examples">
							{#each a.examples as ex (ex)}<a class="ex" href={exampleHref(ex)}>{ex}</a>{/each}
						</p>
						{#if a.options}<p class="sub">Acepta: {a.options.join(' · ')}</p>{/if}
					</div>
				{/each}
				{#if m.panels?.length}
					<div class="block">
						<h3>Paneles</h3>
						<dl>
							{#each m.panels as p (p.name)}<dt>{p.name}</dt><dd>{p.what}</dd>{/each}
						</dl>
					</div>
				{/if}
				{#if m.tips?.length}
					<div class="block">
						<h3>Trucos</h3>
						<ul class="tips">
							{#each m.tips as t (t)}<li>{t}</li>{/each}
						</ul>
					</div>
				{/if}
			{/if}
			{#snippet note()}
				{#if c.aliases}También: {c.aliases.join(', ')}{' · '}{/if}Fuentes: {c.sources || '—'}
			{/snippet}
		</Panel>
	</div>
{/snippet}

{#snippet guide(s: GuideSection)}
	{#each s.paras as p (p)}<p class="what">{p}</p>{/each}
	{#if s.items}
		<ul class="tips">
			{#each s.items as t (t)}<li>{t}</li>{/each}
		</ul>
	{/if}
{/snippet}

{#each commandGroups as g (g.id)}
	{#snippet body()}
		<div class="grid grid-2">
			{#each g.commands as c (c.code)}{@render commandBlock(c)}{/each}
		</div>
	{/snippet}
	{@render section(g.id, g.title, body)}
{/each}

{#snippet stockBody()}
	<div class="grid grid-2">
		<div class="col">
			<Panel title="Cómo se abre">
				{@render guide(STOCK)}
				<div class="block">
					<h3>Ejemplos</h3>
					<p class="examples">
						{#each STOCK.examples as ex (ex)}<a class="ex" href={exampleHref(ex)}>{ex}</a>{/each}
					</p>
				</div>
			</Panel>
		</div>
		<div class="col">
			<Panel title="Paneles de la ficha">
				<dl class="pad">
					{#each STOCK.panels as p (p.name)}<dt>{p.name}</dt><dd>{p.what}</dd>{/each}
				</dl>
			</Panel>
		</div>
	</div>
{/snippet}
{@render section(STOCK.id, STOCK.title, stockBody)}

{#snippet shortcutsBody()}
	<div class="grid grid-2">
		{#each shortcuts as g (g.group)}
			<div class="col">
				<Panel title={g.group}>
					<ul class="mini">
						{#each g.items as s (s.id)}
							<li>
								<span class="l">{#each s.keys as k, i (i)}{#if i}{keyJoin(s)}{/if}<kbd>{k}</kbd>{/each}{#if 'how' in s}{s.keys.length ? ' ' : ''}{s.how}{/if}</span><b>{s.action}</b>
							</li>
						{/each}
					</ul>
				</Panel>
			</div>
		{/each}
	</div>
{/snippet}
{@render section('atajos', 'Atajos de teclado', shortcutsBody)}

{#snippet personalBody()}
	<div class="grid">
		<div class="col">
			<Panel title={PERSONAL.title}>{@render guide(PERSONAL)}</Panel>
		</div>
	</div>
{/snippet}
{@render section(PERSONAL.id, PERSONAL.title, personalBody)}

{#snippet prefsBody()}
	<div class="grid">
		<div class="col">
			<Panel title="Lo que se guarda en tu navegador" meta="{prefs.length} claves">
				<Table>
					<thead><tr><th>Clave</th><th class="l">Qué guarda</th><th class="l">Dónde</th><th class="l">Tipo</th></tr></thead>
					<tbody>
						{#each prefs as p (p.key)}
							<tr>
								<td class="l"><code>{p.key}</code></td>
								<td class="l wrap">{p.what}</td>
								<td class="l wrap mut">{p.where}</td>
								<td class="l mut">{p.kind}<small>{STORAGE[p.storage]}</small></td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}Nada de esto sale de tu navegador. Si borras los datos del sitio, todo vuelve a como venía.{/snippet}
			</Panel>
		</div>
	</div>
{/snippet}
{@render section('navegador', 'Lo que se guarda en tu navegador', prefsBody)}

{#snippet alertsBody()}
	<div class="grid grid-2">
		<div class="col">
			<Panel title="Cómo funcionan">{@render guide(ALERTS)}</Panel>
		</div>
		{#each levels as l (l.level)}
			<div class="col">
				<Panel title="P{l.level} · {l.name}" meta={l.quota === null ? 'Sin cupo propio' : `Hasta ${l.quota} al día`}>
					<ul class="tips">
						{#each l.what as t (t)}<li>{t}</li>{/each}
					</ul>
				</Panel>
			</div>
		{/each}
	</div>
{/snippet}
{@render section(ALERTS.id, ALERTS.title, alertsBody)}

{#each [OFFLINE, PLACE, CHESS_GUIDE] as s (s.id)}
	{#snippet body()}
		<div class="grid">
			<div class="col">
				<Panel title={s.title} jump={s === CHESS_GUIDE ? { code: 'CHESS', href: routeHref('/chess') } : undefined}>{@render guide(s)}</Panel>
			</div>
		</div>
	{/snippet}
	{@render section(s.id, s.title, body)}
{/each}

{#snippet faqBody()}
	<div class="grid grid-2">
		{#each faq as f (f.q)}
			<div class="col">
				<Panel title={f.q}><p class="what">{f.a}</p></Panel>
			</div>
		{/each}
	</div>
{/snippet}
{@render section('preguntas', 'Preguntas frecuentes', faqBody)}

<style>
	.controls {
		display: flex;
		margin-bottom: var(--sp-12);
	}

	input {
		flex: 1 1 280px;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--panel);
		border: var(--border);
		font-family: var(--sans);
		font-size: var(--fs-l);
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}

	.index {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-14);
		margin-bottom: var(--sp-16);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.index a {
		color: var(--muted);
		text-decoration: none;
	}

	.index a:hover {
		color: var(--amber);
	}

	.sec {
		margin-bottom: var(--sp-16);
		scroll-margin-top: var(--sp-16);
	}

	summary {
		padding: var(--sp-6) 0;
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		cursor: pointer;
	}

	.col {
		scroll-margin-top: var(--sp-16);
	}

	/* Miniatura de la vista (scripts/thumbs.ts): 1280×800 reducida a 480×300. En el móvil, todo el ancho. */
	.thumb {
		display: block;
		padding: var(--row-y) var(--pad-x) 0;
	}

	.thumb img {
		display: block;
		width: 100%;
		max-width: 240px;
		height: auto;
		aspect-ratio: 8 / 5;
		border: var(--border);
		background: var(--bg);
	}

	.thumb:hover img {
		border-color: var(--amber);
	}

	.what {
		margin: 0;
		padding: var(--row-y) var(--pad-x) 0;
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh);
	}

	.what:last-child,
	.tips:last-child {
		padding-bottom: var(--row-y);
	}

	.block {
		padding: var(--row-y) var(--pad-x) 0;
	}

	.block:last-child {
		padding-bottom: var(--row-y);
	}

	h3 {
		margin: 0 0 var(--sp-4);
		color: var(--faint);
		font-size: var(--fs-xs);
		font-weight: var(--fw-regular);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	.examples {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6) var(--sp-12);
		margin: 0;
	}

	.ex {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
		font-weight: var(--fw-medium);
		text-decoration: none;
	}

	.ex:hover {
		text-decoration: underline;
	}

	.sub {
		margin: var(--sp-4) 0 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	dl {
		display: grid;
		grid-template-columns: minmax(0, auto) minmax(0, 1fr);
		gap: var(--sp-4) var(--sp-12);
		margin: 0;
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	dl.pad {
		padding: var(--row-y) var(--pad-x);
	}

	dt {
		color: var(--fg);
	}

	dd {
		margin: 0;
		color: var(--muted);
	}

	.tips {
		margin: 0;
		padding: var(--row-y) var(--pad-x) 0 calc(var(--pad-x) + var(--sp-16));
		font-family: var(--sans);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.tips li + li {
		margin-top: var(--sp-4);
	}

	code {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.wrap {
		white-space: normal;
		font-family: var(--sans);
	}

	td small {
		display: block;
		font-size: var(--fs-xxs);
	}

	/* En el móvil, cada sección es un acordeón: un poco más de alto pulsable en el título. */
	@media (max-width: 720px) {
		.thumb img {
			max-width: none;
		}

		.sec {
			margin-bottom: 0;
			border-bottom: var(--border);
		}

		summary {
			display: flex;
			align-items: center;
			justify-content: space-between;
			min-height: var(--touch);
		}

		summary::after {
			content: '+';
			color: var(--faint);
		}

		.sec[open] > summary::after {
			content: '−';
		}

		.sec[open] {
			padding-bottom: var(--sp-12);
		}
	}
</style>
