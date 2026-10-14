<!-- LIDER: qué hacen ahora los líderes. Agenda de hoy en hora de Madrid y lo último que han hecho. -->
<script lang="ts">
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { hm } from '#lib/format.ts';
	import { LEADERS, nowNext, recent, today } from '#lib/leaders.ts';
	import type { AgendaEvent } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Al construir la web, clock.now vale 0: se usa la hora de la descarga hasta que arranca el navegador.
	const now = $derived(clock.now || Date.parse(data.leaders?.fetchedAt ?? '') || 0);

	const columns = $derived(
		LEADERS.map((leader) => {
			const agenda = data.leaders?.data.find((a) => a.id === leader.id);
			const events = agenda?.events ?? null;
			const day = events ? today(events, now) : [];
			const { current, next } = events ? nowNext(events, now) : { current: null, next: null };
			return {
				leader,
				agenda,
				day,
				current,
				// Si hoy ya no queda nada, el siguiente acto (mañana) sale aparte.
				later: next && !day.includes(next) ? next : null,
				next,
				recent: recent(leader, data.gov?.data.items ?? [], data.fedreg?.data.presidential ?? [])
			};
		})
	);

	const tag = (e: AgendaEvent, c: { current: AgendaEvent | null; next: AgendaEvent | null }) =>
		e === c.current ? 'ahora' : e === c.next ? 'siguiente' : '';
</script>

<ViewHeader code="LIDER" title="Líderes" sub="Qué hacen ahora: agenda de hoy en hora de Madrid y lo último que han hecho" />

<div class="grid grid-2e">
	{#each columns as c (c.leader.id)}
		<div class="col">
			<Panel title={c.leader.name} meta={c.leader.role}>
				{#if c.agenda?.events}
					{#if c.day.length || c.later}
						<ul class="mini">
							{#each c.day as e, i (i)}
								<li class:hit={tag(e, c)}>
									<span class="l">
										{e.title}
										{#if e.place || tag(e, c)}<small>{[tag(e, c), e.place].filter(Boolean).join(' · ')}</small>{/if}
									</span>
									<b>{e.start ? hm(e.start) : 'Sin hora'}</b>
								</li>
							{/each}
							{#if c.later}
								<li class="hit">
									<span class="l">{c.later.title}<small>siguiente · {c.later.place}</small></span>
									<b>{c.later.start ? hm(c.later.start) : ''}</b>
								</li>
							{/if}
						</ul>
					{:else}
						<p class="empty">Hoy no tiene actos públicos en la agenda.</p>
					{/if}
				{/if}
				{#snippet note()}
					{#if c.agenda?.events}
						Agenda: <a href={c.agenda.source.url} target="_blank" rel="noopener">{c.agenda.source.name}</a>, en hora de Madrid ·
						<Updated at={data.leaders?.fetchedAt} source="leaders" />
					{:else}
						Sin agenda pública disponible ahora mismo.
					{/if}
				{/snippet}
			</Panel>
			<Panel title="Lo último" meta={c.leader.fedreg ? 'Casa Blanca y Federal Register' : 'Comunicados de La Moncloa'}>
				<NewsList items={c.recent} />
			</Panel>
		</div>
	{/each}
</div>

<style>
	/* Ahora y siguiente: ámbar tenue, sin más. */
	.hit {
		background: var(--amber-soft);
	}

	.hit small {
		color: var(--amber);
	}
</style>
