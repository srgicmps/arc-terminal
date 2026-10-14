<!--
	Tablero de ajedrez en SVG propio (CHESS). No sabe de reglas: recibe la posición (FEN) y las jugadas
	legales (`dests`) y avisa con `onmove` cuando el jugador mueve. Se juega tocando la pieza y luego la
	casilla y, con ratón, también arrastrando. Si un peón llega al final, pregunta a qué pieza corona.
	Todo se dibuja en unidades del SVG (una casilla = 45) y escala al ancho del contenedor.
-->
<script lang="ts">
	import { FILES, piecesFromFen, type Color, type PieceSymbol, type Square } from '#lib/chess/game.ts';
	import { PIECES } from '#lib/chess/pieces.ts';

	interface Props {
		fen: string;
		/** Bando que se ve abajo. */
		orientation?: Color;
		/** Bando que puede mover el jugador, o null si ahora no le toca (fin, motor pensando…). */
		movable?: Color | null;
		/** Jugadas legales: casilla de origen → casillas de destino. */
		dests?: Map<Square, Square[]>;
		lastMove?: [Square, Square] | null;
		/** Casilla del rey en jaque. */
		check?: Square;
		/** Flecha de la pista: de dónde a dónde. */
		arrow?: [Square, Square] | null;
		onmove?: (from: Square, to: Square, promotion?: PieceSymbol) => void;
	}

	let {
		fen,
		orientation = 'w',
		movable = null,
		dests = new Map(),
		lastMove = null,
		check,
		arrow = null,
		onmove
	}: Props = $props();

	const S = 45;
	const SIZE = S * 8;

	let svg: SVGSVGElement;
	let selected = $state<Square | null>(null);
	let drag = $state<{ from: Square; x: number; y: number; active: boolean } | null>(null);
	let hover = $state<Square | null>(null);
	let promo = $state<{ from: Square; to: Square; color: Color } | null>(null);
	/** Si al soltar hay que deseleccionar (se ha vuelto a tocar la pieza elegida). */
	let deselectOnUp = false;
	let downAt = { x: 0, y: 0 };

	const pieces = $derived(piecesFromFen(fen));
	const at = $derived(new Map(pieces.map((p) => [p.square, p])));
	const targets = $derived(selected ? (dests.get(selected) ?? []) : []);

	// Si cambia la posición (jugada del rival, deshacer…), se olvida la selección.
	$effect(() => {
		void fen;
		selected = null;
		promo = null;
	});

	/** Esquina superior izquierda de una casilla, según el lado desde el que se mira. */
	function xy(sq: Square): [number, number] {
		const f = FILES.indexOf(sq[0] as (typeof FILES)[number]);
		const r = Number(sq[1]) - 1;
		return orientation === 'w' ? [f * S, (7 - r) * S] : [(7 - f) * S, r * S];
	}

	function squareAt(col: number, row: number): Square | null {
		if (col < 0 || col > 7 || row < 0 || row > 7) return null;
		const f = orientation === 'w' ? col : 7 - col;
		const r = orientation === 'w' ? 7 - row : row;
		return `${FILES[f]}${r + 1}` as Square;
	}

	/** Del puntero a unidades del SVG. */
	function point(e: PointerEvent): { x: number; y: number; sq: Square | null } {
		const box = svg.getBoundingClientRect();
		const x = ((e.clientX - box.left) / box.width) * SIZE;
		const y = ((e.clientY - box.top) / box.height) * SIZE;
		return { x, y, sq: squareAt(Math.floor(x / S), Math.floor(y / S)) };
	}

	const canMove = (from: Square, to: Square) => dests.get(from)?.includes(to) ?? false;

	function tryMove(from: Square, to: Square) {
		selected = null;
		const piece = at.get(from);
		if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
			promo = { from, to, color: piece.color };
			return;
		}
		onmove?.(from, to);
	}

	function onpointerdown(e: PointerEvent) {
		if (promo || e.button > 0) return;
		const { x, y, sq } = point(e);
		if (!sq) return;
		const piece = at.get(sq);
		deselectOnUp = false;
		if (selected && sq !== selected && canMove(selected, sq)) {
			tryMove(selected, sq);
			return;
		}
		if (piece && piece.color === movable && dests.has(sq)) {
			deselectOnUp = selected === sq;
			selected = sq;
			// Arrastrar, solo con ratón: en el móvil el dedo sigue haciendo scroll.
			if (e.pointerType === 'mouse') {
				drag = { from: sq, x, y, active: false };
				downAt = { x, y };
				svg.setPointerCapture(e.pointerId);
			}
			return;
		}
		selected = null;
	}

	function onpointermove(e: PointerEvent) {
		if (e.pointerType !== 'mouse') return;
		const { x, y, sq } = point(e);
		hover = sq;
		if (!drag) return;
		const active = drag.active || Math.hypot(x - downAt.x, y - downAt.y) > 4;
		drag = { ...drag, x, y, active };
	}

	function onpointerup(e: PointerEvent) {
		if (!drag) return;
		const { sq } = point(e);
		const { from, active } = drag;
		drag = null;
		if (active) {
			if (sq && sq !== from && canMove(from, sq)) tryMove(from, sq);
		} else if (deselectOnUp) selected = null;
	}

	function choose(type: PieceSymbol) {
		if (!promo) return;
		const { from, to } = promo;
		promo = null;
		onmove?.(from, to, type);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && (promo || selected)) {
			e.stopPropagation();
			promo = null;
			selected = null;
		}
	}

	/** Flecha como un polígono: cuerpo fino y punta, del centro de una casilla al de la otra. */
	const arrowPoints = $derived.by(() => {
		if (!arrow) return '';
		const [x1, y1] = xy(arrow[0]).map((v) => v + S / 2);
		const [x2, y2] = xy(arrow[1]).map((v) => v + S / 2);
		const len = Math.hypot(x2 - x1, y2 - y1);
		const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
		const [nx, ny] = [-uy, ux];
		const w = 2.2;
		const head = 11;
		const tip = len - 6;
		const p = (along: number, side: number) =>
			`${(x1 + ux * along + nx * side).toFixed(1)},${(y1 + uy * along + ny * side).toFixed(1)}`;
		return [
			p(8, w),
			p(tip - head, w),
			p(tip - head, w * 3.2),
			p(tip, 0),
			p(tip - head, -w * 3.2),
			p(tip - head, -w),
			p(8, -w)
		].join(' ');
	});

	/** Casillas del selector de coronación: desde la de destino hacia el centro del tablero. */
	const promoSquares = $derived.by(() => {
		if (!promo) return [];
		const [x, y] = xy(promo.to);
		const down = y === 0 ? 1 : -1;
		return (['q', 'n', 'r', 'b'] as PieceSymbol[]).map((type, i) => ({ type, x, y: y + down * i * S }));
	});
</script>

<svelte:window {onkeydown} />

<svg
	bind:this={svg}
	class="board"
	class:dragging={drag?.active}
	viewBox="0 0 {SIZE} {SIZE}"
	role="img"
	aria-label="Tablero de ajedrez"
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointerleave={() => (hover = null)}
>
	{#each { length: 64 }, i (i)}
		{@const col = i % 8}
		{@const row = Math.floor(i / 8)}
		<rect class={(col + row) % 2 ? 'dark' : 'light'} x={col * S} y={row * S} width={S} height={S} />
	{/each}

	{#if lastMove}
		{#each lastMove as sq (sq)}
			{@const [x, y] = xy(sq)}
			<rect class="last" {x} {y} width={S} height={S} />
		{/each}
	{/if}
	{#if selected}
		{@const [x, y] = xy(selected)}
		<rect class="sel" {x} {y} width={S} height={S} />
	{/if}
	{#if check}
		{@const [x, y] = xy(check)}
		<rect class="check" x={x + 0.5} y={y + 0.5} width={S - 1} height={S - 1} />
	{/if}
	{#if drag?.active && hover && canMove(drag.from, hover)}
		{@const [x, y] = xy(hover)}
		<rect class="hover" x={x + 0.5} y={y + 0.5} width={S - 1} height={S - 1} />
	{/if}

	<!-- Coordenadas: números en la primera columna y letras en la última fila. -->
	{#each { length: 8 }, i (i)}
		{@const rank = orientation === 'w' ? 8 - i : i + 1}
		{@const file = orientation === 'w' ? FILES[i] : FILES[7 - i]}
		<text class="coord" x={2.5} y={i * S + 8.5}>{rank}</text>
		<text class="coord" x={i * S + S - 2.5} y={SIZE - 2.5} text-anchor="end">{file}</text>
	{/each}

	{#each pieces as p (p.square)}
		{#if !(drag?.active && drag.from === p.square)}
			{@const [x, y] = xy(p.square)}
			<g class="piece {p.color}" transform="translate({x} {y})">
				<path d={PIECES[p.type].body} />
				{#if PIECES[p.type].detail}<path class="detail" d={PIECES[p.type].detail} />{/if}
			</g>
		{/if}
	{/each}

	{#each targets as sq (sq)}
		{@const [x, y] = xy(sq)}
		{#if at.has(sq)}
			<circle class="take" cx={x + S / 2} cy={y + S / 2} r={S / 2 - 2.5} />
		{:else}
			<circle class="dot" cx={x + S / 2} cy={y + S / 2} r={5} />
		{/if}
	{/each}

	{#if arrow}<polygon class="arrow" points={arrowPoints} />{/if}

	{#if drag?.active}
		{@const p = at.get(drag.from)}
		{#if p}
			<g class="piece {p.color} lifted" transform="translate({drag.x - S / 2} {drag.y - S / 2})">
				<path d={PIECES[p.type].body} />
				{#if PIECES[p.type].detail}<path class="detail" d={PIECES[p.type].detail} />{/if}
			</g>
		{/if}
	{/if}

	{#if promo}
		<rect class="veil" width={SIZE} height={SIZE} role="presentation" onclick={() => (promo = null)} />
		{#each promoSquares as o (o.type)}
			<g
				class="promo"
				role="button"
				tabindex="0"
				aria-label="Coronar: {({ q: 'dama', n: 'caballo', r: 'torre', b: 'alfil' } as Record<string, string>)[o.type]}"
				onclick={() => choose(o.type)}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && choose(o.type)}
			>
				<rect x={o.x + 0.5} y={o.y + 0.5} width={S - 1} height={S - 1} />
				<g class="piece {promo.color}" transform="translate({o.x} {o.y})">
					<path d={PIECES[o.type].body} />
					{#if PIECES[o.type].detail}<path class="detail" d={PIECES[o.type].detail} />{/if}
				</g>
			</g>
		{/each}
	{/if}
</svg>

<style>
	.board {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		user-select: none;
		-webkit-user-select: none;
		-webkit-tap-highlight-color: transparent;
		cursor: pointer;
	}

	.dragging {
		cursor: grabbing;
	}

	.light {
		fill: var(--sq-light);
	}

	.dark {
		fill: var(--sq-dark);
	}

	.last {
		fill: var(--amber-soft);
	}

	.sel {
		fill: var(--amber-soft);
		stroke: var(--amber-edge);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}

	.check,
	.hover {
		fill: none;
		stroke: var(--amber);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}

	.hover {
		stroke: var(--amber-edge);
	}

	.coord {
		font-family: var(--mono);
		font-size: 7.5px;
		fill: var(--faint);
		pointer-events: none;
	}

	.piece path {
		stroke-width: var(--hair);
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.piece.w path {
		fill: var(--piece-w);
		stroke: var(--piece-w-edge);
	}

	.piece.b path {
		fill: var(--piece-b);
		stroke: var(--piece-b-edge);
	}

	.piece path.detail {
		fill: none;
		stroke-linecap: round;
	}

	.piece.b path.detail {
		stroke: var(--piece-w);
	}

	.lifted {
		pointer-events: none;
	}

	.dot {
		fill: var(--amber-edge);
		pointer-events: none;
	}

	.take {
		fill: none;
		stroke: var(--amber-edge);
		stroke-width: 2;
		pointer-events: none;
	}

	.arrow {
		fill: var(--amber);
		opacity: 0.75;
		pointer-events: none;
	}

	.veil {
		fill: var(--bg);
		opacity: 0.6;
	}

	.promo {
		cursor: pointer;
	}

	.promo rect {
		fill: var(--panel);
		stroke: var(--amber-edge);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}

	.promo:hover rect,
	.promo:focus-visible rect {
		fill: var(--raise);
		stroke: var(--amber);
	}
</style>
