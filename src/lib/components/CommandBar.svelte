<!--
	Barra de comandos: escribes ECO, FUEL o un valor (NVDA) y se abre. Sugerencias con ↑ ↓ e Intro.
	También busca (como Ctrl+K) en titulares, BOE y valores: el índice se carga al enfocarla por primera vez.
	Atajos globales: «/» o empezar a escribir enfoca la barra; Esc vuelve a la portada; Mayús+F, pantalla completa.
-->
<script lang="ts">
	import { isShortcut } from '#lib/shortcuts.ts';
	import { routeHref } from '#lib/routes.ts';
	import { toggleFullscreen } from '#lib/fit.svelte.ts';
	import { keyboardInset, sheetRoom } from '#lib/keyboard.ts';
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isEmbedded } from '#lib/os/embed.ts';
	import { asset, resolve } from '$app/paths';
	import { COMMANDS } from '#lib/commands.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import {
		calcInput,
		canonical,
		didYouMean,
		findCommand,
		historyOptions,
		historyStep,
		pushHistory,
		readHistory,
		resolveInput,
		suggest,
		targetPath,
		writeHistory,
		type Option
	} from '#lib/cmdline.ts';
	import { argOptions } from '#lib/argcomplete.ts';
	import { answerFor, answerNeeds } from '#lib/bar/answers.ts';
	import { barData, loadBarData } from '#lib/bar/bardata.svelte.ts';
	import { compareInput, symbolRange } from '#lib/bar/ranges.ts';
	import { parseMulti } from '#lib/bar/multi.ts';
	import { addFav, favOptions, parseFav, readFavs, removeFav, writeFavs } from '#lib/bar/favs.ts';
	import { actionOption, parseAction } from '#lib/actions.ts';
	import { runAction } from '#lib/runaction.svelte.ts';
	import { parseConversion } from '#lib/calc.ts';
	import { fxLive, loadFxRates } from '#lib/fxlive.svelte.ts';
	import type { Dataset } from '#lib/data.ts';
	import { countryEntries, leaderEntries, prepare, searchOptions, type Indexed } from '#lib/search.ts';
	import type { SearchEntry } from '#lib/types.ts';
	import { isTyping } from '#lib/rownav.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { watchlist } from '#lib/watchlist.svelte.ts';

	const LEADER_OPTIONS = leaderEntries();
	const COUNTRY_OPTIONS = countryEntries();
	// Tus valores primero; después, las funciones, los líderes, los países y los valores populares.
	const ALL: Option[] = $derived([
		...watchlist.codes.map((code) => ({
			code,
			desc: TICKERS.find((t) => t.code === code)?.name ?? 'Tu lista',
			kind: 'Mi lista'
		})),
		...COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función', aliases: c.aliases })),
		...LEADER_OPTIONS,
		...COUNTRY_OPTIONS,
		...TICKERS.filter((t) => !watchlist.codes.includes(t.code)).map((t) => ({
			code: t.code,
			desc: t.name,
			kind: 'Valor'
		}))
	]);

	let value = $state('');
	/** Móvil táctil: la barra se presenta como un buscador (lupa, otro texto de ayuda, tecla «Buscar»). */
	let phone = $state(false);
	$effect(() => {
		const mq = matchMedia('(max-width: 720px) and (pointer: coarse)');
		phone = mq.matches;
		const on = () => (phone = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});
	// Teclado en pantalla: con la hoja abierta, la barra se sube encima del teclado y las sugerencias caben en lo que
	// queda a la vista (--kb-bottom y --kb-h en el formulario, que lee el CSS). Solo mientras la hoja está abierta: al
	// cerrarla se dejan de escuchar los eventos y se quitan las variables.
	let kb = $state<{ bottom: number; h: number } | null>(null);
	$effect(() => {
		const vv = window.visualViewport;
		if (!ui.sheet || !vv) return;
		// Mientras sale el teclado llegan muchos eventos: solo se toca la página si cambia algo.
		let last = '';
		const fit = () => {
			const next = keyboardInset(vv, innerHeight);
			const key = next ? `${next.bottom} ${next.h}` : '';
			if (key !== last) ((last = key), (kb = next));
		};
		fit();
		vv.addEventListener('resize', fit);
		vv.addEventListener('scroll', fit);
		return () => {
			vv.removeEventListener('resize', fit);
			vv.removeEventListener('scroll', fit);
			kb = null;
		};
	});
	// Alto para las sugerencias (--kb-h): lo que se ve menos lo que la hoja deja debajo. La hoja va en max(barra
	// inferior, teclado) y cada estética le pone su margen, así que se mide dónde ha quedado (los $effect corren con
	// --kb-bottom ya aplicado) en vez de repetir aquí sus cuentas.
	let form = $state<HTMLFormElement>();
	let room = $state<number | null>(null);
	$effect(() => {
		room = kb && form ? sheetRoom(kb, innerHeight - form.getBoundingClientRect().bottom) : null;
	});
	let selected = $state(-1);
	let open = $state(false);
	// Si Sergi se ha movido con ↑ ↓, Intro abre la sugerencia marcada; si no, se decide con lo escrito.
	let moved = $state(false);
	let input: HTMLInputElement;
	// Últimos comandos ejecutados: se leen de localStorage al enfocar la barra (nunca al prerenderizar).
	let recent = $state<string[]>([]);
	// ↑ con la barra vacía recorre el historial como en un terminal: posición actual (−1, sin recorrerlo).
	let histIdx = $state(-1);
	// «ECO; WS CURVA»: lo que queda por abrir y cuántos eran (Intro con la barra vacía abre el siguiente).
	let queue = $state<string[]>([]);
	let queueTotal = $state(0);
	// Si navegas por otro camino (una pestaña, un enlace, atrás), la cola se olvida: solo la barra la sigue.
	let barNav = false;
	afterNavigate(() => {
		if (!barNav) queue = [];
		barNav = false;
	});
	// Favoritos («fav ECO TIPOS», «1»), también de localStorage.
	let favs = $state<string[]>([]);
	// Última zona de FUEL (para «llenar 50L» y «diésel»); se lee al enfocar la barra.
	let fuelZone = $state<string | null>(null);
	// Hora de la respuesta: se fija al escribir, para que «hora tokio» no cambie mientras se mira.
	let now = $state(0);

	// «euribor», «hipoteca 150000 25a», «hora tokio»…: el dato, como primera sugerencia (lote 27-A).
	const answer = $derived(value.trim() ? answerFor(value, { get: (n) => barData[n], now: now || Date.now(), fuelZone }) : null);
	const multi = $derived(parseMulti(value));
	// «NVDA 1a», «NVDA vs AMD»: la ficha o CMP con ese rango.
	const chart = $derived(value.trim() ? (compareInput(value) ?? symbolRange(value)) : null);
	$effect(() => {
		loadBarData(answerNeeds(value, fuelZone));
	});

	// Índice de búsqueda (static/data/search.json). null hasta que se enfoca la barra la primera vez: se
	// pide en ese momento a /data/search.json, no al cargar la página. No va dentro del código (ni con
	// import.meta.glob ni con dataset() de data.ts): cambia con cada pasada de datos y arrastraría el
	// nombre de la barra y de todas las vistas en cada publicación.
	let index = $state.raw<Indexed[] | null>(null);
	let indexRequested = false;
	function loadIndex() {
		if (indexRequested) return;
		indexRequested = true;
		fetch(asset('data/search.json' as Parameters<typeof asset>[0]))
			.then((res) => (res.ok ? (res.json() as Promise<Dataset<SearchEntry[]>>) : null))
			.then((d) => {
				const data = d?.data;
				index = prepare(Array.isArray(data) ? data : []);
			})
			.catch(() => (index = []));
	}

	// Con la barra vacía, el historial; al escribir, las sugerencias y debajo los resultados de búsqueda.
	// Tras un comando y un espacio («LIDER », «PAIS ale»), las opciones de su argumento.
	// «compartir WS», «+NVDA»…: una acción (27-B), como única sugerencia.
	const action = $derived(parseAction(value));
	const suggestions = $derived(
		!value.trim()
			? historyOptions(recent)
			: action
				? [actionOption(action, value, ALL)]
				: answer
					? [{ code: answer.code, desc: answer.desc, kind: 'Dato', run: answer.open ?? value.trim() }]
					: chart
						? [{ code: chart.code, desc: chart.desc, kind: 'Gráfico', run: value.trim() }]
						: multi
							? [{ code: `${multi.length} VISTAS`, desc: `${multi.join(' → ')} · Alt+→ abre la siguiente`, kind: 'Varios', run: value.trim() }]
					: (favOptions(value, favs) ?? argOptions(value) ?? suggest(value, ALL, 8, fxLive))
	);
	// M46: al escribir «100 USD EUR», se descargan los cambios del BCE (una sola vez).
	$effect(() => {
		if (parseConversion(value)) loadFxRates();
	});
	const results = $derived(searchOptions(value, suggestions, index));
	// Erratas («GOE», «ECOO»): si nada encaja, «Quizá GEO» entre las sugerencias y la búsqueda. Solo en la barra:
	// suggest() no cambia, así que la Terminal y el Spotlight de Arc OS siguen igual.
	const hints = $derived(!suggestions.length && value.trim() ? didYouMean(value, ALL) : []);
	const options = $derived([...suggestions, ...hints, ...results]);
	/** Dónde empiezan los resultados de búsqueda, que van separados por una línea. */
	const firstHit = $derived(suggestions.length + hints.length);

	// Al abrir la hoja desde la barra inferior del móvil, el cursor va directo a la barra.
	$effect(() => {
		if (ui.sheet) input.focus();
	});

	function close() {
		ui.sheet = false;
		value = '';
		open = false;
		selected = -1;
		moved = false;
		histIdx = -1;
		input.blur();
	}

	// Aviso breve en la barra tras una acción («Enlace copiado»): ocupa el sitio del texto de ayuda.
	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	function flash(text: string) {
		notice = text;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 2500);
	}

	/** «fav …» y los números: guarda, quita o abre un favorito. true si lo ha atendido. */
	function runFav(raw: string): boolean {
		const a = parseFav(raw);
		if (!a) return false;
		favs = readFavs();
		if (a.kind === 'open') {
			const entry = favs[a.n - 1];
			// Sin ese favorito, el número no abre otra cosa al azar (la primera sugerencia que lo contenga).
			if (!entry) {
				value = '';
				flash(`No tienes el favorito ${a.n} · guárdalo con «fav ECO»`);
				return true;
			}
			run(entry);
			return true;
		}
		if (a.kind === 'add') {
			const { list, n } = addFav(favs, a.entry);
			favs = list;
			writeFavs(list);
			flash(n ? `Favorito ${n}: ${a.entry} · escribe ${n} para abrirlo` : `Ya tienes 9 favoritos: quita uno con «fav -1»`);
		} else if (a.kind === 'remove') {
			favs = removeFav(favs, a.n);
			writeFavs(favs);
			flash(`Quitado el favorito ${a.n}`);
		} else {
			// «fav» a secas: la lista se ve en las sugerencias; Intro no hace nada más.
			return true;
		}
		value = '';
		open = false;
		return true;
	}

	/** `fromQueue`: lo abre la cola de «ECO; WS CURVA»; cualquier otro comando la vacía. */
	function run(raw: string, fromQueue = false) {
		// «ECO; WS CURVA»: abre el primero y deja los demás en cola. Con la barra vacía, Intro abre el siguiente.
		const many = parseMulti(raw);
		if (many) {
			run(many[0], true);
			queue = many.slice(1);
			queueTotal = many.length;
			recent = pushHistory(readHistory(), raw.trim());
			writeHistory(recent);
			return;
		}
		if (!raw.trim() && queue.length) {
			const [next, ...rest] = queue;
			queue = rest;
			// Una respuesta sin vista («hora tokio») se escribe en la barra para que se vea.
			const ans = answerFor(next, { get: (n) => barData[n], now: Date.now(), fuelZone });
			if (ans && !ans.open) {
				value = next;
				open = true;
				return;
			}
			run(next, true);
			return;
		}
		if (!fromQueue) queue = [];
		// Acciones (27-B): «compartir WS», «+NVDA», «vigila aranceles», «alerta NVDA > 150».
		if (parseAction(raw)) {
			close();
			runAction(raw, ALL, flash);
			return;
		}
		if (runFav(raw)) return;
		// Una respuesta abre su vista (Intro en «euribor» → ECO); sin vista («hora tokio»), no hace nada.
		const ans = answerFor(raw, { get: (n) => barData[n], now: Date.now(), fuelZone });
		if (ans) {
			if (ans.open) run(ans.open, true);
			return;
		}
		const ct = compareInput(raw) ?? symbolRange(raw);
		if (ct) {
			close();
			recent = pushHistory(readHistory(), raw.trim());
			writeHistory(recent);
			barNav = true;
			goto(routeHref(ct.route) + ct.search);
			return;
		}
		// M46: una cuenta o una conversión no abren nada; la cuenta deja su resultado para seguir calculando.
		const calc = calcInput(raw, fxLive);
		if (calc) {
			if (calc.next) value = calc.next;
			return;
		}
		// Se calcula antes de vaciar la barra: las sugerencias dependen de lo escrito.
		const target = resolveInput(raw, suggest(raw, ALL));
		close();
		if (!target) return;
		recent = pushHistory(readHistory(), canonical(target));
		writeHistory(recent);
		const { route, search } = targetPath(target);
		barNav = true;
		goto(routeHref(route) + search);
	}

	function onkeydown(e: KeyboardEvent) {
		const n = options.length;
		// ↑ con la barra vacía (o recorriendo ya el historial) trae el comando anterior; ↓, el siguiente.
		const browsing = histIdx >= 0 && value === recent[histIdx];
		// Si ya te mueves por la lista del historial con ↓, ↑ sube en la lista (no trae el último a la barra).
		if ((e.key === 'ArrowUp' && ((!value && !moved) || browsing)) || (e.key === 'ArrowDown' && browsing)) {
			e.preventDefault();
			const step = historyStep(recent, browsing ? histIdx : -1, e.key === 'ArrowUp' ? 1 : -1);
			histIdx = step.idx;
			value = step.value;
			open = false;
			moved = false;
			selected = -1;
		} else if (e.key === 'ArrowDown' && n) {
			e.preventDefault();
			open = true;
			moved = true;
			selected = (selected + 1) % n;
		} else if (e.key === 'ArrowUp' && n) {
			e.preventDefault();
			open = true;
			moved = true;
			selected = (selected - 1 + n) % n;
		} else if (isShortcut(e, 'complete') && !e.shiftKey && n && value.trim()) {
			// Tab completa la barra con la sugerencia marcada (o la primera) sin abrirla. Si es un comando
			// que acepta texto, deja un espacio: así salen sus opciones («LID» → «LIDER »). Con una pista («TECK»)
			// y sin moverse con ↑ ↓, la pista, aunque lo marcado sea lo que abre Intro.
			const o = !moved && hints.length ? hints[0] : options[selected >= 0 ? selected : 0];
			if (o.url) return;
			e.preventDefault();
			const text = pick(o);
			const command = findCommand(text);
			value = command?.arg && text === command.code ? `${text} ` : text;
			open = true;
			moved = false;
			selected = 0;
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

	/** Abre una opción: un titular o el BOE, en una pestaña nueva; lo demás, como un comando. */
	function choose(o: Option) {
		if (!o.url) return run(pick(o));
		window.open(o.url, '_blank', 'noopener');
		close();
	}

	function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		if (open && moved && selected >= 0 && options[selected]) choose(options[selected]);
		// Una errata clara («ECOO», «FEUL»: letras cambiadas de sitio o una repetida) abre lo que querías decir.
		else if (hints[0]?.sure) choose(hints[0]);
		// Sin sugerencias de comandos, Intro abre el primer resultado de búsqueda (si lo hay).
		else if (!suggestions.length && results.length) choose(results[0]);
		else run(value);
	}

	/** Atajos de teclado en toda la página (como un listener en window en Vue, pero declarativo). */
	function onWindowKeydown(e: KeyboardEvent) {
		// En el Modo OS la barra no está a la vista: ni en /os ni en una vista dentro de una ventana (allí manda
		// el teclado de la ventana y Esc no debe sacarte del escritorio).
		if (page.route.id === '/os' || isEmbedded()) return;
		const typing = isTyping(document.activeElement);
		// Alt+→ con una cola de «ECO; WS CURVA»: la siguiente vista (también con el foco en la barra, pero no en otro
		// campo: allí ⌥→ salta de palabra).
		if (queue.length && isShortcut(e, 'queue') && (!typing || document.activeElement === input)) {
			e.preventDefault();
			run('');
			return;
		}
		if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
		if (isShortcut(e, 'bar')) {
			e.preventDefault();
			input.focus();
		} else if (isShortcut(e, 'fullscreen')) {
			// Mayúsculas + F: pantalla completa. La f sola sigue escribiendo comandos (FUEL…).
			e.preventDefault();
			toggleFullscreen();
		} else if (isShortcut(e, 'home')) {
			// Esc que ya ha cerrado otra cosa (un ⓘ, una hoja, un menú) no te saca de la vista.
			if (e.defaultPrevented || document.querySelector('dialog[open], [role=dialog]')) return;
			goto(resolve('/'));
		} else if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
			input.focus();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<form
	class="cmd"
	data-ui="cmd"
	class:sheet={ui.sheet}
	bind:this={form}
	style:--kb-bottom={kb ? `${kb.bottom}px` : undefined}
	style:--kb-h={room !== null ? `${room}px` : undefined}
	role="search"
	autocomplete="off"
	{onsubmit}
>
	<label class="prompt" for="cmd">
		<span class="caret" aria-hidden="true">&gt;</span>
		<!-- En el móvil, una lupa: la barra se usa como un buscador normal. -->
		<svg class="lens" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>
		<span class="sr">Comando o búsqueda</span>
	</label>
	<input
		id="cmd"
		bind:this={input}
		bind:value
		oninput={() => {
			now = Date.now();
			histIdx = -1;
			open = true;
			moved = false;
			// Se marca lo que abre Intro. Con una pista dudosa («TECK» → TECH), Intro sigue abriendo el primer resultado
			// (la ficha o la búsqueda, como antes): se marca ese, y la pista sale arriba sin marcar (Tab la completa).
			selected = hints.length && !hints[0].sure ? (results.length ? firstHit : -1) : options.length ? 0 : -1;
		}}
		{onkeydown}
		onfocus={() => {
			loadIndex();
			recent = readHistory();
			favs = readFavs();
			try {
				fuelZone = localStorage.getItem('fuel-zone');
			} catch {}
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
		autocorrect="off"
		autocapitalize="characters"
		enterkeyhint={phone ? 'search' : 'go'}
		placeholder={notice ||
			(queue.length
				? `${queueTotal - queue.length}/${queueTotal} · Alt+→ siguiente: ${queue[0]}`
				: phone
					? 'Busca un valor o una vista'
					: 'Escribe un comando o un valor: NVDA, ECO, BOE…')}
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={open && options.length > 0}
		aria-controls="suggest"
		aria-activedescendant={open && selected >= 0 ? `opt${selected}` : undefined}
	/>
	<button class="go" type="submit">GO</button>
	{#if open && options.length}
		<ul class="suggest" id="suggest" role="listbox" aria-label="Sugerencias">
			{#each options as o, i (o.url ?? pick(o) + o.kind)}
				{#if o.url}
					<!-- Titular o BOE: un enlace de verdad (pestaña nueva), para que también funcione la pulsación
					     larga o el clic central. mousedown sin efecto: la barra no pierde el foco antes del clic. -->
					<li
						role="option"
						id="opt{i}"
						class="hit"
						class:first={i === firstHit && i > 0}
						aria-selected={i === selected}
						onmousedown={(e) => e.preventDefault()}
					>
						<a href={o.url} target="_blank" rel="noopener" onclick={close}>
							<span class="code">{o.code}</span>
							<span class="desc">{o.desc}</span>
							<span class="kind" aria-label="Se abre en otra pestaña">{o.kind}</span>
						</a>
					</li>
				{:else}
					<li
						role="option"
						id="opt{i}"
						class:hit={i >= firstHit}
						class:answer={o.kind === 'Dato'}
						class:first={i === firstHit && i > 0}
						aria-selected={i === selected}
						onmousedown={(e) => {
							e.preventDefault();
							if (e.button === 0) choose(o);
						}}
					>
						<span class="code">{o.code}</span>
						<span class="desc">{o.desc}</span>
						<span class="kind">{o.kind}</span>
					</li>
				{/if}
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
		border-radius: var(--radius-s);
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

	.lens {
		display: none;
		width: var(--sp-16);
		height: var(--sp-16);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	@media (max-width: 720px) and (pointer: coarse) {
		.caret {
			display: none;
		}

		.lens {
			display: block;
		}

		.prompt {
			color: var(--muted);
		}

		.cmd {
			height: var(--touch);
		}
	}

	input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: 0;
		outline: none;
		font-size: var(--fs-field);
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
		/* Llena la barra sin el mínimo táctil de .go (app.css): con él sobresalía 1 px por debajo del borde. */
		min-height: 0;
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
	   abren hacia arriba, cerca del pulgar. Con el teclado en pantalla (--kb-bottom), justo encima de él. */
	.cmd.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: max(calc(var(--tabbar-h) + var(--hair) + env(safe-area-inset-bottom, 0px)), var(--kb-bottom, 0px));
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
		/* Con el teclado, caben en lo que queda a la vista sobre el campo (--kb-h: lo visible menos lo que la hoja deja
		   debajo, como la barra de pestañas), con aire para el margen que les dan algunas estéticas. Sin teclado, la
		   mitad de la pantalla, como siempre. */
		max-height: min(50vh, calc(var(--kb-h, 100vh) - var(--touch) - var(--sp-24)));
	}

	li,
	li a {
		display: grid;
		grid-template-columns: 7ch minmax(0, 1fr) auto;
		gap: var(--sp-12);
		padding: var(--sp-6) var(--pad-x);
		cursor: pointer;
		align-items: baseline;
	}

	/* Dentro del enlace la rejilla es la del li: el li no añade relleno. */
	li.hit:has(> a) {
		display: block;
		padding: 0;
	}

	li a {
		color: inherit;
		text-decoration: none;
	}

	/* Separación fina entre las sugerencias de comandos y los resultados de búsqueda. */
	li.first {
		border-top: var(--border);
		margin-top: var(--sp-4);
	}

	li[aria-selected='true'] {
		background: var(--amber-soft);
	}

	/* En la fila elegida, el código y el tipo van del color del texto: el ámbar y el gris claro no se leían bien sobre
	   el fondo suave. Lo hereda de la fila, así también vale donde una estética la invierte (suizo). */
	li[aria-selected='true'] .code,
	li[aria-selected='true'] .kind {
		color: inherit;
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

	/* Una respuesta («euribor», «hipoteca …») se lee entera: puede ocupar dos líneas. */
	.answer .desc {
		white-space: normal;
	}

	/* --muted y no --faint: con letra pequeña sobre --raise, --faint no llegaba a 4,5:1 en varias estéticas. */
	.kind {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
</style>
