<!--
	Vigilancia (Arc OS): un panel con tus objetivos (países, valores, líderes y temas). Cada uno, una tarjeta con su
	nivel (menciones de 24 h frente a su media, IMP, terremotos en su país y la variación del valor), sus titulares y
	lo que ha cambiado desde tu última visita. «Avisarme al móvil» usa tus avisos de siempre (myalerts.ts, AVISOS).
	La lógica está en targets.ts e intel.ts (con tests); lo guardado, en store.svelte.ts.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import type { AlertConfig } from '#lib/alertconfig.ts';
	import { favCountries, initFavCountries } from '#lib/favcountries.svelte.ts';
	import { nf, when } from '#lib/format.ts';
	import { initWatchlist, watchlist } from '#lib/watchlist.svelte.ts';
	import { openApp, openPath } from '../../os.svelte.ts';
	import type { AppProps } from '../../apps.ts';
	import { allHeadlines, assess, byLevel, changes, LEVELS, type Assessment, type Feeds } from './intel.ts';
	import { alertPlan, examples, inAlerts, KIND_LABEL, keyOf, labelOf, targetFromQuery, type Target } from './targets.ts';
	import { addTarget, initWatch, loadFeeds, markSeen, recordSeen, removeTarget, setTargets, watch } from './store.svelte.ts';

	let { win }: AppProps = $props();

	const EVERY = 5 * 60_000;

	let feeds = $state<Feeds | null>(null);
	let now = $state(0);
	let flash = $state('');
	let alerts = $state<Pick<AlertConfig, 'mis' | 'words' | 'on'> | null>(null);
	let busy = $state<string | null>(null);

	// Una sola vez al abrir: los init*() leen y escriben `ready`; en un $effect se volvería a ejecutar (y a descargar).
	onMount(() => {
		initWatch();
		initWatchlist();
		initFavCountries();
		let alive = true;
		const tick = async () => {
			const f = await loadFeeds();
			if (!alive) return;
			feeds = f;
			now = Date.now();
		};
		void tick();
		const id = setInterval(() => void tick(), EVERY);
		return () => {
			alive = false;
			clearInterval(id);
		};
	});

	const heads = $derived(feeds ? allHeadlines(feeds) : []);
	const cards = $derived.by(() => {
		if (!feeds) return [];
		const f = feeds;
		return byLevel(
			watch.targets.map((t) => {
				const a = assess(t, f, heads, now);
				return { t, a, c: changes(a, watch.ref[a.key]) };
			})
		);
	});

	// Lo que ves queda apuntado para la próxima visita (la referencia de esta no se mueve).
	$effect(() => {
		if (cards.length) recordSeen(cards.map((c) => c.a), now);
	});

	const hasData = $derived(!!feeds && (heads.length > 0 || feeds.quakes.length > 0));
	const freshTotal = $derived(cards.reduce((n, c) => n + c.c.fresh.size, 0));
	const proposal = $derived(watch.ready && !watch.targets.length ? examples(watchlist.codes, favCountries.codes) : []);
	const labels = $derived(watch.targets.map(labelOf));

	let flashTimer: ReturnType<typeof setTimeout> | undefined;
	function say(text: string) {
		flash = text;
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => (flash = ''), 5000);
	}

	function add(query: string) {
		const t = targetFromQuery(query);
		if (!t) return say('No se entiende: prueba con un país, un valor, un líder o una palabra');
		if (watch.targets.some((x) => keyOf(x) === keyOf(t))) return say(`«${labelOf(t)}» ya está en la lista`);
		addTarget(t);
		say(watch.targets.some((x) => keyOf(x) === keyOf(t)) ? `Vigilando ${labelOf(t)} (${KIND_LABEL[t.kind].toLowerCase()})` : 'Has llegado al tope de objetivos');
	}

	function removeByLabel(label: string) {
		const t = watch.targets.find((x) => labelOf(x) === label);
		if (t) removeTarget(t);
	}

	/** «Avisarme al móvil»: tus valores (mis) o tus palabras vigiladas de AVISOS, con la misma función que la barra. */
	async function notify(t: Target) {
		const plan = alertPlan(t);
		if (!plan) return;
		busy = keyOf(t);
		const [lib, my] = await Promise.all([import('#lib/alertconfig.ts'), import('#lib/myalerts.ts')]);
		const r = await my.changeAlerts((c) =>
			plan.kind === 'mis'
				? { ...c, mis: [...new Set([...c.mis, plan.value])].slice(0, lib.MIS_MAX) }
				: { ...c, words: lib.parseWordList([...c.words, plan.value]) }
		);
		busy = null;
		if (!r.ok) return say(r.why === 'none' ? 'Los avisos necesitan tu cuenta (arcterminal.dev)' : 'No se ha podido guardar en tu cuenta');
		alerts = r.config;
		if (!inAlerts(t, r.config)) return say('Ya tienes el máximo en AVISOS: borra alguno');
		const what = plan.kind === 'mis' ? `${plan.value} en tus valores` : `«${plan.value}» en tus palabras vigiladas`;
		say(r.config.on ? `Listo: ${what} de AVISOS` : `${what} de AVISOS. Activa tus avisos para recibirlos`);
	}

	const pct = (n: number) => `${n > 0 ? '+' : ''}${nf(n, 1)} %`;
	const pips = [1, 2, 3, 4];
</script>

<div class="cmd" data-ui="os-vigilancia" data-win={win}>
	<header class="head">
		<span class="title">◎ Vigilancia</span>
		<span class="meta">
			{watch.targets.length} objetivos
			{#if watch.refAt && now}· última visita {when(watch.refAt, now)}{/if}
			{#if freshTotal}· <b class="new-count">{freshTotal} nuevos</b>{/if}
		</span>
		<span class="actions">
			{#if freshTotal}
				<button type="button" onclick={() => markSeen(cards.map((c) => c.a), now)}>Marcar como visto</button>
			{/if}
			<button type="button" onclick={() => openApp('avisos')}>AVISOS</button>
		</span>
	</header>

	<ChipInput
		label="Añadir un objetivo: país, valor, líder o palabra"
		placeholder="Japón, NVDA, Lagarde, aranceles…"
		items={labels}
		onadd={add}
		onremove={removeByLabel}
	/>
	{#if flash}<p class="flash" role="status">{flash}</p>{/if}

	<div class="body">
		{#if !watch.ready || !feeds}
			<p class="empty">Cargando los datos…</p>
		{:else if !watch.targets.length}
			<section class="propose">
				<p>Aún no vigilas nada. Añade un país, un valor, un líder o una palabra, o empieza con estos{favCountries.codes.length || watchlist.codes.length ? ' (de tus países y tu MIS)' : ''}:</p>
				<div class="chips">
					{#each proposal as t (keyOf(t))}
						<button type="button" class="chip" onclick={() => addTarget(t)}>+ {labelOf(t)}</button>
					{/each}
				</div>
				<button type="button" class="primary" onclick={() => setTargets(proposal)}>Añadir todos</button>
			</section>
		{:else}
			{#if !hasData}<p class="empty">Sin datos de titulares ahora mismo: las tarjetas se llenan cuando lleguen.</p>{/if}
			<div class="grid">
				{#each cards as { t, a, c } (a.key)}
					{@const known = alerts ? inAlerts(t, alerts) : false}
					<article class="card" style:--lvl="var(--cmd-l{a.level})" aria-label="{labelOf(t)}: nivel {LEVELS[a.level]}">
						<div class="top">
							<span class="kind">{KIND_LABEL[t.kind]}</span>
							<h3>{labelOf(t)}</h3>
							<span class="level" title="Nivel {a.level} de 4">
								<span class="pips" aria-hidden="true">
									{#each pips as p (p)}<i class:on={a.level >= p}></i>{/each}
								</span>
								{LEVELS[a.level]}
							</span>
						</div>

						<dl class="stats">
							<div><dt>24 h</dt><dd>{a.count24}</dd></div>
							<div><dt>Media/día</dt><dd>{nf(a.baseline, 1)}</dd></div>
							{#if a.quote}
								<div><dt>Precio</dt><dd>{nf(a.quote.price)}</dd></div>
								<div><dt>Hoy</dt><dd><Change value={a.quote.changePct} unit=" %" /></dd></div>
							{/if}
						</dl>

						{#if a.why.length}<p class="why">{a.why.join(' · ')}</p>{/if}

						{#if c.known && (c.levelWas !== null || (c.pricePct !== null && Math.abs(c.pricePct) >= 0.05) || c.fresh.size)}
							<p class="since">
								<span class="lab">Desde tu visita</span>
								{#if c.levelWas !== null}<span>{a.level > c.levelWas ? '▲' : '▼'} de {LEVELS[c.levelWas]}</span>{/if}
								{#if c.pricePct !== null && Math.abs(c.pricePct) >= 0.05}<Change value={c.pricePct} text={pct(c.pricePct)} />{/if}
								{#if c.fresh.size}<span class="new-count">{c.fresh.size} titulares nuevos</span>{/if}
							</p>
						{/if}

						{#if a.geo.length}
							<ul class="geo">
								{#each a.geo as g (g.url + g.time)}
									<li><a href={g.url} target="_blank" rel="noopener">{g.title}</a> <span class="t">{when(g.time, now)}</span></li>
								{/each}
							</ul>
						{/if}

						{#if a.headlines.length}
							<ul class="news">
								{#each a.headlines.slice(0, 5) as h (h.h)}
									<li class:fresh={c.fresh.has(h.h)}>
										{#if c.fresh.has(h.h)}<span class="tag">Nuevo</span>{/if}
										{#if h.imp}<span class="tag imp">IMP</span>{/if}
										<a href={h.url} target="_blank" rel="noopener">{h.title}</a>
										<span class="t">{h.source}{h.media > 1 ? ` +${h.media - 1}` : ''}{h.time ? ` · ${when(h.time, now)}` : ''}</span>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="quiet">Sin titulares en las últimas 24 h.</p>
						{/if}

						<div class="foot">
							<button type="button" disabled={busy === a.key || known} onclick={() => notify(t)}>
								{known ? '✓ En tus avisos' : busy === a.key ? 'Guardando…' : 'Avisarme al móvil'}
							</button>
							<button type="button" onclick={() => openPath(`/news?q=${encodeURIComponent(labelOf(t).split(' · ')[0])}`)}>NEWS</button>
							<button type="button" class="ghost" onclick={() => removeTarget(t)} aria-label="Dejar de vigilar {labelOf(t)}">Quitar</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>

	<Note>
		Nivel: menciones en IMP y titulares de las últimas 24 h frente a su media de la semana, terremotos en su país (USGS) y
		variación del valor (Finnhub). Lo nuevo se compara con tu última visita. Sin IA.
	</Note>
</div>

<style>
	.cmd {
		display: grid;
		grid-template-rows: auto auto auto 1fr auto;
		height: 100%;
		min-height: 0;
		background: var(--cmd-slate);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-s);
	}

	.cmd :global([data-ui='note']) {
		border-top-color: var(--cmd-edge);
	}

	.cmd :global(.chip-input) {
		border-bottom-color: var(--cmd-edge);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6) var(--sp-12);
		padding: var(--sp-6) var(--pad-x);
		border-bottom: var(--hair) solid var(--cmd-edge);
	}

	.title {
		color: var(--title-color);
		font-size: var(--fs-title);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}

	.meta {
		flex: 1 1 auto;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.actions {
		display: flex;
		gap: var(--sp-6);
	}

	button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: none;
		border: var(--hair) solid var(--cmd-edge);
		border-radius: var(--radius-s);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		cursor: pointer;
	}

	button:hover:not(:disabled),
	button:focus-visible {
		border-color: var(--cmd-cold);
		color: var(--cmd-cold);
	}

	button:disabled {
		color: var(--muted);
		cursor: default;
	}

	button.primary {
		border-color: var(--amber-edge);
		color: var(--amber);
	}

	button.ghost {
		margin-left: auto;
		border-color: transparent;
		color: var(--faint);
	}

	.flash {
		margin: 0;
		padding: var(--sp-4) var(--pad-x);
		border-bottom: var(--hair) solid var(--cmd-edge);
		color: var(--cmd-cold);
		font-size: var(--fs-xs);
	}

	.body {
		min-height: 0;
		overflow: auto;
		padding: var(--sp-10) var(--pad-x);
	}

	.empty,
	.quiet {
		margin: 0;
		color: var(--faint);
	}

	.empty {
		padding: var(--sp-8) 0;
	}

	.propose {
		display: grid;
		gap: var(--sp-10);
		justify-items: start;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.propose p {
		margin: 0;
		color: var(--muted);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
	}

	.chip {
		color: var(--cmd-cold);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--cmd-card-min)), 1fr));
		gap: var(--sp-8);
	}

	.card {
		display: grid;
		align-content: start;
		gap: var(--sp-6);
		padding: var(--sp-8) var(--sp-10);
		background: var(--cmd-card);
		border: var(--hair) solid var(--cmd-edge);
		border-left-color: var(--lvl);
		border-radius: var(--radius);
		min-width: 0;
	}

	.top {
		display: flex;
		align-items: baseline;
		gap: var(--sp-8);
		min-width: 0;
	}

	.kind {
		color: var(--cmd-cold);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	h3 {
		flex: 1 1 auto;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		font-family: var(--sans);
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.level {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
		color: var(--lvl);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		white-space: nowrap;
	}

	.pips {
		display: inline-flex;
		gap: var(--sp-2);
	}

	.pips i {
		width: var(--cmd-pip-w);
		height: var(--cmd-pip-h);
		background: var(--line);
	}

	.pips i.on {
		background: var(--lvl);
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-14);
		margin: 0;
		padding: var(--sp-4) 0;
		border-top: var(--hair) solid var(--cmd-edge);
		border-bottom: var(--hair) solid var(--cmd-edge);
	}

	.stats div {
		display: grid;
	}

	dt {
		color: var(--faint);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.why {
		margin: 0;
		color: var(--lvl);
		font-size: var(--fs-xs);
	}

	.since {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--sp-4) var(--sp-10);
		margin: 0;
		padding: var(--sp-4) var(--sp-6);
		background: var(--cmd-new-soft);
		font-size: var(--fs-xs);
	}

	.lab {
		color: var(--cmd-new);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
		font-size: var(--fs-xxs);
	}

	.new-count {
		color: var(--cmd-new);
		font-weight: var(--fw-medium);
	}

	ul {
		display: grid;
		gap: var(--sp-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.news li,
	.geo li {
		padding-left: var(--sp-6);
		border-left: var(--hair) solid transparent;
		font-family: var(--sans);
		font-size: var(--fs-s);
		line-height: var(--lh-snug);
	}

	.geo li {
		border-left-color: var(--down);
	}

	.news li.fresh {
		border-left-color: var(--cmd-new);
	}

	a {
		color: var(--fg);
		text-decoration: none;
	}

	a:hover,
	a:focus-visible {
		color: var(--cmd-cold);
		text-decoration: underline;
	}

	.t {
		color: var(--faint);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
	}

	.tag {
		margin-right: var(--sp-4);
		padding: 0 var(--sp-3);
		border: var(--hair) solid var(--cmd-new);
		color: var(--cmd-new);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		text-transform: uppercase;
	}

	.tag.imp {
		border-color: var(--cmd-edge);
		color: var(--cmd-cold);
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
		padding-top: var(--sp-4);
	}
</style>
