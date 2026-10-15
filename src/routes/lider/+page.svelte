<!--
	LIDER: qué hacen ahora los líderes. Agenda de hoy en hora de Madrid y lo último que han hecho.
	Con ?id=lagarde (o «LIDER Lagarde» en la barra) sale solo la ficha de ese líder.
	«Tus líderes» (M25): cuáles salen y en qué orden, guardado en este navegador (src/lib/leaderprefs.ts).
-->
<script lang="ts">
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { dm, hm } from '#lib/format.ts';
	import Disclosure from '#lib/components/ui/Disclosure.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { allInOrder, cleanLeaderIds, LEADERS_KEY, moveLeader, myLeaders, toggleLeader, visibleIds } from '#lib/leaderprefs.ts';
	import { findLeader, LEADERS, nowNext, recent, today } from '#lib/leaders.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';
	import type { AgendaEvent } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Al construir la web, clock.now vale 0: se usa la hora de la descarga hasta que arranca el navegador.
	const now = $derived(clock.now || Date.parse(data.leaders?.fetchedAt ?? '') || 0);

	// El líder elegido: vale el id o lo que se escriba en la barra («Lagarde»), que se cambia por el id.
	const pick = urlState<string>('id', 'todos', (v) => v === 'todos' || !!findLeader(v));
	$effect(() => {
		const id = pick.value === 'todos' ? 'todos' : findLeader(pick.value)?.id;
		if (id && id !== pick.value) pick.value = id;
	});
	// Tus líderes: null es «todos, en el orden de siempre». Se lee al arrancar en el navegador.
	let mine = $state<string[] | null>(null);
	$effect(() => {
		try {
			mine = cleanLeaderIds(JSON.parse(localStorage.getItem(LEADERS_KEY) ?? 'null'));
		} catch {}
	});
	function keep(next: string[] | null) {
		mine = next;
		try {
			if (next) localStorage.setItem(LEADERS_KEY, JSON.stringify(next));
			else localStorage.removeItem(LEADERS_KEY);
		} catch {}
	}
	// Seg devuelve la lista entera: se busca el que ha cambiado (así el que se enciende va al final).
	function setShown(v: string[]) {
		const now = visibleIds(mine);
		const changed = SHOW_OPTIONS.find((o) => now.includes(o.value) !== v.includes(o.value));
		if (changed) keep(toggleLeader(mine, changed.value));
	}
	const surname = (name: string) => name.split(' ').slice(1).join(' ');
	const OPTIONS = $derived([{ value: 'todos', label: 'Todos' }, ...allInOrder(mine).map((l) => ({ value: l.id, label: surname(l.name) }))]);
	const SHOW_OPTIONS = LEADERS.map((l) => ({ value: l.id, label: surname(l.name) }));
	const shown = $derived(pick.value === 'todos' ? myLeaders(mine) : LEADERS.filter((l) => l.id === pick.value));

	const columns = $derived(
		shown.map((leader) => {
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
				recent: recent(leader, { gov: data.gov?.data.items, eco: data.eco?.data.items }, data.fedreg?.data.presidential ?? [])
			};
		})
	);

	const tag = (e: AgendaEvent, c: { current: AgendaEvent | null; next: AgendaEvent | null }) =>
		e === c.current ? 'ahora' : e === c.next ? 'siguiente' : '';
</script>

<ViewHeader code="LIDER" title="Líderes" sub="Qué hacen ahora: agenda de hoy en hora de Madrid y lo último que han hecho" />

<div class="pick">
	<Seg label="Líder" options={OPTIONS} bind:value={pick.value} />
	<Disclosure inline>
		{#snippet summary()}{mine ? `Tus líderes · ${mine.length} de ${LEADERS.length}` : 'Tus líderes'}{/snippet}
		<div class="mine">
			<Seg
				label="Los que salen en «Todos»"
				options={SHOW_OPTIONS}
				bind:values={() => visibleIds(mine), setShown}
			/>
			<ol class="order" aria-label="Orden">
				{#each myLeaders(mine) as l, i (l.id)}
					<li>
						<span>{l.name}</span>
						<button type="button" disabled={i === 0} onclick={() => keep(moveLeader(mine, l.id, -1))} aria-label="Subir a {l.name}">↑</button>
						<button type="button" disabled={i === visibleIds(mine).length - 1} onclick={() => keep(moveLeader(mine, l.id, 1))} aria-label="Bajar a {l.name}">↓</button>
					</li>
				{/each}
			</ol>
			{#if mine}<button class="reset" type="button" onclick={() => keep(null)}>Volver a todos, en el orden de siempre</button>{/if}
		</div>
	</Disclosure>
</div>

<div class="grid grid-2e leaders">
	{#each columns as c (c.leader.id)}
		<div class="col" class:solo={columns.length === 1}>
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
									<span class="l">{c.later.title}<small>{['siguiente', c.later.place].filter(Boolean).join(' · ')}</small></span>
									<!-- No es de hoy: con el día delante, para no confundirlo con un acto de hoy. -->
									<b>{c.later.start ? `${dm(c.later.start)} ${hm(c.later.start)}` : ''}</b>
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
			<!-- Sin comunicados recientes, el panel no sale: nada de huecos. -->
			{#if c.recent.length}
				<Panel title={columns.length > 1 ? `Lo último · ${c.leader.name}` : 'Lo último'} meta={c.leader.recentLabel}>
					<NewsList items={c.recent} />
				</Panel>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* Con 5 líderes en 3 columnas, la rejilla dejaba una celda vacía con el color de las líneas. En filas flexibles,
	   los de la última fila se reparten todo el ancho. */
	.leaders {
		display: flex;
		flex-wrap: wrap;
	}

	.leaders > .col,
	.solo > :global(*) {
		flex: 1 1 min(var(--col-min), 100%);
	}

	/* Un solo líder: agenda y «Lo último», uno al lado del otro. */
	.solo {
		display: contents;
	}

	.pick {
		display: grid;
		gap: var(--sp-8);
		justify-items: start;
		margin-bottom: var(--sp-8);
	}

	.mine {
		display: grid;
		gap: var(--sp-8);
		margin-top: var(--sp-8);
	}

	.order {
		margin: 0;
		padding: 0;
		list-style: none;
		border: var(--border);
		background: var(--panel);
	}

	.order li {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: 0 0 0 var(--pad-x);
		border-top: var(--border);
	}

	.order li:first-child {
		border-top: 0;
	}

	.order span {
		flex: 1;
		font-family: var(--sans);
	}

	.order button,
	.reset {
		min-width: var(--control-h);
		min-height: var(--control-h);
		border: 0;
		background: none;
		color: var(--amber);
		font: inherit;
		cursor: pointer;
	}

	.order button:disabled {
		color: var(--faint);
		cursor: default;
	}

	.reset {
		justify-self: start;
		padding: 0;
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	/* Ahora y siguiente: ámbar tenue, sin más. */
	.hit {
		background: var(--amber-soft);
	}

	.hit small {
		color: var(--amber);
	}
</style>
