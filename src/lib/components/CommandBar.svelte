<!--
	Barra de comandos: escribes ECO, FUEL o un valor (NVDA) y se abre. Sugerencias con ↑ ↓ e Intro.
	Atajos globales: «/» o empezar a escribir enfoca la barra; Esc vuelve a la portada.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { COMMANDS, TICKERS } from '#lib/commands.ts';

	interface Option {
		code: string;
		desc: string;
		kind: string;
	}

	const ALL: Option[] = [
		...COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función' })),
		...TICKERS.map((t) => ({ code: t.code, desc: t.name, kind: 'Valor' }))
	];

	let value = $state('');
	let selected = $state(-1);
	let open = $state(false);
	let input: HTMLInputElement;

	/** Sin tildes y en mayúsculas, para comparar. */
	const norm = (s: string) =>
		s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

	const options = $derived.by(() => {
		const q = norm(value);
		if (!q) return [];
		const starts = ALL.filter((o) => o.code.startsWith(q));
		const contains = ALL.filter((o) => !o.code.startsWith(q) && norm(o.desc).includes(q));
		return [...starts, ...contains].slice(0, 8);
	});

	function run(raw: string) {
		const code = norm(raw);
		value = '';
		open = false;
		selected = -1;
		input.blur();
		if (!code) return;
		const command = COMMANDS.find((c) => c.code === code);
		if (command) goto(resolve(command.route));
		else goto(`${resolve('/s')}?sym=${encodeURIComponent(code)}`);
	}

	function onkeydown(e: KeyboardEvent) {
		const n = options.length;
		if (e.key === 'ArrowDown' && n) {
			e.preventDefault();
			open = true;
			selected = (selected + 1) % n;
		} else if (e.key === 'ArrowUp' && n) {
			e.preventDefault();
			open = true;
			selected = (selected - 1 + n) % n;
		} else if (e.key === 'Escape') {
			e.preventDefault();
			if (open && n) open = false;
			else if (value) value = '';
			else {
				input.blur();
				goto(resolve('/'));
			}
		}
	}

	function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		run(open && selected >= 0 && options[selected] ? options[selected].code : value);
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

<form class="cmd" role="search" autocomplete="off" {onsubmit}>
	<label class="prompt" for="cmd">&gt;<span class="sr">Comando</span></label>
	<input
		id="cmd"
		bind:this={input}
		bind:value
		oninput={() => {
			open = true;
			selected = options.length ? 0 : -1;
		}}
		{onkeydown}
		onblur={() => setTimeout(() => (open = false), 120)}
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
			{#each options as o, i (o.code + o.kind)}
				<li
					role="option"
					id="opt{i}"
					aria-selected={i === selected}
					onmousedown={(e) => {
						e.preventDefault();
						run(o.code);
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
		height: 34px;
		border: 1px solid var(--line);
		background: var(--panel);
	}

	.cmd:focus-within {
		border-color: var(--amber);
	}

	.prompt {
		display: grid;
		place-items: center;
		padding-inline: 10px;
		color: var(--amber);
		font-weight: 600;
	}

	input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: 0;
		outline: none;
		font-size: var(--fs-m);
		text-transform: uppercase;
		letter-spacing: 0.04em;
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
		font-weight: 600;
		font-size: var(--fs-s);
		letter-spacing: 0.08em;
		padding-inline: 14px;
		cursor: pointer;
	}

	.suggest {
		position: absolute;
		left: -1px;
		right: -1px;
		top: 100%;
		z-index: 20;
		margin: 0;
		padding: 4px 0;
		list-style: none;
		background: var(--raise);
		border: 1px solid var(--amber);
		border-top-color: var(--line);
		max-height: 320px;
		overflow: auto;
	}

	li {
		display: grid;
		grid-template-columns: 7ch minmax(0, 1fr) auto;
		gap: 12px;
		padding: 6px 12px;
		cursor: pointer;
		align-items: baseline;
	}

	li[aria-selected='true'] {
		background: var(--amber-soft);
	}

	.code {
		color: var(--amber);
		font-weight: 500;
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
