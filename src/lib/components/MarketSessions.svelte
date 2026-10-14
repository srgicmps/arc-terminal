<!--
	Sesiones de las bolsas del mundo en una barra de 24 h, en hora de Madrid: una fila por bolsa con sus
	horas abiertas (en ámbar tenue la que está abierta ahora), una línea de 1 px en la hora actual y
	cuánto falta para que abra o cierre. Respeta fines de semana y los festivos de src/lib/markets.ts.
	Va sin <Panel> para poder ponerlo en cualquier vista (WS, TOP).
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { hm } from '#lib/format.ts';
	import { madridDay, MARKETS, marketStatus, until } from '#lib/markets.ts';

	// Hasta que la página arranca en el navegador, clock.now es 0: barras vacías y sin cuenta atrás.
	const rows = $derived(
		MARKETS.map((mk) => {
			if (!clock.now) return { mk, spans: [] as [number, number][], status: null };
			return { mk, spans: madridDay(mk, clock.now).spans, status: marketStatus(mk, clock.now) };
		})
	);
	const nowFrac = $derived(clock.now ? madridDay(MARKETS[0], clock.now).now : null);

	// La próxima apertura de las que están cerradas: «NY abre en 2 h 10 min».
	const soonest = $derived(
		rows
			.filter((r) => r.status && !r.status.isOpen && r.status.next)
			.sort((a, b) => a.status!.next! - b.status!.next!)[0]
	);
	const openCount = $derived(rows.filter((r) => r.status?.isOpen).length);

	function label(r: (typeof rows)[number]): string {
		const st = r.status;
		if (!st) return '—';
		if (!st.next) return 'cerrada';
		const left = until(st.next - clock.now);
		if (st.isOpen) return `cierra en ${left}`;
		return st.holiday ? `festivo · abre en ${left}` : `abre en ${left}`;
	}

	const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
</script>

<div class="sessions" aria-label="Sesiones de las bolsas en hora de Madrid">
	<p class="sum">
		{#if clock.now}
			<b>{hm(new Date(clock.now).toISOString())}</b> en Madrid · {openCount}
			{openCount === 1 ? 'bolsa abierta' : 'bolsas abiertas'}{#if soonest}{' · '}{soonest.mk.short} abre en {until(soonest.status!.next! - clock.now)}{/if}
		{:else}
			Hora de Madrid
		{/if}
	</p>

	<div class="board">
		<div class="row ticks" aria-hidden="true">
			<span></span>
			<div class="scale">
				{#each [0, 6, 12, 18, 24] as h (h)}<span style:left={pct(h / 24)}>{h}</span>{/each}
			</div>
			<span></span>
		</div>

		{#each rows as r (r.mk.code)}
			<div class="row" class:open={r.status?.isOpen}>
				<span class="name">{r.mk.name}</span>
				<div class="track">
					{#each r.spans as [a, b], i (i)}
						<i class="span" style:left={pct(a)} style:width={pct(b - a)}></i>
					{/each}
				</div>
				<span class="st">{label(r)}</span>
			</div>
		{/each}

		{#if nowFrac !== null}
			<div class="now-lane" aria-hidden="true"><i class="now" style:left={pct(nowFrac)}></i></div>
		{/if}
	</div>
</div>

<style>
	.sessions {
		--name-w: 84px;
		--st-w: 150px;
		padding: var(--sp-8) var(--pad-x) var(--sp-10);
		font-size: var(--fs-s);
	}

	.sum {
		margin: 0 0 var(--sp-8);
		color: var(--muted);
	}

	.sum b {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.board {
		position: relative;
	}

	.row {
		display: grid;
		grid-template-columns: var(--name-w) minmax(0, 1fr) var(--st-w);
		align-items: center;
		gap: var(--sp-10);
		padding-block: var(--sp-3);
	}

	.name {
		font-family: var(--sans);
		font-size: var(--fs-m);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.st {
		color: var(--muted);
		text-align: right;
		white-space: nowrap;
	}

	.open .st {
		color: var(--fg);
	}

	.track {
		position: relative;
		height: 10px;
		background: var(--raise);
	}

	.span {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--neutral);
	}

	.open .span {
		background: var(--amber-edge);
	}

	.ticks {
		padding-block: 0;
	}

	.scale {
		position: relative;
		height: calc(var(--fs-xs) * var(--lh-tight));
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.scale span {
		position: absolute;
		transform: translateX(-50%);
	}

	.scale span:first-child {
		transform: none;
	}

	.scale span:last-child {
		transform: translateX(-100%);
	}

	/* La línea de «ahora» cruza todas las filas: va en una capa con la misma rejilla que la pista. */
	.now-lane {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--name-w) + var(--sp-10));
		right: calc(var(--st-w) + var(--sp-10));
		pointer-events: none;
	}

	.now {
		position: absolute;
		top: 0;
		bottom: 0;
		width: var(--hair);
		background: var(--amber);
	}

	/* En el móvil: nombre y estado en una línea y la barra debajo, a todo el ancho. */
	@media (max-width: 720px) {
		.row {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas: 'name st' 'track track';
			gap: var(--sp-3) var(--sp-8);
			padding-block: var(--sp-4);
		}

		.name {
			grid-area: name;
		}

		.st {
			grid-area: st;
		}

		.track {
			grid-area: track;
		}

		.ticks {
			grid-template-areas: 'track track';
		}

		.ticks > span {
			display: none;
		}

		.scale {
			grid-area: track;
		}

		.now-lane {
			left: 0;
			right: 0;
		}
	}
</style>
