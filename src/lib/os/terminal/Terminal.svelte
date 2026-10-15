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

	let lines = $state<Line[]>([{ kind: 'dim', text: 'Arc Terminal · escribe «ayuda» o un comando (ECO, NVDA, =2*21…)' }]);
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

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const r = execLine(value, { answers: { get: (n) => barData[n], now: Date.now(), fuelZone }, all: ALL, fx: fxLive, history });
		lines = r.clear ? [] : [...lines, ...r.lines].slice(-400);
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

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Tab' && !e.shiftKey && value.trim()) {
			e.preventDefault();
			const c = complete(value, ALL);
			value = c.value;
			if (c.list.length) {
				lines = [...lines, { kind: 'in', text: `${PROMPT} ${value}` }, { kind: 'dim', text: c.list.map((o) => o.run ?? o.code).join('   ') }];
				scrollDown();
			}
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const step = historyStep(history, histIdx, e.key === 'ArrowUp' ? 1 : -1);
			histIdx = step.idx;
			value = step.value;
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
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="go"
			aria-describedby="{uid}-help"
		/>
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
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
