<!--
	CHESS: partida de ajedrez contra Stockfish (o entre dos personas en el mismo dispositivo). Las reglas las
	pone chess.js; el tablero es nuestro (Board.svelte); el motor va en un Web Worker (engine.ts).
	La partida es una lista de jugadas en $state: todo lo demás (posición, historial, final) se deriva de
	ella, como un computed de Vue. Se guarda en este navegador después de cada jugada.
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { asset } from '$app/paths';
	import Board from '#lib/components/Board.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import {
		PRESETS,
		afterMove,
		flagged,
		formatClock,
		makeClock,
		pause,
		remaining,
		type Preset
	} from '#lib/chess/clock.ts';
	import { ENGINE_FILE, ENGINE_SOURCE, Engine, type EngineWorker } from '#lib/chess/engine.ts';
	import {
		checkSquare,
		colorName,
		destinations,
		movePairs,
		other,
		outcome,
		replay,
		resultTag,
		statusText,
		type Color,
		type PieceSymbol,
		type Square,
		type Uci
	} from '#lib/chess/game.ts';
	import { emptyGame, loadGame, saveGame, type SavedGame } from '#lib/chess/save.ts';
	import { HINT, LEVELS, formatScore, scoreToBar, type Score } from '#lib/chess/uci.ts';

	const HUMAN = 'human';

	let game = $state<SavedGame>(emptyGame());
	let ready = $state(false);
	let preset = $state<Preset>('none');
	/** Bando con el que jugarás la próxima partida (o esta, si aún no ha empezado). */
	let side = $state<Color>('w');
	let now = $state(Date.now());
	/** Botón que espera la segunda pulsación para confirmar («Nueva», «Abandonar»). */
	let confirming = $state<'new' | 'resign' | null>(null);
	let copied = $state(false);
	let moveList = $state<HTMLDivElement>();

	// Motor: se crea al entrar en la vista y se cierra al salir.
	let engine: Engine | null = null;
	let engineState = $state<'loading' | 'ready' | 'error'>('loading');
	let thinking = $state(false);
	let hinting = $state(false);
	let hint = $state<[Square, Square] | null>(null);
	let evalScore = $state<Score | null>(null);

	const chess = $derived(replay(game.moves));
	const history = $derived(chess.history({ verbose: true }));
	const pairs = $derived(movePairs(history.map((m) => m.san)));
	const end = $derived(outcome(chess, game));
	const turn = $derived(chess.turn());
	const last = $derived(history.at(-1));
	const status = $derived(statusText(chess, end));
	/** Nivel del motor, o null si el rival es una persona. */
	const level = $derived(LEVELS.find((l) => l.value === game.rival) ?? null);
	const engineTurn = $derived(!!level && !end && turn !== game.human);
	const movable = $derived(!ready || end ? null : level ? (engineTurn ? null : game.human) : turn);

	onMount(() => {
		const saved = loadGame();
		if (saved) {
			game = saved;
			preset = presetOf(saved);
			side = saved.human;
		}
		ready = true;
		engine = new Engine(() => new Worker(asset(ENGINE_FILE as Parameters<typeof asset>[0])) as unknown as EngineWorker);
		engine.init().then(
			() => (engineState = 'ready'),
			() => (engineState = 'error')
		);
	});

	onDestroy(() => engine?.destroy());

	// Guardar después de cada cambio (snapshot: una copia plana, sin el proxy de $state).
	$effect(() => {
		if (ready) saveGame($state.snapshot(game));
	});

	// Turno del motor: busca y juega. Si la partida cambia mientras piensa (deshacer, nueva…), el $effect
	// se vuelve a ejecutar, la limpieza para la búsqueda y su jugada se descarta.
	$effect(() => {
		if (!ready || !engineTurn || !level || !engine || engineState === 'error') return;
		const moves = [...game.moves];
		const mover = turn;
		thinking = true;
		engine
			.search(moves, mover, level, (info) => (evalScore = info.score))
			.then((r) => {
				if (!r || game.moves.join() !== moves.join()) return;
				thinking = false;
				if (r.best) play(r.best);
			})
			.catch(() => {
				engineState = 'error';
				thinking = false;
			});
		return () => {
			thinking = false;
			engine?.stop();
		};
	});

	// El reloj: un tic cada décima mientras corre. Si un bando llega a cero, pierde.
	$effect(() => {
		if (!game.clock || game.clock.since === null || end) return;
		const id = setInterval(() => {
			now = Date.now();
			if (game.clock && flagged(game.clock, turn, now)) {
				game.flagged = turn;
				game.clock = pause(game.clock, turn, now);
			}
		}, 100);
		return () => clearInterval(id);
	});

	// La lista de jugadas baja sola hasta la última.
	$effect(() => {
		void pairs.length;
		const scroller = moveList?.querySelector('.scroll');
		scroller?.scrollTo({ top: scroller.scrollHeight });
	});

	function presetOf(g: SavedGame): Preset {
		if (!g.clock) return 'none';
		const key = `${g.clock.base / 60_000}+${g.clock.inc / 1000}`;
		return PRESETS.find((p) => p.value === key)?.value ?? 'none';
	}

	/** Añade una jugada (del jugador o del motor) y mueve el reloj. */
	function play(uci: Uci) {
		if (end) return;
		const mover = turn;
		hint = null;
		game.moves = [...game.moves, uci];
		const t = Date.now();
		now = t;
		if (game.clock) {
			game.clock = afterMove(game.clock, mover, t);
			// Si la jugada acaba la partida, el reloj se para.
			if (outcome(replay(game.moves))) game.clock = pause(game.clock, other(mover), t);
		}
	}

	function onmove(from: Square, to: Square, promotion?: PieceSymbol) {
		play(`${from}${to}${promotion ?? ''}`);
	}

	/** Contra el motor, deshacer vuelve a tu turno anterior: quita su jugada y la tuya. */
	const undoCount = $derived(level && turn === game.human ? 2 : 1);
	const canUndo = $derived(
		game.moves.length >= undoCount && !(level && game.moves.length - undoCount === 0 && game.human === 'b')
	);

	function undo() {
		if (!canUndo) return;
		game.moves = game.moves.slice(0, -undoCount);
		game.resigned = null;
		game.flagged = null;
		hint = null;
		evalScore = null;
		if (game.clock && game.clock.since !== null) game.clock = { ...game.clock, since: Date.now() };
	}

	function flip() {
		game.orientation = other(game.orientation);
	}

	/** Las acciones que no se pueden deshacer piden una segunda pulsación en 3 s. */
	function confirm(action: 'new' | 'resign', run: () => void) {
		if (confirming === action || (action === 'new' && !game.moves.length)) {
			confirming = null;
			run();
			return;
		}
		confirming = action;
		setTimeout(() => {
			if (confirming === action) confirming = null;
		}, 3000);
	}

	function newGame() {
		game = emptyGame({ clock: makeClock(preset), rival: game.rival, human: side });
		hint = null;
		evalScore = null;
	}

	function resign() {
		game.resigned = level ? game.human : turn;
		if (game.clock) game.clock = pause(game.clock, turn, Date.now());
	}

	function changePreset(value: string) {
		preset = value as Preset;
		// Sin jugadas todavía, el reloj nuevo vale para esta misma partida.
		if (!game.moves.length) game.clock = makeClock(preset);
	}

	/** El rival cambia al momento, también a mitad de partida. */
	function changeRival(value: string) {
		game.rival = value;
		hint = null;
	}

	// El bando elegido vale para esta partida si aún no ha empezado; si no, para la próxima.
	$effect(() => {
		const s = side;
		if (ready && !game.moves.length && game.human !== s) {
			game.human = s;
			game.orientation = s;
		}
	});

	async function askHint() {
		if (!engine || hinting || end || engineTurn) return;
		hinting = true;
		const moves = [...game.moves];
		try {
			const r = await engine.search(moves, turn, HINT, (info) => (evalScore = info.score));
			if (r?.best && game.moves.join() === moves.join())
				hint = [r.best.slice(0, 2) as Square, r.best.slice(2, 4) as Square];
		} catch {
			engineState = 'error';
		}
		hinting = false;
	}

	async function copyPgn() {
		chess.setHeader('Event', 'Arc Terminal');
		chess.setHeader('Date', new Date().toISOString().slice(0, 10).replaceAll('-', '.'));
		if (level) {
			const bot = `Stockfish (${level.label})`;
			chess.setHeader('White', game.human === 'w' ? 'Jugador' : bot);
			chess.setHeader('Black', game.human === 'b' ? 'Jugador' : bot);
		}
		chess.setHeader('Result', resultTag(end));
		try {
			await navigator.clipboard.writeText(chess.pgn());
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {}
	}

	const clockOf = (c: Color) => (game.clock ? formatClock(remaining(game.clock, c, turn, now)) : '');
	const running = (c: Color) => !end && turn === c && !!game.clock && game.clock.since !== null;
	/** Nombre en la barra del jugador. */
	function nameOf(c: Color): string {
		if (!level) return colorName(c);
		return c === game.human ? `Tú · ${colorName(c)}` : `Stockfish · ${level.label}`;
	}
	const bar = $derived(evalScore ? scoreToBar(evalScore) : 0.5);
	const showEval = $derived(!!level || !!evalScore);
</script>

<ViewHeader
	code="CHESS"
	title="Ajedrez"
	sub="Contra Stockfish o a dos en este dispositivo · la partida se guarda en el navegador"
/>

<!-- Barra de un jugador, encima o debajo del tablero: bando, si el motor piensa, y reloj. -->
{#snippet player(c: Color)}
	<div class="player" class:on={!end && turn === c}>
		<span class="who">
			<i class="mark {c}" aria-hidden="true"></i><span class="name">{nameOf(c)}</span>
			{#if level && c !== game.human}
				{#if engineState === 'loading'}<span class="mut">· cargando motor…</span>
				{:else if engineState === 'error'}<span class="mut">· el motor no ha cargado</span>
				{:else if thinking}<span class="think">· pensando…</span>{/if}
			{/if}
		</span>
		{#if game.clock}<b class="time" class:run={running(c)}>{clockOf(c)}</b>{/if}
	</div>
{/snippet}

<div class="grid chess">
	<div class="col">
		<Panel title="Partida" meta={status}>
			{@render player(other(game.orientation))}
			<div class="board">
				<Board
					fen={chess.fen()}
					orientation={game.orientation}
					{movable}
					dests={destinations(chess)}
					lastMove={last ? [last.from, last.to] : null}
					check={checkSquare(chess)}
					arrow={hint}
					{onmove}
				/>
				{#if showEval}
					<!-- Barra de evaluación: la parte de las blancas crece desde su lado del tablero. -->
					<div
						class="eval"
						class:flip={game.orientation === 'b'}
						title={evalScore ? `Evaluación: ${formatScore(evalScore)}` : 'Evaluación'}
						aria-hidden="true"
					>
						<i style:height="{(bar * 100).toFixed(1)}%"></i>
					</div>
				{/if}
			</div>
			{@render player(game.orientation)}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Controles" meta={evalScore ? `Eval. ${formatScore(evalScore)}` : undefined}>
			<div class="ops">
				<button type="button" onclick={undo} disabled={!canUndo}>Deshacer</button>
				<button type="button" onclick={askHint} disabled={!!end || engineTurn || hinting || engineState !== 'ready'}>
					{hinting ? 'Pensando…' : 'Pista'}
				</button>
				<button type="button" onclick={flip}>Girar</button>
				<button type="button" class:warn={confirming === 'new'} onclick={() => confirm('new', newGame)}>
					{confirming === 'new' ? '¿Seguro?' : 'Nueva'}
				</button>
				<button
					type="button"
					class:warn={confirming === 'resign'}
					onclick={() => confirm('resign', resign)}
					disabled={!!end || !game.moves.length}
				>
					{confirming === 'resign' ? '¿Seguro?' : 'Abandonar'}
				</button>
			</div>
			<div class="opts">
				<Select label="Rival" value={game.rival} onchange={changeRival}>
					{#each LEVELS as l (l.value)}<option value={l.value}>{l.label}</option>{/each}
					<option value={HUMAN}>Persona</option>
				</Select>
				{#if level}<Seg
						label="Juegas con"
						options={[
							{ value: 'w', label: 'Blancas' },
							{ value: 'b', label: 'Negras' }
						]}
						bind:value={side}
					/>{/if}
				<Select label="Reloj" value={preset} onchange={changePreset}>
					{#each PRESETS as p (p.value)}<option value={p.value}>{p.label}</option>{/each}
				</Select>
				<button type="button" class="link" onclick={copyPgn} disabled={!game.moves.length}
					>{copied ? 'PGN copiado' : 'Copiar PGN'}</button
				>
			</div>
			{#snippet note()}
				{#if game.moves.length && (preset !== presetOf(game) || (level && side !== game.human))}Los cambios de reloj y
					de bando valen desde la próxima partida.
				{/if}Motor: <a href={ENGINE_SOURCE} target="_blank" rel="noopener">Stockfish 17.1</a> en WebAssembly (versión
				ligera), un programa aparte con licencia
				<a href={asset('engine/license.txt' as Parameters<typeof asset>[0])} target="_blank" rel="noopener">GPL-3.0</a>;
				se descarga la primera vez (unos 7 MB). Reglas:
				<a href="https://github.com/jhlywa/chess.js" target="_blank" rel="noopener">chess.js</a> (BSD-2).
			{/snippet}
		</Panel>
		<Panel title="Jugadas" meta={end ? resultTag(end) : `${history.length} medias jugadas`}>
			{#if pairs.length}
				<div class="moves" bind:this={moveList}>
					<Table maxHeight="420px">
						<thead><tr><th>Nº</th><th class="l">Blancas</th><th class="l">Negras</th></tr></thead>
						<tbody>
							{#each pairs as p, i (p.n)}
								{@const lastRow = i === pairs.length - 1}
								<tr>
									<td class="mut">{p.n}.</td>
									<td class="l" class:cur={lastRow && !p.b}>{p.w}</td>
									<td class="l" class:cur={lastRow && !!p.b}>{p.b ?? ''}</td>
								</tr>
							{/each}
						</tbody>
					</Table>
				</div>
			{:else}
				<p class="empty">
					{level && game.human === 'b'
						? 'Empieza Stockfish con blancas.'
						: 'Aún no hay jugadas. Mueven las blancas: toca una pieza y luego la casilla.'}
				</p>
			{/if}
		</Panel>
	</div>
</div>

<style>
	/* Tablero a la izquierda, tan grande como deje la altura de la ventana; panel a la derecha. En el móvil,
	   el tablero a todo el ancho y el panel debajo. */
	.chess {
		--board: clamp(320px, calc(100svh - 330px), 760px);
	}

	@media (min-width: 861px) {
		.chess {
			grid-template-columns: var(--board) minmax(var(--col-min), 460px);
			width: fit-content;
			max-width: 100%;
		}
	}

	.board {
		display: flex;
		border-block: var(--border);
	}

	.board > :global(svg) {
		flex: 1;
		min-width: 0;
	}

	/* Barra de evaluación fina junto al tablero: blanco por abajo (o por arriba si está girado). */
	.eval {
		display: flex;
		flex-direction: column-reverse;
		width: var(--sp-5);
		background: var(--piece-b);
		border-left: var(--border);
	}

	.eval.flip {
		flex-direction: column;
	}

	.eval i {
		background: var(--piece-w);
		transition: height 0.4s ease;
	}

	.name {
		margin-right: var(--sp-4);
	}

	.think {
		color: var(--amber);
	}

	.player {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-12);
		padding: var(--sp-6) var(--pad-x);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.player.on {
		color: var(--fg);
	}

	.who {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--sp-8);
		min-width: 0;
	}

	.name::first-letter {
		text-transform: uppercase;
	}

	.mark {
		width: var(--swatch);
		height: var(--swatch);
		border: var(--hair) solid var(--piece-b-edge);
	}

	.mark.w {
		background: var(--piece-w);
	}

	.mark.b {
		background: var(--piece-b);
	}

	.time {
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
		color: var(--muted);
	}

	.time.run {
		color: var(--amber);
	}

	.ops {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--hair);
		background: var(--line);
		border-bottom: var(--border);
	}

	.ops button {
		background: var(--panel);
		border: 0;
		min-height: var(--control-h);
		padding: var(--sp-6) var(--sp-4);
		font-size: var(--fs-s);
		color: var(--fg);
		cursor: pointer;
	}

	.ops button:hover:not(:disabled) {
		background: var(--raise);
		color: var(--amber);
	}

	.ops button:disabled {
		color: var(--faint);
		cursor: default;
	}

	.ops button.warn {
		background: var(--amber-soft);
		color: var(--amber);
	}

	.opts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-8) var(--sp-12);
		padding: var(--sp-10) var(--pad-x);
	}

	.link {
		background: none;
		border: 0;
		padding: 0;
		color: var(--muted);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.link:hover:not(:disabled) {
		color: var(--amber);
	}

	.link:disabled {
		color: var(--faint);
		cursor: default;
	}

	.moves :global(td.cur) {
		color: var(--amber);
	}

	@media (pointer: coarse) {
		.ops button {
			min-height: var(--touch);
		}
	}
</style>
