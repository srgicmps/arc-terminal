<!--
	Modo problema de CHESS: el problema del día de Lichess en el tablero. Pinta dos columnas (.col) de la
	rejilla de la vista: el tablero y, al lado, el estado, los botones y los datos del problema.
	Si aciertas, el rival contesta solo; si fallas, puedes volver a intentarlo. Se recuerda en este
	navegador si el problema de hoy ya está resuelto.
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Board from './Board.svelte';
	import Panel from './Panel.svelte';
	import ButtonRow from './ui/ButtonRow.svelte';
	import { colorName, destinations, playUci, type PieceSymbol, type Square, type Uci } from '#lib/chess/game.ts';
	import { checkMove, puzzleStart, puzzleThemes, type Puzzle } from '#lib/chess/puzzle.ts';
	import { loadSolved, saveSolved } from '#lib/chess/save.ts';

	let { puzzle }: { puzzle: Puzzle } = $props();

	let played = $state<Uci[]>([]);
	let feedback = $state<'idle' | 'right' | 'wrong' | 'solved' | 'shown'>('idle');
	let hint = $state<[Square, Square] | null>(null);
	let solvedBefore = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const start = $derived(puzzleStart(puzzle));
	const chess = $derived.by(() => {
		const c = puzzleStart(puzzle).chess;
		for (const m of played) playUci(c, m);
		return c;
	});
	const color = $derived(start.color);
	const done = $derived(feedback === 'solved' || feedback === 'shown');
	const yourTurn = $derived(!done && played.length % 2 === 0);
	const lastUci = $derived(played.at(-1) ?? puzzle.lastMove);
	const lastMove = $derived([lastUci.slice(0, 2), lastUci.slice(2, 4)] as [Square, Square]);

	onMount(() => (solvedBefore = loadSolved() === puzzle.id));
	onDestroy(() => clearTimeout(timer));

	function onmove(from: Square, to: Square, promotion?: PieceSymbol) {
		const uci = `${from}${to}${promotion ?? ''}`;
		hint = null;
		if (!checkMove(puzzle, played, uci)) {
			feedback = 'wrong';
			return;
		}
		// Un mate distinto del de la solución también vale: el problema se acaba ahí.
		const mate = uci !== puzzle.solution[played.length];
		played = [...played, uci];
		if (mate || played.length >= puzzle.solution.length) return solve();
		feedback = 'right';
		timer = setTimeout(() => (played = [...played, puzzle.solution[played.length]]), 450);
	}

	function solve() {
		feedback = 'solved';
		solvedBefore = true;
		saveSolved(puzzle.id);
	}

	function showHint() {
		const next = puzzle.solution[played.length];
		if (next) hint = [next.slice(0, 2) as Square, next.slice(2, 4) as Square];
	}

	/** Juega lo que queda de la solución, una jugada cada medio segundo. */
	function showSolution() {
		clearTimeout(timer);
		hint = null;
		feedback = 'shown';
		const step = () => {
			if (played.length >= puzzle.solution.length) return;
			played = [...played, puzzle.solution[played.length]];
			timer = setTimeout(step, 550);
		};
		step();
	}

	function restart() {
		clearTimeout(timer);
		played = [];
		hint = null;
		feedback = 'idle';
	}

	const message = $derived(
		{
			idle: `Juegas con ${colorName(color)}: encuentra la mejor jugada.`,
			right: '¡Bien! Sigue.',
			wrong: 'No es esa. Prueba otra.',
			solved: '¡Resuelto!',
			shown: 'Esta era la solución.'
		}[feedback]
	);
</script>

<div class="col">
	<Panel title="Problema del día" meta={`Juegan las ${colorName(color)}`}>
		<div class="board">
			<Board
				fen={chess.fen()}
				orientation={color}
				movable={yourTurn ? color : null}
				dests={destinations(chess)}
				{lastMove}
				arrow={hint}
				{onmove}
			/>
		</div>
		<p
			class="msg"
			class:ok={feedback === 'right' || feedback === 'solved'}
			class:ko={feedback === 'wrong'}
			aria-live="polite"
		>
			{message}
		</p>
	</Panel>
</div>
<div class="col">
	<Panel title="Problema" meta={solvedBefore ? '✓ Resuelto hoy' : undefined}>
		<ButtonRow>
			<button type="button" onclick={showHint} disabled={done || !yourTurn}>Pista</button>
			<button type="button" onclick={showSolution} disabled={done}>Ver solución</button>
			<button type="button" onclick={restart} disabled={!played.length && feedback === 'idle'}>Reiniciar</button>
		</ButtonRow>
		<ul class="mini">
			<li><span class="l">Dificultad</span><b>{puzzle.rating}</b></li>
			<li><span class="l">Temas</span><b>{puzzleThemes(puzzle, 4).join(' · ') || '—'}</b></li>
			<li><span class="l">Jugadas tuyas</span><b>{Math.ceil(puzzle.solution.length / 2)}</b></li>
		</ul>
		{#snippet note()}
			Problema del día de <a href={puzzle.url} target="_blank" rel="noopener">Lichess</a>, de dominio público (CC0). Se
			renueva cada día.
		{/snippet}
	</Panel>
</div>

<style>
	.board {
		border-block: var(--border);
	}

	.msg {
		margin: 0;
		padding: var(--sp-10) var(--pad-x);
		font-family: var(--sans);
		color: var(--muted);
	}

	.msg.ok {
		color: var(--amber);
	}

	.msg.ko {
		color: var(--fg);
	}
</style>
