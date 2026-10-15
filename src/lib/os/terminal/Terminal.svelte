<!--
	App «Terminal» de Arc OS: la barra de comandos como consola (prompt, historial, Tab, salida de texto).
	La lógica está en console.ts. `onopen` decide cómo se abre una vista (Arc OS la abre en una ventana);
	sin él, se navega como con la barra. Se ve como un terminal en cualquier estilo: usa --mono y los colores del tema.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { COMMANDS } from '#lib/commands.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import { routeHref } from '#lib/routes.ts';
	import { historyStep, pushHistory, readHistory, writeHistory, type Option } from '#lib/cmdline.ts';
	import { answerNeeds } from '#lib/bar/answers.ts';
	import { barData, loadBarData } from '#lib/bar/bardata.svelte.ts';
	import { parseConversion } from '#lib/calc.ts';
	import { fxLive, loadFxRates } from '#lib/fxlive.svelte.ts';
	import { complete, execLine, helpLines, PROMPT, type Line } from './console.ts';

	let { onopen, autofocus = true }: { onopen?: (href: string, label: string) => void; autofocus?: boolean } = $props();

	// Ids únicos: Arc OS puede tener varias consolas abiertas.
	const uid = $props.id();

	const ALL: Option[] = [
		...COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función', aliases: c.aliases })),
		...TICKERS.map((t) => ({ code: t.code, desc: t.name, kind: 'Valor' }))
	];

	/** `tag`: las líneas de una respuesta que aún se está cargando (se cambian cuando llega el dato). */
	type Shown = Line & { tag?: number };
	let lines = $state<Shown[]>([{ kind: 'dim', text: 'Arc Terminal · escribe «ayuda» o un comando (ECO, NVDA, =2*21…)' }]);
	let value = $state('');
	let history = $state<string[]>([]);
	let histIdx = $state(-1);
	let input: HTMLInputElement;
	let screen: HTMLDivElement;
	let fuelZone: string | null = null;

	$effect(() => {
		history = readHistory();
		try {
			fuelZone = localStorage.getItem('fuel-zone');
		} catch {}
		if (autofocus) input.focus();
	});
	// Lo que necesitan las respuestas rápidas y el conversor se descarga mientras escribes, como en la barra.
	$effect(() => {
		loadBarData(answerNeeds(value, fuelZone));
		if (parseConversion(value)) loadFxRates();
	});

	function scrollDown() {
		queueMicrotask(() => screen?.scrollTo({ top: screen.scrollHeight }));
	}

	const run = (raw: string) => execLine(raw, { answers: { get: (n) => barData[n], now: Date.now(), fuelZone }, all: ALL, fx: fxLive, history });

	// «euribor», «100 usd eur»: si el dato aún no ha llegado, la respuesta se vuelve a pedir hasta que llegue (unos
	// 15 s como mucho) y sus líneas se cambian en su sitio.
	let seq = 0;
	function retry(raw: string, tag: number, tries = 0) {
		setTimeout(() => {
			if (!lines.some((l) => l.tag === tag)) return;
			const r = run(raw);
			const i = lines.findIndex((l) => l.tag === tag);
			const n = lines.filter((l) => l.tag === tag).length;
			const fresh = r.lines.map((l) => ({ ...l, tag: r.pending ? tag : undefined }));
			lines = [...lines.slice(0, i), ...fresh, ...lines.slice(i + n)];
			if (r.pending && tries < 30) retry(raw, tag, tries + 1);
		}, 500);
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const raw = value;
		const r = run(raw);
		const tag = r.pending ? ++seq : undefined;
		if (tag) {
			loadBarData(answerNeeds(raw, fuelZone));
			if (parseConversion(raw)) loadFxRates();
			retry(raw, tag);
		}
		lines = r.clear ? [] : [...lines, ...r.lines.map((l) => ({ ...l, tag }))].slice(-400);
		const typed = value.trim();
		if (typed && !r.clear) {
			history = pushHistory(history, r.history ?? typed);
			if (r.history) writeHistory(history);
		}
		value = r.next ?? '';
		histIdx = -1;
		if (r.open) {
			const href = routeHref(r.open.route as Parameters<typeof routeHref>[0]) + r.open.search;
			if (onopen) onopen(href, r.open.label);
			else goto(href);
		}
		scrollDown();
	}

	function tab() {
		const c = complete(value, ALL);
		value = c.value;
		if (c.list.length) {
			lines = [...lines, { kind: 'in', text: `${PROMPT} ${value}` }, { kind: 'dim', text: c.list.map((o) => o.run ?? o.code).join('   ') }];
			scrollDown();
		}
	}
	function walk(dir: 1 | -1) {
		const step = historyStep(history, histIdx, dir);
		histIdx = step.idx;
		value = step.value;
	}
	// Teclas para el dedo (en pantallas táctiles no hay Tab ni flechas): no quitan el foco, así el teclado sigue.
	function softKey(e: PointerEvent, fn: () => void) {
		e.preventDefault();
		fn();
		input.focus();
	}
	// Con el teclado del móvil abierto, que la línea de entrada quede a la vista.
	function onfocus() {
		setTimeout(() => input?.scrollIntoView({ block: 'nearest' }), 300);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Tab' && !e.shiftKey && value.trim()) {
			e.preventDefault();
			tab();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			walk(e.key === 'ArrowUp' ? 1 : -1);
		} else if (e.key === 'l' && e.ctrlKey) {
			e.preventDefault();
			lines = [];
		} else if (e.key === 'Escape' && value) {
			e.preventDefault();
			e.stopPropagation();
			value = '';
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="term" onclick={() => getSelection()?.isCollapsed && input.focus()}>
	<div class="screen" bind:this={screen} role="log" aria-live="polite" aria-label="Salida de la consola">
		{#each lines as l, i (i)}
			<div class="line {l.kind}">{l.text}</div>
		{/each}
	</div>
	<form class="prompt" onsubmit={submit}>
		<label for="{uid}-in">{PROMPT}</label>
		<input
			id="{uid}-in"
			bind:this={input}
			bind:value
			{onkeydown}
			{onfocus}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="go"
			aria-describedby="{uid}-help"
		/>
		<span class="keys" aria-hidden="true">
			<button type="button" tabindex="-1" onpointerdown={(e) => softKey(e, () => value.trim() && tab())}>Tab</button>
			<button type="button" tabindex="-1" onpointerdown={(e) => softKey(e, () => walk(1))}>↑</button>
			<button type="button" tabindex="-1" onpointerdown={(e) => softKey(e, () => walk(-1))}>↓</button>
		</span>
		<span id="{uid}-help" class="sr">{helpLines().at(-1)?.text}</span>
	</form>
</div>

<style>
	.term {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--bg);
		color: var(--fg);
		font-family: var(--mono);
		font-size: var(--fs-m);
		line-height: var(--lh);
	}
	.screen {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--sp-8) var(--pad-x);
		white-space: pre-wrap;
		word-break: break-word;
	}
	/* Las líneas largas siguen con sangría, como en una consola (la ayuda se lee bien en el móvil). */
	.line {
		padding-left: 2ch;
		text-indent: -2ch;
	}
	.line.in {
		color: var(--amber);
	}
	.line.dim {
		color: var(--muted);
	}
	.line.err {
		color: var(--down);
	}
	.prompt {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		padding: var(--sp-4) var(--pad-x);
		border-top: var(--border);
		min-height: var(--control-h);
	}
	.prompt label {
		color: var(--amber);
	}
	.prompt input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: 0;
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-field);
		caret-color: var(--amber);
		outline: none;
	}
	.keys {
		display: none;
		gap: var(--sp-4);
	}
	.keys button {
		min-width: var(--touch);
		height: var(--control-h);
		padding: 0 var(--sp-6);
		font: inherit;
		font-size: var(--fs-s);
		color: var(--muted);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		touch-action: manipulation;
	}
	@media (pointer: coarse) {
		.keys {
			display: inline-flex;
		}
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
