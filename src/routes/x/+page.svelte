<!--
	EXP: índice de las experiencias (registro en src/lib/experiences.ts). «EXP periodico» llega aquí como
	/x?e=periodico y salta a /x/periodico. La web está prerenderizada, así que el parámetro se lee en el navegador.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { EXPERIENCES, expHref, findExperience } from '#lib/experiences.ts';

	const href = (path: string) => (resolve as (r: string) => string)(path);

	let missing = $state('');
	$effect(() => {
		const q = new URLSearchParams(location.search).get('e');
		if (!q) return;
		const exp = findExperience(q);
		if (exp) goto(href(expHref(exp)), { replaceState: true });
		else missing = q;
	});
</script>

<ViewHeader code="EXP" title="Experiencias" sub="Otras formas de usar Arc con los mismos datos" />

<Panel title="Experiencias" meta={`${EXPERIENCES.length}`}>
	{#if missing}<p class="miss">No hay ninguna experiencia «{missing}». Estas son las que hay:</p>{/if}
	{#if EXPERIENCES.length}
		<ul class="cards">
			{#each EXPERIENCES as e (e.id)}
				<li>
					<a href={href(expHref(e))}>
						<span class="icon" aria-hidden="true">{e.icon}</span>
						<strong>{e.name}</strong>
						<span class="desc">{e.desc}</span>
						<code>EXP {e.id}</code>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">Todavía no hay experiencias.</p>
	{/if}
	{#snippet note()}En HELP, «Al entrar», puedes hacer que Arc se abra directamente en una de ellas.{/snippet}
</Panel>

<style>
	.cards {
		list-style: none;
		margin: 0;
		padding: var(--sp-8) var(--pad-x);
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: var(--gutter);
	}

	a {
		display: grid;
		gap: var(--sp-4);
		height: 100%;
		padding: var(--sp-12);
		border: var(--hair) solid var(--line);
		color: inherit;
		text-decoration: none;
	}

	a:hover,
	a:focus-visible {
		border-color: var(--amber);
	}

	.icon {
		font-size: var(--fs-xl);
		line-height: 1;
	}

	strong {
		font-family: var(--sans);
		font-size: var(--fs-l);
		font-weight: var(--fw-medium);
	}

	.desc {
		color: var(--muted);
		line-height: var(--lh);
	}

	code {
		font-family: var(--mono);
		font-size: var(--fs-s);
		color: var(--amber);
	}

	.miss {
		margin: 0;
		padding: var(--sp-8) var(--pad-x) 0;
	}
</style>
