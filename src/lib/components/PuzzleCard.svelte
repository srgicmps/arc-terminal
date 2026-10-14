<!--
	Problema del día de Lichess en pequeño, para montarlo como módulo en TOP: el tablero (sin mover), a
	quién le toca, la dificultad y los temas, y el enlace a CHESS para resolverlo.
	Uso: <PuzzleCard puzzle={data.lichess?.data} /> (en +page.server.ts: dataset('lichess')).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Board from './Board.svelte';
	import Panel from './Panel.svelte';
	import { colorName, type Square } from '#lib/chess/game.ts';
	import { puzzleStart, puzzleThemes, type Puzzle } from '#lib/chess/puzzle.ts';
	import { loadSolved } from '#lib/chess/save.ts';

	let { puzzle }: { puzzle: Puzzle | null | undefined } = $props();

	let solved = $state(false);
	onMount(() => (solved = !!puzzle && loadSolved() === puzzle.id));

	const start = $derived(puzzle ? puzzleStart(puzzle) : null);
	const href = `${resolve('/chess')}?modo=problema`;
</script>

<Panel title="Problema del día" meta={solved ? '✓ Resuelto' : undefined} jump={{ code: 'CHESS', href }}>
	{#if puzzle && start}
		<a class="card" {href}>
			<div class="mini-board">
				<Board
					fen={start.chess.fen()}
					orientation={start.color}
					coords={false}
					lastMove={[puzzle.lastMove.slice(0, 2), puzzle.lastMove.slice(2, 4)] as [Square, Square]}
				/>
			</div>
			<div class="txt">
				<b>Juegan las {colorName(start.color)}</b>
				<span>Dificultad {puzzle.rating}</span>
				<span>{puzzleThemes(puzzle, 2).join(' · ')}</span>
			</div>
		</a>
	{:else}
		<p class="empty">Sin problema del día todavía.</p>
	{/if}
	{#snippet note()}Lichess · CC0{/snippet}
</Panel>

<style>
	.card {
		display: flex;
		gap: var(--sp-12);
		align-items: center;
		padding: var(--sp-10) var(--pad-x);
		color: inherit;
		text-decoration: none;
	}

	/* Tablero pequeño: geometría propia del módulo. */
	.mini-board {
		flex: 0 0 auto;
		width: min(45%, 180px);
		border: var(--border);
		pointer-events: none;
	}

	.txt {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-width: 0;
		font-family: var(--sans);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.txt b {
		color: var(--fg);
		font-weight: var(--fw-medium);
		font-size: var(--fs-m);
	}

	.card:hover b {
		color: var(--amber);
	}
</style>
