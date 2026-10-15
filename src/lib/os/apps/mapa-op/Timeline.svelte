<!--
	Mapa operacional: la línea de tiempo de abajo. Un deslizador (input range, con teclado y lector de pantalla)
	sobre el histograma de sucesos; al moverlo, el mapa solo enseña lo que había pasado hasta esa hora.
	«Reproducir» avanza solo hasta ahora; «Ahora» vuelve al directo. `cursor` null = en directo.
-->
<script lang="ts">
	import { ago, clampCursor, playStep, type Range } from './ops.ts';

	interface Props {
		range: Range;
		/** null: en directo (el final del rango, aunque lleguen datos nuevos). */
		cursor: number | null;
		bins: number[];
		now: number;
	}

	let { range, cursor = $bindable(), bins, now }: Props = $props();

	let playing = $state(false);
	const at = $derived(cursor === null ? range.end : clampCursor(cursor, range));
	const span = $derived(Math.max(1, range.end - range.start));
	const peak = $derived(Math.max(1, ...bins));
	const pos = $derived(((at - range.start) / span) * 100);

	const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
	const label = (t: number) => fmt.format(new Date(t)).replace('.', '');

	function set(v: number) {
		cursor = v >= range.end ? null : clampCursor(v, range);
	}

	// Reproducir: un paso cada 120 ms (unos 18 s de principio a fin); se para al llegar a ahora.
	$effect(() => {
		if (!playing) return;
		const id = setInterval(() => {
			const s = playStep(cursor ?? range.end, range, 150);
			set(s.cursor);
			if (s.done) playing = false;
		}, 120);
		return () => clearInterval(id);
	});

	function toggle() {
		if (!playing && cursor === null) cursor = range.start;
		playing = !playing;
	}

	function live() {
		playing = false;
		cursor = null;
	}

	function key(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'k') {
			e.preventDefault();
			toggle();
		}
	}
</script>

<div class="tl">
	<div class="ctl">
		<button type="button" class="btn" aria-pressed={playing} onclick={toggle} title="Reproducir o pausar (espacio)">
			{playing ? '❚❚' : '▶'}<span class="sr">{playing ? 'Pausar' : 'Reproducir'}</span>
		</button>
		<button type="button" class="btn now" class:on={cursor === null} onclick={live} disabled={cursor === null}
			>Ahora</button
		>
	</div>

	<div class="track">
		<div class="bins" aria-hidden="true">
			{#each bins as b, i (i)}
				<i class:past={(i + 1) / bins.length <= pos / 100 + 1 / bins.length} style:height="{(b / peak) * 100}%"></i>
			{/each}
		</div>
		<div class="mark" aria-hidden="true" style:left="{pos}%"></div>
		<input
			type="range"
			min={range.start}
			max={range.end}
			step={span / 600}
			value={at}
			aria-label="Línea de tiempo: hasta cuándo se ven los sucesos"
			aria-valuetext="{label(at)}{cursor === null ? ', en directo' : ''}"
			oninput={(e) => {
				playing = false;
				set(+e.currentTarget.value);
			}}
			onkeydown={key}
		/>
		<div class="ends" aria-hidden="true">
			<span>{label(range.start)}</span>
			<span>{label(range.end)}</span>
		</div>
	</div>

	<div class="read" aria-live="polite">
		{#if cursor === null}
			<b class="live">● En directo</b>
		{:else}
			<b class="rew">⟲ Rebobinado</b>
		{/if}
		<span>{label(at)}</span>
		{#if cursor !== null}<span class="mut">{ago(at, now)}</span>{/if}
	</div>
</div>

<style>
	.tl {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--sp-12);
		padding: var(--sp-6) var(--pad-x);
		border-top: var(--border);
		border-color: var(--cmd-coast);
		background: var(--panel);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.ctl {
		display: flex;
		gap: var(--sp-4);
	}

	.btn {
		min-height: var(--control-h);
		min-width: var(--control-h);
		padding: 0 var(--sp-8);
		border: var(--border);
		border-color: var(--cmd-coast);
		border-radius: var(--radius-s);
		background: none;
		color: var(--fg);
		font: inherit;
		cursor: pointer;
	}

	.btn[aria-pressed='true'] {
		border-color: var(--cmd-cold);
		color: var(--cmd-cold);
	}
	@media (hover: hover) {
		.btn:hover:not(:disabled) {
			border-color: var(--cmd-cold);
			color: var(--cmd-cold);
		}
	}

	.btn:disabled {
		color: var(--faint);
		cursor: default;
	}

	.track {
		position: relative;
		height: calc(var(--control-h) + var(--sp-14));
		min-width: 0;
	}

	.bins {
		position: absolute;
		inset: 0 0 var(--sp-14) 0;
		display: flex;
		align-items: flex-end;
		gap: var(--sp-1);
		border-bottom: var(--border);
		border-color: var(--cmd-coast);
	}

	.bins i {
		flex: 1;
		min-height: var(--sp-1);
		background: var(--cmd-cold-soft);
	}

	.bins i.past {
		background: var(--cmd-cold);
		opacity: 0.55;
	}

	.mark {
		position: absolute;
		top: 0;
		bottom: var(--sp-14);
		width: var(--hair);
		background: var(--amber);
		pointer-events: none;
	}

	input {
		position: absolute;
		inset: 0 0 var(--sp-14) 0;
		width: 100%;
		height: auto;
		margin: 0;
		opacity: 0;
		cursor: ew-resize;
	}

	input:focus-visible ~ .ends {
		color: var(--cmd-cold);
	}

	.track:has(input:focus-visible) .bins {
		outline: var(--hair) solid var(--cmd-cold);
		outline-offset: var(--sp-2);
	}

	.ends {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: space-between;
		color: var(--faint);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-tight);
	}

	.read {
		display: grid;
		justify-items: end;
		gap: var(--sp-2);
		min-width: 0;
		white-space: nowrap;
	}

	.live {
		color: var(--cmd-cold);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	.rew {
		color: var(--amber);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	.mut {
		color: var(--muted);
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
