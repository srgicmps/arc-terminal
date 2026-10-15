<!--
	Radio (experiencia 6): un informativo hablado con lo de hoy, a manos libres. Un toque en «Empezar» y la
	voz del navegador va leyendo bloque a bloque (titulares, mercados, economía, agenda y tus valores de MIS)
	mientras en pantalla se ve en grande lo que dice, con subtítulos. Pausa, saltos y velocidad.
	El programa se arma aquí, con la hora de quien escucha, a partir de /data/radio.json (radio.ts).
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ExpHeader from '#lib/components/ExpHeader.svelte';
	import { EXPERIENCES } from '#lib/experiences.ts';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { persisted } from '#lib/persisted.svelte.ts';
	import { routeHref } from '#lib/routes.ts';
	import { watchlist } from '#lib/watchlist.svelte.ts';
	import { buildProgram, OUTRO, personalSegment, RATES, type ProgramInput, type Segment } from '#lib/exp/radio.ts';
	import type { Earnings, Quote } from '#lib/types.ts';

	const exp = EXPERIENCES.find((e) => e.id === 'radio')!;

	type RadioData = Omit<ProgramInput, 'now'> & { earnings: Earnings[]; quotes: Quote[] };

	const rate = persisted<(typeof RATES)[number]>('arc-radio-rate', '1', (v) => (RATES as readonly string[]).includes(v));
	const RATE_OPTIONS = RATES.map((r) => ({ value: r, label: `${r.replace('.', ',')}×` }));

	let can = $state(false);
	let data = $state<RadioData | null>(null);
	let failed = $state(false);
	let program = $state<Segment[]>([]);
	let seg = $state(0);
	let line = $state(0);
	let playing = $state(false);
	let started = $state(false);
	/** Cada vez que se empieza a hablar, sube: así una frase que se cancela no avanza la cola al terminar. */
	let turn = 0;

	onMount(async () => {
		can = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
		try {
			const r = await fetch(asset('data/radio.json' as Parameters<typeof asset>[0]));
			data = r.ok ? ((await r.json()) as { data: RadioData }).data : null;
		} catch {}
		failed = !data;
		build();
	});

	function build() {
		if (!data) return;
		const now = Date.now();
		const common = buildProgram({ ...data, now });
		const mine = personalSegment(watchlist.codes, data.quotes, data.earnings, now);
		program = [...common, ...(mine ? [mine] : []), OUTRO];
	}

	const current = $derived(program[seg]);
	const caption = $derived(current?.lines[line]?.text ?? '');

	function speak() {
		const s = program[seg];
		const l = s?.lines[line];
		if (!l) return stop();
		const mine = ++turn;
		speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance(l.text);
		u.lang = l.lang === 'en' ? 'en-GB' : 'es-ES';
		u.rate = Number(rate.value);
		u.onend = () => {
			if (mine !== turn || !playing) return;
			next(false);
		};
		u.onerror = (e) => {
			if (mine === turn && e.error !== 'interrupted' && e.error !== 'canceled') stop();
		};
		speechSynthesis.speak(u);
	}

	/** La frase siguiente (o, con `jump`, el bloque siguiente). Al acabar el programa, para. */
	function next(jump: boolean) {
		if (!jump && line + 1 < (program[seg]?.lines.length ?? 0)) line++;
		else if (seg + 1 < program.length) {
			seg++;
			line = 0;
		} else return stop(true);
		if (playing) speak();
	}

	function prev() {
		if (line > 0) line = 0;
		else if (seg > 0) seg--;
		line = 0;
		if (playing) speak();
	}

	function go(i: number) {
		seg = i;
		line = 0;
		if (playing) speak();
	}

	function play() {
		if (!program.length) return;
		if (!started) build();
		started = true;
		playing = true;
		speak();
	}

	function pause() {
		playing = false;
		turn++;
		speechSynthesis.cancel();
	}

	function stop(done = false) {
		pause();
		if (done) {
			seg = 0;
			line = 0;
			started = false;
		}
	}

	// Cambiar la velocidad se nota en la frase siguiente; si está sonando, se repite la de ahora más deprisa.
	function setRate(v: (typeof RATES)[number]) {
		rate.value = v;
		if (playing) speak();
	}
	const rateSel = {
		get value() {
			return rate.value;
		},
		set value(v) {
			setRate(v);
		}
	};

	onDestroy(() => {
		if (can && playing) speechSynthesis.cancel();
	});
</script>

<ExpHeader {exp} sub="Lo de hoy, leído en voz alta: titulares, mercados, economía, agenda y tus valores" />

<div class="grid grid-2">
	<div class="col">
		<Panel title={current?.title ?? 'Arc Radio'} meta={program.length ? `${seg + 1}/${program.length}` : ''} accent={playing}>
			<div class="stage">
				{#if failed}
					<p class="empty">No se han podido cargar los datos del programa.</p>
				{:else if !program.length}
					<p class="empty">Preparando el programa…</p>
				{:else}
					{#if current.items.length}
						<ul class="items">
							{#each current.items as it (it.label)}
								<li>
									<span class="label">{it.label}</span>
									{#if it.value}<span class="value" class:up={it.tone === 'up'} class:down={it.tone === 'down'}>{it.value}</span>{/if}
								</li>
							{/each}
						</ul>
					{/if}
					<p class="caption" aria-live="polite">{started ? caption : can ? 'Pulsa «Empezar» y escucha. No hace falta tocar nada más.' : 'Aquí tienes el guion del informativo para leerlo.'}</p>
				{/if}
			</div>
			<div class="controls">
				{#if !can}
					<p class="empty">Este navegador no sabe leer en voz alta.</p>
				{:else}
					<button type="button" onclick={prev} disabled={!started} aria-label="Bloque anterior">⏮</button>
					{#if playing}
						<button type="button" class="main" onclick={pause}>❚❚ Pausa</button>
					{:else}
						<button type="button" class="main" onclick={play} disabled={!program.length}>▶ {started ? 'Seguir' : 'Empezar'}</button>
					{/if}
					<button type="button" onclick={() => next(true)} disabled={!started} aria-label="Bloque siguiente">⏭</button>
					<Seg label="Velocidad" options={RATE_OPTIONS} bind:value={rateSel.value} />
				{/if}
				{#if current && current.route !== '/'}
					<a class="more" href={routeHref(current.route as '/')}>Ver más en {current.route.slice(1).toUpperCase()} →</a>
				{/if}
			</div>
		</Panel>
	</div>
	<div class="col">
		<Panel title="Programa">
			<ol class="program">
				{#each program as s, i (s.id)}
					<li>
						<button type="button" aria-current={i === seg ? 'step' : undefined} onclick={() => go(i)}>
							<span class="n">{i + 1}</span>{s.title}<span class="mut">{s.lines.length} {s.lines.length === 1 ? 'frase' : 'frases'}</span>
						</button>
					</li>
				{/each}
			</ol>
			{#snippet note()}Voz del navegador, sin conexión a nada más. «Tus valores» sale de tu lista de MIS (valores de EE. UU. con cotización de Finnhub).{/snippet}
		</Panel>
	</div>
</div>

<style>
	.stage {
		display: grid;
		gap: var(--sp-16);
		padding: var(--sp-16) var(--pad-x);
		min-height: calc(var(--sp-16) * 14);
		align-content: start;
	}
	.items {
		display: grid;
		gap: var(--sp-8);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.items li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-16);
		padding-bottom: var(--sp-8);
		border-bottom: var(--border);
	}
	.label {
		font-family: var(--sans);
		font-size: var(--fs-xl);
		line-height: var(--lh-snug);
	}
	.label::first-letter {
		text-transform: uppercase;
	}
	.value {
		flex: none;
		font-size: var(--fs-l);
		font-variant-numeric: tabular-nums;
		white-space: pre;
		color: var(--muted);
	}
	.value.up {
		color: var(--up);
	}
	.value.down {
		color: var(--down);
	}
	.caption {
		margin: 0;
		padding-left: var(--sp-10);
		border-left: var(--hair) solid var(--amber);
		color: var(--fg);
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6);
		padding: var(--sp-10) var(--pad-x);
		border-top: var(--border);
	}
	.controls button {
		height: var(--control-h);
		min-width: var(--control-h);
		padding: 0 var(--sp-10);
		background: none;
		border: var(--border);
		color: var(--fg);
		cursor: pointer;
	}
	.controls button.main {
		border-color: var(--amber-edge);
		color: var(--amber);
	}
	.controls button:hover:not(:disabled),
	.controls button:focus-visible {
		border-color: var(--amber);
	}
	.controls button:disabled {
		color: var(--faint);
		cursor: default;
	}
	.more {
		margin-left: auto;
		color: var(--amber);
		font-size: var(--fs-xs);
		text-decoration: none;
	}
	.more:hover {
		text-decoration: underline var(--hair);
	}
	.program {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.program button {
		display: flex;
		align-items: baseline;
		gap: var(--sp-10);
		width: 100%;
		min-height: var(--control-h);
		padding: var(--sp-6) var(--pad-x);
		background: none;
		border: 0;
		border-bottom: var(--border);
		text-align: left;
		cursor: pointer;
	}
	.program .n {
		width: var(--sp-16);
		color: var(--faint);
	}
	.program .mut {
		margin-left: auto;
		font-size: var(--fs-xs);
	}
	.program button[aria-current] {
		background: var(--amber-soft);
		color: var(--amber);
	}
	.program button:hover {
		color: var(--amber);
	}
</style>
