<!-- Arco del sol: línea de 1 px de la salida a la puesta y un punto donde está el sol ahora. -->
<script lang="ts">
	interface Props {
		sunrise: string;
		sunset: string;
		/** Hora actual en ms. Con 0 (antes de arrancar en el navegador) no se pinta el punto. */
		now: number;
	}

	let { sunrise, sunset, now }: Props = $props();

	const W = 200;
	const H = 56;
	const R = { x: 90, y: 46 };
	const BASE = 52;

	// Fracción del día que ha pasado (0 al salir, 1 al ponerse); fuera de ese tramo es de noche.
	const f = $derived.by(() => {
		const rise = Date.parse(sunrise);
		const set = Date.parse(sunset);
		if (!now || !(set > rise)) return null;
		return (now - rise) / (set - rise);
	});
	const dot = $derived.by(() => {
		if (f === null || f < 0 || f > 1) return null;
		const a = Math.PI * (1 - f);
		return { x: W / 2 + R.x * Math.cos(a), y: BASE - R.y * Math.sin(a) };
	});
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label={dot ? 'Posición del sol ahora' : 'El sol está bajo el horizonte'}>
	<line x1="0" y1={BASE} x2={W} y2={BASE} class="horizon" />
	<path d="M {W / 2 - R.x} {BASE} A {R.x} {R.y} 0 0 1 {W / 2 + R.x} {BASE}" class="arc" />
	{#if dot}
		<circle cx={dot.x} cy={dot.y} r="3" class="sun" />
	{/if}
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		max-width: 260px;
		height: auto;
		margin: 0 auto;
		overflow: visible;
	}

	.horizon {
		stroke: var(--line);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.arc {
		fill: none;
		stroke: var(--amber-edge);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.sun {
		fill: var(--amber);
	}
</style>
