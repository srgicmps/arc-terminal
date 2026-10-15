<!--
	Predicciones (experiencia 8): antes de cada dato (IPC, paro, tipos del BCE…) apuestas tu previsión; cuando
	sale, se puntúa (100 si lo clavas, menos cuanto más te alejas). Rachas y clasificación entre los usuarios
	de Arc (con cuenta, en arcterminal.dev); sin cuenta se juega solo, en este navegador.
	Rondas: static/data/forecasts.json (scripts/sources/forecasts.ts). Reglas: src/lib/exp/forecasts.ts.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { until } from '#lib/markets.ts';
	import { exact, median, score, standings, type Round } from '#lib/exp/forecasts.ts';
	import { game, loadGame, placeBet, removeBet, setAlias } from '#lib/exp/forecasts.svelte.ts';

	$effect(() => void loadGame());

	const now = $derived(clock.now || Date.now());
	const open = $derived(game.rounds.filter((r) => !r.actual && Date.parse(r.closes) > now));
	const waiting = $derived(game.rounds.filter((r) => !r.actual && Date.parse(r.closes) <= now));
	const resolved = $derived(game.rounds.filter((r) => r.actual).reverse());
	const table = $derived(standings(game.rounds, game.bets));
	const mine = $derived(table.find((s) => s.uid === game.me.uid));
	const myBet = (r: Round) => game.bets.find((b) => b.uid === game.me.uid && b.round === r.id);

	// Lo que se escribe en cada ronda (por id).
	let drafts = $state<Record<string, string>>({});
	const num = (s: string | undefined) => Number((s ?? '').replace(',', '.').trim());
	function bet(r: Round, ev: SubmitEvent) {
		ev.preventDefault();
		const v = num(drafts[r.id]);
		if ((drafts[r.id] ?? '').trim() === '' || !Number.isFinite(v)) return;
		placeBet(r.id, v);
		drafts[r.id] = '';
	}

	let alias = $state('');
	$effect(() => {
		alias = game.me.alias ?? '';
	});

	const fmt = (v: number, d = 1) => `${v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
	const fmtWhen = (iso: string) =>
		new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
	const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
	const period = (p: string | null) => {
		const m = p && /^(\d{4})-(\d{2})$/.exec(p);
		return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : p ? p.replace('-Q', ', trimestre ') : 'decisión';
	};
	const others = (r: Round) => game.bets.filter((b) => b.round === r.id).map((b) => b.value);
</script>

<ViewHeader code="PRED" title="Predicciones" sub="Adivina el próximo dato antes de que salga: IPC, paro, tipos del BCE. Se puntúa al publicarse" />

{#if game.mode === 'cuenta' || mine}
	<Tiles cols={4}>
		<Tile label="Tus puntos" value={String(mine?.points ?? 0)} sub={(mine?.played ?? 0) === 1 ? '1 ronda' : `${mine?.played ?? 0} rondas`} />
		<Tile label="Racha" value={String(mine?.streak ?? 0)} sub="seguidas con 50 o más" />
		<Tile label="Mejor racha" value={String(mine?.best ?? 0)} />
		<Tile label="Clavadas" value={String(mine?.exact ?? 0)} sub="el dato exacto" />
	</Tiles>
{/if}

<div class="grid grid-2">
	<div class="col">
		<Panel title="Próximas rondas" meta={open.length ? `${open.length} abiertas` : ''}>
			{#if game.phase === 'loading'}
				<p class="empty">Cargando…</p>
			{:else if !open.length}
				<p class="empty">No hay rondas abiertas ahora. Se abren solas cuando se anuncia la fecha del próximo dato.</p>
			{:else}
				<ul class="rounds">
					{#each open as r (r.id)}
						{@const b = myBet(r)}
						<li>
							<div class="head">
								<b>{r.label}</b>
								<span class="mut">{period(r.period)}</span>
							</div>
							<p class="mut">
								Último: {fmt(r.base.v, r.decimals)} ({r.base.t}) · cierra {fmtWhen(r.closes)}, en {until(Date.parse(r.closes) - now)}
							</p>
							<form class="bet" onsubmit={(e) => bet(r, e)}>
								<label>
									<span class="sr-only">Tu previsión para {r.label}</span>
									<input
										inputmode="decimal"
										placeholder={b ? fmt(b.value, r.decimals) : `p. ej. ${r.base.v.toLocaleString('es-ES')}`}
										bind:value={drafts[r.id]}
									/>
								</label>
								<button type="submit">{b ? 'Cambiar' : 'Apostar'}</button>
								{#if b}
									<span class="yours">Tu apuesta: <b>{fmt(b.value, r.decimals)}</b></span>
									<button type="button" class="link" onclick={() => removeBet(r.id)}>Quitar</button>
								{/if}
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			{#if game.message}<p class="msg">{game.message}</p>{/if}
			{#snippet note()}Puntos: 100 si lo clavas y menos cuanto más te alejas (0 a partir de 0,6 puntos de error en el IPC, 0,4 en el paro y 0,5 en los tipos).
					No hay consenso de analistas gratis; se compara con el «consenso de Arc» (la mediana de todos) y con repetir el dato anterior.{/snippet}
		</Panel>

		<Panel title="Resultados" meta={resolved.length ? String(resolved.length) : ''}>
			{#if waiting.length}
				<p class="waiting">Esperando el dato: {waiting.map((r) => r.label).join(', ')}.</p>
			{/if}
			{#if resolved.length}
				<Table csv={false}>
					<thead>
						<tr><th>Dato</th><th>Salió</th><th>Tú</th><th>Puntos</th>{#if game.mode === 'cuenta'}<th class="per">Arc</th>{/if}<th class="per">Repetir</th></tr>
					</thead>
					<tbody>
						{#each resolved as r (r.id)}
							{@const b = myBet(r)}
							{@const pts = b ? score(r, b.value) : null}
							{@const cons = median(others(r))}
							<tr>
								<td class="name">{r.label}<span class="sub"> {period(r.period)}</span></td>
								<td>{fmt(r.actual!.v, r.decimals)}</td>
								<td>{b ? fmt(b.value, r.decimals) : '—'}</td>
								<td>{#if pts !== null}<b class:up={pts >= 50}>{pts}</b>{#if exact(r, b!.value)} ✓{/if}{:else}<span class="mut">—</span>{/if}</td>
								{#if game.mode === 'cuenta'}<td class="per mut">{cons === null ? '—' : score(r, cons)}</td>{/if}
								<td class="per mut">{score(r, r.base.v)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Aún no ha salido ningún dato con apuestas.</p>
			{/if}
		</Panel>
	</div>

	<div class="col">
		<Panel title="Clasificación">
			{#if game.mode === 'local'}
				<p class="empty">La clasificación entre los usuarios de Arc va con tu cuenta, en arcterminal.dev. Aquí juegas solo, en este navegador.</p>
			{:else if table.length}
				<Table csv={false}>
					<thead><tr><th>#</th><th class="l">Jugador</th><th>Puntos</th><th>Racha</th><th class="per">Clavadas</th></tr></thead>
					<tbody>
						{#each table as s, i (s.uid)}
							<tr class:hl={s.uid === game.me.uid}>
								<td>{i + 1}</td>
								<td class="l name">{s.alias}{#if s.uid === game.me.uid}<span class="sub"> (tú)</span>{/if}</td>
								<td>{s.points}</td>
								<td>{s.streak}<span class="mut"> / {s.best}</span></td>
								<td class="per">{s.exact}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Nadie ha puntuado todavía. Las apuestas de los demás se ven cuando cierra cada ronda.</p>
			{/if}
			{#if game.mode === 'cuenta'}
				<form class="alias" onsubmit={(e) => (e.preventDefault(), setAlias(alias))}>
					<label>
						<span>Tu apodo en la clasificación</span>
						<input bind:value={alias} maxlength="20" placeholder="Sin apodo, sales como «Jugador …»" />
					</label>
					<button type="submit">Guardar</button>
				</form>
			{/if}
			{#snippet note()}Nadie ve tu email: solo tu apodo. Las apuestas de los demás se enseñan al cerrar cada ronda, para que nadie copie.{/snippet}
		</Panel>
	</div>
</div>

<style>
	.rounds {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rounds li {
		display: grid;
		gap: var(--sp-6);
		padding: var(--sp-10) var(--pad-x);
		border-bottom: var(--border);
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-8);
	}
	.head b {
		font-family: var(--sans);
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
	}
	.rounds p {
		margin: 0;
		font-size: var(--fs-xs);
	}
	.bet,
	.alias {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--sp-6);
	}
	.alias {
		padding: var(--sp-10) var(--pad-x);
		border-top: var(--border);
	}
	.alias label {
		display: grid;
		gap: var(--sp-4);
		flex: 1 1 12em;
	}
	.alias span {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	input {
		width: 9em;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--raise);
		border: var(--border);
		color: var(--fg);
		font: inherit;
	}
	.alias input {
		width: 100%;
	}
	input:focus {
		outline: none;
		border-color: var(--amber);
	}
	button {
		height: var(--control-h);
		padding: 0 var(--pad-x);
		background: none;
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		cursor: pointer;
	}
	button:hover,
	button:focus-visible {
		border-color: var(--amber);
	}
	button.link {
		padding: 0;
		border: 0;
		font-size: var(--fs-xs);
	}
	.yours {
		align-self: center;
		font-size: var(--fs-xs);
		color: var(--muted);
	}
	.yours b {
		color: var(--fg);
	}
	.msg,
	.waiting {
		margin: 0;
		padding: var(--sp-8) var(--pad-x);
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
