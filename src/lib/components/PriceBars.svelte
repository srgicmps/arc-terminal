<!--
	Barras del precio de la luz de un día: verde las horas baratas, rojo las caras. Al tocar o deslizar el dedo (o
	pasar el ratón) se marca una hora y su precio sale en la línea de debajo, como el cursor de LineChart: en el
	móvil no hay `title`. Con el dedo la marca se queda al soltar, para poder leerla.
-->
<script lang="ts">
	import { nf } from '#lib/format.ts';
	import { hourLabel, isHour, madridNow, type HourPrice } from '#lib/power.ts';

	interface Props {
		prices: HourPrice[];
		/** Ahora (de madridNow): resalta su hora si es de este día. */
		current?: ReturnType<typeof madridNow> | null;
	}

	let { prices, current = null }: Props = $props();

	const values = $derived(prices.map((p) => p.kwh));
	const min = $derived(Math.min(...values));
	const max = $derived(Math.max(...values));
	// Tercios: barato, medio, caro.
	const level = (v: number) => {
		const r = (v - min) / (max - min || 1);
		return r < 0.33 ? 'low' : r > 0.66 ? 'high' : 'mid';
	};

	/** Hora marcada (índice en `prices`), o null. */
	let picked = $state<number | null>(null);
	const nowIndex = $derived(prices.findIndex((p) => isHour(p, current)));
	const shown = $derived(picked ?? (nowIndex >= 0 ? nowIndex : null));

	/** La barra bajo el dedo o el ratón, por la posición horizontal entre la primera y la última. */
	function pick(e: PointerEvent) {
		const bars = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.bar');
		if (!bars.length) return;
		const left = bars[0].getBoundingClientRect().left;
		const right = bars[bars.length - 1].getBoundingClientRect().right;
		const i = Math.floor(((e.clientX - left) / (right - left || 1)) * bars.length);
		picked = Math.max(0, Math.min(bars.length - 1, i));
	}
</script>

<div
	class="bars"
	role="img"
	aria-label="Precio por horas: mínimo {nf(min, 3)} y máximo {nf(max, 3)} €/kWh"
	onpointerdown={pick}
	onpointermove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e)}
	onpointerleave={(e) => e.pointerType === 'mouse' && (picked = null)}
>
	{#each prices as p, i (`${p.hour}${p.repeat ? '²' : ''}`)}
		<div class="bar {level(p.kwh)}" class:now={isHour(p, current)} class:sel={i === picked} title="{hourLabel(p)} · {nf(p.kwh, 3)} €/kWh">
			<i style:height="{(8 + (92 * (p.kwh - min)) / (max - min || 1)).toFixed(0)}%"></i>
			<span>{p.hour % 3 === 0 && !p.repeat ? String(p.hour).padStart(2, '0') : ''}</span>
		</div>
	{/each}
</div>
<!-- Siempre ocupa su sitio, para que nada salte al marcar una hora. -->
<p class="read" aria-live="polite">
	{#if shown !== null}
		{@const p = prices[shown]}
		<span>{picked === null ? 'Ahora' : 'Hora'} <b>{hourLabel(p)}</b></span>
		<b class={level(p.kwh) === 'low' ? 'up' : level(p.kwh) === 'high' ? 'down' : ''}>{nf(p.kwh, 3)} €/kWh</b>
	{:else}
		<span>Toca o desliza sobre las barras para ver el precio de cada hora.</span>
	{/if}
</p>

<style>
	.bars {
		display: grid;
		/* Una columna por hora: 24, o 23 y 25 los días del cambio de hora. */
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: var(--sp-2);
		height: 150px;
		padding: var(--sp-12) var(--pad-x) var(--sp-4);
		/* Deslizar en horizontal marca horas; en vertical sigue moviendo la página. */
		touch-action: pan-y;
		cursor: crosshair;
	}

	.bar {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-width: 0;
	}

	.bar i {
		display: block;
		background: var(--faint);
	}

	.bar.low i {
		background: var(--up);
		opacity: 0.8;
	}

	.bar.high i {
		background: var(--down);
		opacity: 0.8;
	}

	.bar.now i {
		opacity: 1;
		outline: var(--hair) solid var(--amber);
		outline-offset: var(--sp-1);
	}

	.bar.sel i {
		opacity: 1;
		outline: var(--hair) solid var(--fg);
		outline-offset: var(--sp-1);
	}

	.bar span {
		height: 16px;
		padding-top: var(--sp-3);
		color: var(--faint);
		font-size: var(--fs-xxs);
		text-align: center;
	}

	.read {
		display: flex;
		gap: var(--sp-12);
		align-items: baseline;
		justify-content: space-between;
		margin: 0;
		padding: var(--sp-2) var(--pad-x) var(--sp-8);
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-s);
	}

	.read b {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.read b.up {
		color: var(--up);
	}

	.read b.down {
		color: var(--down);
	}
</style>
