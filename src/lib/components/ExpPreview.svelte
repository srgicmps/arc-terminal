<!--
	Vista previa de una experiencia para la galería /x: un dibujo pequeño (SVG) de cómo es, con un movimiento
	suave (las noticias pasan, la aguja se mueve, la voz suena…). Solo trazos y colores de los tokens, así que
	funciona con cualquier estilo y tema. Con «reducir movimiento», quieto. Si no hay dibujo, el icono en grande.
-->
<script lang="ts">
	import type { Experience } from '#lib/experiences.ts';

	let { exp }: { exp: Experience } = $props();

	const DRAWN = new Set(['periodico', 'sala', 'zen', 'cabina', 'feed', 'radio', 'muro', 'predicciones', 'constelacion', 'bitacora']);
</script>

<div class="pv" aria-hidden="true">
	{#if DRAWN.has(exp.id)}
		<svg viewBox="0 0 160 90">
			{#if exp.id === 'periodico'}
				<rect class="ink" x="12" y="10" width="136" height="8" />
				{#each [0, 1, 2] as c (c)}
					{#each [0, 1, 2, 3, 4, 5] as r (r)}
						<rect class="line" x={12 + c * 47} y={26 + r * 9} width={40 - ((r + c) % 3) * 6} height="3" />
					{/each}
				{/each}
			{:else if exp.id === 'sala'}
				<path class="frame" d="M14 60 Q40 20 70 40 T130 30 L146 62 Q100 78 60 70 Z" />
				{#each [[40, 45], [78, 38], [110, 50], [60, 60], [128, 40]] as [x, y], i (i)}
					<circle class="blip" cx={x} cy={y} r="3" style:animation-delay="{i * 0.6}s" />
				{/each}
			{:else if exp.id === 'zen'}
				<circle class="breathe" cx="80" cy="45" r="18" />
				<rect class="line" x="50" y="74" width="60" height="3" />
			{:else if exp.id === 'cabina'}
				{#each [40, 120] as cx (cx)}
					<path class="frame" d="M{cx - 26} 62 A26 26 0 0 1 {cx + 26} 62" />
					<line class="needle" x1={cx} y1="62" x2={cx} y2="40" style:transform-origin="{cx}px 62px" />
				{/each}
				<rect class="line" x="20" y="74" width="120" height="3" />
			{:else if exp.id === 'feed'}
				<g class="scroll">
					{#each [0, 1, 2, 3, 4, 5, 6, 7] as r (r)}
						<circle class="dot" cx="20" cy={12 + r * 18} r="2.5" />
						<rect class="line" x="30" y={10 + r * 18} width={100 - (r % 3) * 20} height="4" />
					{/each}
				</g>
			{:else if exp.id === 'radio'}
				{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as i (i)}
					<rect class="bar" x={36 + i * 10} y="25" width="5" height="40" style:animation-delay="{i * 0.12}s" />
				{/each}
			{:else if exp.id === 'muro'}
				<text class="big" x="80" y="46" text-anchor="middle" font-size="30">12:00</text>
				<g class="ticker">
					{#each [0, 1, 2, 3, 4, 5] as i (i)}<rect class="line" x={i * 54} y="70" width="40" height="4" />{/each}
				</g>
			{:else if exp.id === 'predicciones'}
				{#each [26, 18, 10] as r (r)}<circle class="frame" cx="80" cy="45" {r} />{/each}
				<circle class="hit" cx="80" cy="45" r="3" />
			{:else if exp.id === 'constelacion'}
				{#each [[40, 30, 80, 45], [80, 45, 120, 28], [80, 45, 100, 70], [40, 30, 50, 66], [50, 66, 100, 70]] as [a, b, c, d], i (i)}
					<line class="edge" x1={a} y1={b} x2={c} y2={d} />
				{/each}
				{#each [[40, 30], [80, 45], [120, 28], [100, 70], [50, 66]] as [x, y], i (i)}
					<circle class="node" cx={x} cy={y} r={i === 1 ? 6 : 4} style:animation-delay="{i * 0.5}s" />
				{/each}
			{:else if exp.id === 'bitacora'}
				{#each [0, 1, 2, 3] as r (r)}
					<rect class="write" x="30" y={22 + r * 14} width={r === 3 ? 60 : 100} height="3" style:animation-delay="{r * 0.7}s" />
				{/each}
				<line class="frame" x1="22" y1="14" x2="22" y2="76" />
			{/if}
		</svg>
	{:else}
		<span class="icon">{exp.icon}</span>
	{/if}
</div>

<style>
	.pv {
		display: grid;
		place-items: center;
		aspect-ratio: 16 / 9;
		background: var(--bg);
		border-bottom: var(--border);
		overflow: hidden;
	}
	svg {
		width: 100%;
		height: 100%;
	}
	.icon {
		font-size: var(--fs-xxl);
	}
	.ink {
		fill: var(--fg);
	}
	.line {
		fill: var(--line);
	}
	.frame,
	.edge {
		fill: none;
		stroke: var(--line);
		stroke-width: 1.5;
	}
	.dot,
	.node,
	.hit {
		fill: var(--amber);
	}
	.big {
		fill: var(--fg);
		font-family: var(--mono);
	}
	.blip {
		fill: var(--amber);
		animation: blip 3s ease-out infinite;
	}
	.breathe {
		fill: none;
		stroke: var(--amber);
		stroke-width: 1.5;
		transform-origin: 80px 45px;
		animation: breathe 5s ease-in-out infinite;
	}
	.needle {
		stroke: var(--amber);
		stroke-width: 2;
		animation: needle 4s ease-in-out infinite alternate;
	}
	.scroll {
		animation: scroll 6s linear infinite;
	}
	.bar {
		fill: var(--amber-edge);
		transform-origin: center 45px;
		transform-box: fill-box;
		animation: bar 1.1s ease-in-out infinite alternate;
	}
	.ticker {
		animation: ticker 6s linear infinite;
	}
	.hit {
		animation: blip 2.4s ease-out infinite;
	}
	.node {
		animation: pulse 3s ease-in-out infinite;
	}
	.write {
		fill: var(--muted);
		transform-box: fill-box;
		transform-origin: left center;
		animation: write 4s ease-out infinite;
	}
	@keyframes blip {
		0% {
			opacity: 1;
		}
		70%,
		100% {
			opacity: 0.2;
		}
	}
	@keyframes breathe {
		50% {
			transform: scale(1.25);
		}
	}
	@keyframes needle {
		from {
			transform: rotate(-50deg);
		}
		to {
			transform: rotate(50deg);
		}
	}
	@keyframes scroll {
		to {
			transform: translateY(-54px);
		}
	}
	@keyframes bar {
		from {
			transform: scaleY(0.2);
		}
	}
	@keyframes ticker {
		to {
			transform: translateX(-54px);
		}
	}
	@keyframes pulse {
		50% {
			opacity: 0.4;
		}
	}
	@keyframes write {
		from {
			transform: scaleX(0);
		}
		40%,
		100% {
			transform: scaleX(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pv * {
			animation: none !important;
		}
	}
</style>
