<!--
	Barra de comandos: escribes ECO, FUEL o un valor (NVDA) y se abre. Sugerencias con ↑ ↓ e Intro.
	Atajos globales: «/» o empezar a escribir enfoca la barra; Esc vuelve a la portada.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { COMMANDS, TICKERS } from '#lib/commands.ts';
	import {
		canonical,
		historyOptions,
		pushHistory,
		readHistory,
		resolveInput,
		suggest,
		targetPath,
		writeHistory,
		type Option
	} from '#lib/cmdline.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { watchlist } from '#lib/watchlist.svelte.ts';

	// Tus valores primero; después, las funciones y los valores populares.
	const ALL: Option[] = $derived([
		...watchlist.codes.map((code) => ({
			code,
			desc: TICKERS.find((t) => t.code === code)?.name ?? 'Tu lista',
			kind: 'Mi lista'
		})),
		...COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función', aliases: c.aliases })),
		...TICKERS.filter((t) => !watchlist.codes.includes(t.code)).map((t) => ({
			code: t.code,
			desc: t.name,
			kind: 'Valor'
		}))
	]);

	let value = $state('');
	let selected = $state(-1);
	let open = $state(false);
	// Si Sergi se ha movido con ↑ ↓, Intro abre la sugerencia marcada; si no, se decide con lo escrito.
	let moved = $state(false);
	let input: HTMLInputElement;
	// Últimos comandos ejecutados: se leen de localStorage al enfocar la barra (nunca al prerenderizar).
	let recent = $state<string[]>([]);

	// Con la barra vacía, el historial; al escribir, las sugerencias.
	const options = $derived(value.trim() ? suggest(value, ALL) : historyOptions(recent));

	// Al abrir la hoja desde la barra inferior del móvil, el cursor va directo a la barra.
	$effect(() => {
		if (ui.sheet) input.focus();
	});

	function run(raw: string) {
		// Se calcula antes de vaciar la barra: las sugerencias dependen de lo escrito.
		const target = resolveInput(raw, suggest(raw, ALL));
		ui.sheet = false;
		value = '';
		open = false;
		selected = -1;
		moved = false;
		input.blur();
		if (!target) return;
		recent = pushHistory(readHistory(), canonical(target));
		writeHistory(recent);
		const { route, search } = targetPath(target);
		goto(resolve(route) + search);
	}

	function onkeydown(e: KeyboardEvent) {
		const n = options.length;
		if (e.key === 'ArrowDown' && n) {
			e.preventDefault();
			open = true;
			moved = true;
			selected = (selected + 1) % n;
		} else if (e.key === 'ArrowUp' && n) {
			e.preventDefault();
			open = true;
			moved = true;
			selected = (selected - 1 + n) % n;
		} else if (e.key === 'Escape') {
			e.preventDefault();
			if (open && n) open = false;
			else if (value) value = '';
			else if (ui.sheet) {
				ui.sheet = false;
				input.blur();
			} else {
				input.blur();
				goto(resolve('/'));
			}
		}
	}

	/** Lo que se ejecuta al elegir una sugerencia: su código o, en el historial, la entrada guardada. */
	const pick = (o: Option) => o.run ?? o.code;

	function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		run(open && moved && selected >= 0 && options[selected] ? pick(options[selected]) : value);
	}

	/** Atajos de teclado en toda la página (como un listener en window en Vue, pero declarativo). */
	function onWindowKeydown(e: KeyboardEvent) {
		const tag = (document.activeElement?.tagName ?? '').toUpperCase();
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key === '/') {
			e.preventDefault();
			input.focus();
		} else if (e.key === 'Escape') {
			goto(resolve('/'));
		} else if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
			input.focus();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<form class="cmd" class:sheet={ui.sheet} role="search" autocomplete="off" {onsubmit}>
	<label class="prompt" for="cmd">&gt;<span class="sr">Comando</span></label>
	<input
		id="cmd"
		bind:this={input}
		bind:value
		oninput={() => {
			open = true;
			moved = false;
			selected = options.length ? 0 : -1;
		}}
		{onkeydown}
		onfocus={() => {
			recent = readHistory();
			open = true;
			moved = false;
			selected = -1;
		}}
		onblur={() =>
			setTimeout(() => {
				open = false;
				ui.sheet = false;
			}, 120)}
		type="text"
		spellcheck="false"
		autocapitalize="characters"
		enterkeyhint="go"
		placeholder="Escribe un comando o un valor: NVDA, ECO, BOE…"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={open && options.length > 0}
		aria-controls="suggest"
		aria-activedescendant={open && selected >= 0 ? `opt${selected}` : undefined}
	/>
	<button class="go" type="submit">GO</button>
	{#if open && options.length}
		<ul class="suggest" id="suggest" role="listbox" aria-label="Sugerencias">
			{#each options as o, i (pick(o) + o.kind)}
				<li
					role="option"
					id="opt{i}"
					aria-selected={i === selected}
					onmousedown={(e) => {
						e.preventDefault();
						run(pick(o));
					}}
				>
					<span class="code">{o.code}</span>
					<span class="desc">{o.desc}</span>
					<span class="kind">{o.kind}</span>
				</li>
			{/each}
		</ul>
	{/if}
</form>

<style>
	.cmd {
		position: relative;
		flex: 1 1 380px;
		min-width: 0;
		display: flex;
		align-items: stretch;
		height: var(--cmd-h);
		border: var(--border);
		background: var(--panel);
	}

	.cmd:focus-within {
		border-color: var(--amber);
	}

	.prompt {
		display: grid;
		place-items: center;
		padding-inline: var(--sp-10);
		color: var(--amber);
		font-weight: var(--fw-bold);
	}

	input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: 0;
		outline: none;
		font-size: var(--fs-m);
		text-transform: uppercase;
		letter-spacing: var(--track-tight);
	}

	input::placeholder {
		text-transform: none;
		letter-spacing: 0;
		color: var(--faint);
	}

	.go {
		background: var(--amber);
		color: var(--on-amber);
		border: 0;
		font-weight: var(--fw-bold);
		font-size: var(--fs-s);
		letter-spacing: var(--track-caps);
		padding-inline: var(--sp-14);
		cursor: pointer;
	}

	.suggest {
		position: absolute;
		left: calc(-1 * var(--hair));
		right: calc(-1 * var(--hair));
		top: 100%;
		z-index: 20;
		margin: 0;
		padding: var(--sp-4) 0;
		list-style: none;
		background: var(--raise);
		border: var(--hair) solid var(--amber);
		border-top-color: var(--line);
		max-height: 320px;
		overflow: auto;
	}

	/* Hoja desde abajo (móvil): la barra se pega encima de la barra inferior y las sugerencias se
	   abren hacia arriba, cerca del pulgar. */
	.cmd.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: calc(var(--tabbar-h) + var(--hair) + env(safe-area-inset-bottom, 0px));
		z-index: 40;
		height: var(--touch);
		border-width: var(--hair) 0 0;
		border-color: var(--amber);
	}

	.cmd.sheet .suggest {
		top: auto;
		bottom: 100%;
		border-top-color: var(--amber);
		border-bottom-color: var(--line);
		max-height: 50vh;
	}

	li {
		display: grid;
		grid-template-columns: 7ch minmax(0, 1fr) auto;
		gap: var(--sp-12);
		padding: var(--sp-6) var(--pad-x);
		cursor: pointer;
		align-items: baseline;
	}

	li[aria-selected='true'] {
		background: var(--amber-soft);
	}

	.code {
		color: var(--amber);
		font-weight: var(--fw-medium);
	}

	.desc {
		font-family: var(--sans);
		font-size: var(--fs-m);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kind {
		color: var(--faint);
		font-size: var(--fs-xs);
	}
</style>
