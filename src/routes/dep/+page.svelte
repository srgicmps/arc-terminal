<!--
	DEP (F20): LaLiga y Champions (football-data.org, con token) y Fórmula 1 (Jolpica, sin clave).
	Todo sale de static/data/football.json y f1.json; las horas, en hora de Madrid.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { isLive, nextRaces, results, sportsSentence, upcoming, type Match } from '#lib/sports.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Hora de referencia: la de los datos al construir y, ya en el navegador, la de ahora.
	let now = $state(0);
	$effect(() => {
		now = Date.now();
	});
	const ref = $derived(now || Date.parse(data.football?.fetchedAt ?? data.f1?.fetchedAt ?? '') || 0);

	const competitions = $derived(data.football?.data.competitions ?? []);
	const f1 = $derived(data.f1?.data);
	const plain = $derived([sportsSentence(data.football?.data, f1)].filter(Boolean));

	const TZ = 'Europe/Madrid';
	const when = (iso: string) => {
		const d = new Date(iso);
		const date = d.toLocaleDateString('es-ES', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
		return iso.length > 10 ? `${date} · ${d.toLocaleTimeString('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}` : date;
	};
	const score = (m: Match) => (m.homeGoals === null || m.awayGoals === null ? '–' : `${m.homeGoals}–${m.awayGoals}`);
</script>

<ViewHeader code="DEP" title="Deportes" sub="LaLiga, Champions y Fórmula 1 · football-data.org y Jolpica" {plain} />

<div class="grid grid-2">
	{#each competitions as c (c.code)}
		<div class="col">
			<Panel title={c.name} meta={c.table.length ? `${c.table.length} equipos` : undefined}>
				{#if c.table.length}
					<Table maxHeight="420px">
						<thead><tr><th>#</th><th class="l">Equipo</th><th>PJ</th><th class="per">G</th><th class="per">E</th><th class="per">P</th><th>DG</th><th>Pts</th></tr></thead>
						<tbody>
							{#each c.table as r (r.pos + r.team)}
								<tr><td class="mut">{r.pos}</td><td class="name">{r.team}</td><td>{r.played}</td><td class="per">{r.won}</td><td class="per">{r.draw}</td><td class="per">{r.lost}</td><td>{r.gd > 0 ? '+' : ''}{r.gd}</td><td><b>{r.points}</b></td></tr>
							{/each}
						</tbody>
					</Table>
				{:else}
					<p class="empty">Sin clasificación por ahora.</p>
				{/if}
				{#snippet note()}Fuente: <a href="https://www.football-data.org" target="_blank" rel="noopener">football-data.org</a> · <Updated at={data.football?.fetchedAt} source="football" />{/snippet}
			</Panel>
			<Panel title="{c.name} · partidos">
				{@const done = results(c.matches, 8)}
				{@const next = upcoming(c.matches, ref, 8)}
				{#if done.length || next.length}
					<Table csv={false}>
						<tbody>
							{#each done as m (m.date + m.home)}
								<tr><td class="mut l">{when(m.date)}</td><td class="name">{m.home}</td><td class={isLive(m) ? 'live' : ''}><b>{score(m)}</b></td><td class="name">{m.away}</td><td class="mut per">{isLive(m) ? 'En juego' : m.round}</td></tr>
							{/each}
							{#each next as m (m.date + m.home)}
								<tr><td class="mut l">{when(m.date)}</td><td class="name">{m.home}</td><td class="mut">vs</td><td class="name">{m.away}</td><td class="mut per">{m.round}</td></tr>
							{/each}
						</tbody>
					</Table>
				{:else}
					<p class="empty">Sin partidos en estas semanas.</p>
				{/if}
				{#snippet note()}Resultados de las dos últimas semanas y próximos partidos · el plan gratuito puede ir con retraso{/snippet}
			</Panel>
		</div>
	{:else}
		<div class="col">
			<Panel title="Fútbol">
				<p class="empty">Falta el token gratuito de football-data.org (Secret FOOTBALL_DATA_TOKEN). Mientras, solo sale la F1.</p>
			</Panel>
		</div>
	{/each}
</div>

{#if f1}
	<div class="grid grid-3">
		<div class="col">
			<Panel title="F1 · pilotos" meta="{f1.season} · tras {f1.round} carreras">
				<Table maxHeight="420px">
					<thead><tr><th>#</th><th class="l">Piloto</th><th class="l per">Equipo</th><th>Vict.</th><th>Pts</th></tr></thead>
					<tbody>
						{#each f1.drivers as d (d.name)}
							<tr><td class="mut">{d.pos}</td><td class="name">{d.name}</td><td class="l mut per">{d.team}</td><td>{d.wins}</td><td><b>{d.points}</b></td></tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}Fuente: <a href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noopener">Jolpica</a> (CC BY-NC-SA 4.0) · <Updated at={data.f1?.fetchedAt} source="f1" />{/snippet}
			</Panel>
			<Panel title="F1 · escuderías">
				<Table>
					<thead><tr><th>#</th><th class="l">Escudería</th><th>Vict.</th><th>Pts</th></tr></thead>
					<tbody>
						{#each f1.teams as t (t.team)}
							<tr><td class="mut">{t.pos}</td><td class="name">{t.team}</td><td>{t.wins}</td><td><b>{t.points}</b></td></tr>
						{/each}
					</tbody>
				</Table>
			</Panel>
		</div>
		<div class="col">
			{#if f1.last}
				<Panel title="F1 · última carrera" meta="{f1.last.name} · {when(f1.last.date)}">
					<Table csv={false}>
						<tbody>
							{#each f1.last.results as r (r.pos)}
								<tr><td class="mut">{r.pos}</td><td class="name">{r.name}<span class="sub"> {r.team}</span></td><td class="mut">{r.time}</td><td>{r.points ? `+${r.points}` : ''}</td></tr>
							{/each}
						</tbody>
					</Table>
				</Panel>
			{/if}
		</div>
		<div class="col">
			<Panel title="F1 · próximas carreras">
				{@const races = nextRaces(f1.next, ref, 6)}
				{#if races.length}
					<Table csv={false}>
						<tbody>
							{#each races as r (r.round)}
								<tr><td class="mut">{r.round}</td><td class="name">{r.name}<span class="sub"> {r.country}</span></td><td class="mut l">{when(r.date)}</td></tr>
							{/each}
						</tbody>
					</Table>
				{:else}
					<p class="empty">Temporada terminada.</p>
				{/if}
			</Panel>
		</div>
	</div>
{/if}

<style>
	.live {
		color: var(--amber);
	}
</style>
