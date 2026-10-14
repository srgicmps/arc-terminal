<!--
	CHESS: partida de ajedrez. Las reglas las pone chess.js; el tablero es nuestro (Board.svelte).
	La partida es una lista de jugadas en $state: todo lo demás (posición, historial, final) se deriva de
	ella, como un computed de Vue. Se guarda en este navegador después de cada jugada.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Board from '#lib/components/Board.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
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
		type Square
	} from '#lib/chess/game.ts';
	import { emptyGame, loadGame, saveGame, type SavedGame } from '#lib/chess/save.ts';

	let game = $state<SavedGame>(emptyGame());
	let ready = $state(false);
	let preset = $state<Preset>('none');
	let now = $state(Date.now());
	/** Botón que espera la segunda pulsación para confirmar («Nueva», «Abandonar»). */
	let confirming = $state<'new' | 'resign' | null>(null);
	let copied = $state(false);
	let moveList = $state<HTMLDivElement>();

	const chess = $derived(replay(game.moves));
	const history = $derived(chess.history({ verbose: true }));
	const pairs = $derived(movePairs(history.map((m) => m.san)));
	const end = $derived(outcome(chess, game));
	const turn = $derived(chess.turn());
	const last = $derived(history.at(-1));
	const status = $derived(statusText(chess, end));

	onMount(() => {
		const saved = loadGame();
		if (saved) {
			game = saved;
			preset = presetOf(saved);
		}
		ready = true;
	});

	// Guardar después de cada cambio (snapshot: una copia plana, sin el proxy de $state).
	$effect(() => {
		if (ready) saveGame($state.snapshot(game));
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

	function onmove(from: Square, to: Square, promotion?: PieceSymbol) {
		if (end) return;
		const mover = turn;
		game.moves = [...game.moves, `${from}${to}${promotion ?? ''}`];
		const t = Date.now();
		now = t;
		if (game.clock) {
			game.clock = afterMove(game.clock, mover, t);
			// Si la jugada acaba la partida, el reloj se para.
			if (outcome(replay(game.moves))) game.clock = pause(game.clock, other(mover), t);
		}
	}

	function undo() {
		if (!game.moves.length) return;
		game.moves = game.moves.slice(0, -1);
		game.resigned = null;
		game.flagged = null;
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
		game = emptyGame(game.orientation, makeClock(preset));
	}

	function resign() {
		game.resigned = turn;
		if (game.clock) game.clock = pause(game.clock, turn, Date.now());
	}

	function changePreset(value: string) {
		preset = value as Preset;
		// Sin jugadas todavía, el reloj nuevo vale para esta misma partida.
		if (!game.moves.length) game.clock = makeClock(preset);
	}

	async function copyPgn() {
		chess.setHeader('Event', 'Arc Terminal');
		// Fecha de hoy en Madrid («2026.10.14», el formato del PGN); en UTC, de 0 a 2 h saldría el día anterior.
		const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
		chess.setHeader('Date', today.replaceAll('-', '.'));
		chess.setHeader('Result', resultTag(end));
		try {
			await navigator.clipboard.writeText(chess.pgn());
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {}
	}

	const clockOf = (c: Color) => (game.clock ? formatClock(remaining(game.clock, c, turn, now)) : '');
	const running = (c: Color) => !end && turn === c && !!game.clock && game.clock.since !== null;
</script>

<ViewHeader
	code="CHESS"
	title="Ajedrez"
	sub="Partida en este dispositivo, guardada en el navegador · reglas: chess.js"
/>

<!-- Barra de un jugador, encima o debajo del tablero: bando y reloj. -->
{#snippet player(c: Color)}
	<div class="player" class:on={!end && turn === c}>
		<span class="who"><i class="mark {c}" aria-hidden="true"></i>{colorName(c)}</span>
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
					movable={ready && !end ? turn : null}
					dests={destinations(chess)}
					lastMove={last ? [last.from, last.to] : null}
					check={checkSquare(chess)}
					{onmove}
				/>
			</div>
			{@render player(game.orientation)}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Controles">
			<div class="ops">
				<button type="button" onclick={undo} disabled={!game.moves.length}>Deshacer</button>
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
				<Select label="Reloj" value={preset} onchange={changePreset}>
					{#each PRESETS as p (p.value)}<option value={p.value}>{p.label}</option>{/each}
				</Select>
				<button type="button" class="link" onclick={copyPgn} disabled={!game.moves.length}
					>{copied ? 'PGN copiado' : 'Copiar PGN'}</button
				>
			</div>
			{#snippet note()}
				{#if game.moves.length && preset !== presetOf(game)}El reloj nuevo vale desde la próxima partida.
				{/if}Por ahora, partida entre dos personas en este dispositivo. Reglas:
				<a href="https://github.com/jhlywa/chess.js" target="_blank" rel="noopener">chess.js</a> (BSD-2).
			{/snippet}
		</Panel>
		<Panel title="Jugadas" meta={end ? resultTag(end) : `${history.length} ${history.length === 1 ? 'media jugada' : 'medias jugadas'}`}>
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
				<p class="empty">Aún no hay jugadas. Mueven las blancas: toca una pieza y luego la casilla.</p>
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
		border-block: var(--border);
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
		align-items: center;
		gap: var(--sp-8);
		text-transform: capitalize;
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
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
