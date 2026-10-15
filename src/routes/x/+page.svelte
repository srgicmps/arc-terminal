<!--
	EXP: galería de las experiencias (registro en src/lib/experiences.ts). Cada tarjeta tiene una vista previa
	en movimiento, qué es, «Abrir» y «Usar al entrar» (guarda x:<id> en arc-home, como HELP).
	«EXP periodico» llega aquí como /x?e=periodico y salta a /x/periodico. La web está prerenderizada, así que
	el parámetro se lee en el navegador.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ExpPreview from '#lib/components/ExpPreview.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { EXPERIENCES, expHref, findExperience, homeValue, type Experience } from '#lib/experiences.ts';
	import { HOME_KEY, isHomeCode } from '#lib/home.ts';
	import { readSaved, save } from '#lib/persisted.svelte.ts';

	const href = (path: string) => (resolve as (r: string) => string)(path);

	let missing = $state('');
	let home = $state<string | null>(null);
	$effect(() => {
		home = readSaved(HOME_KEY, isHomeCode);
		const q = new URLSearchParams(location.search).get('e');
		if (!q) return;
		const exp = findExperience(q);
		if (exp) goto(href(expHref(exp)), { replaceState: true });
		else missing = q;
	});

	/** «Usar al entrar»: otra vez en la misma la quita y Arc vuelve a abrirse en TOP. */
	function toggleHome(e: Experience) {
		home = home === homeValue(e) ? 'TOP' : homeValue(e);
		save(HOME_KEY, home);
	}
</script>

<ViewHeader code="EXP" title="Experiencias" sub="Otras formas de usar Arc con los mismos datos. Pruébalas: se sale con «Salir» o Esc" />

<Panel title="Experiencias" meta={`${EXPERIENCES.length}`}>
	{#if missing}<p class="miss">No hay ninguna experiencia «{missing}». Estas son las que hay:</p>{/if}
	{#if EXPERIENCES.length}
		<ul class="cards">
			{#each EXPERIENCES as e (e.id)}
				{@const isHome = home === homeValue(e)}
				<li class:home={isHome}>
					<a class="pic" href={href(expHref(e))} tabindex="-1" aria-hidden="true"><ExpPreview exp={e} /></a>
					<div class="body">
						<strong id="exp-{e.id}"><span aria-hidden="true">{e.icon}</span> {e.name}</strong>
						<span class="desc">{e.desc}</span>
						<div class="actions">
							<a class="open" href={href(expHref(e))} aria-describedby="exp-{e.id}">Abrir</a>
							<button type="button" aria-pressed={isHome} aria-describedby="exp-{e.id}" onclick={() => toggleHome(e)}>
								{isHome ? '✓ Se abre al entrar' : 'Usar al entrar'}
							</button>
							<code>EXP {e.id}</code>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">Todavía no hay experiencias.</p>
	{/if}
	{#snippet note()}«Usar al entrar» hace que Arc se abra en esa experiencia (también en HELP, «Al entrar»). Mayús + X: saltar a otra desde cualquier vista.{/snippet}
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

	li {
		display: grid;
		grid-template-rows: auto 1fr;
		border: var(--hair) solid var(--line);
	}

	li:hover,
	li:focus-within,
	li.home {
		border-color: var(--amber-edge);
	}

	.pic {
		display: block;
	}

	.body {
		display: grid;
		align-content: start;
		gap: var(--sp-6);
		padding: var(--sp-12);
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

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6);
		margin-top: var(--sp-4);
	}

	.open,
	button {
		display: inline-flex;
		align-items: center;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		border: var(--hair) solid var(--amber-edge);
		background: none;
		color: var(--amber);
		font: inherit;
		font-size: var(--fs-s);
		text-decoration: none;
		cursor: pointer;
	}

	.open {
		background: var(--amber-soft);
	}

	button {
		border-color: var(--line);
		color: var(--muted);
	}

	button[aria-pressed='true'] {
		border-color: var(--amber-edge);
		color: var(--amber);
	}

	.open:hover,
	.open:focus-visible,
	button:hover,
	button:focus-visible {
		border-color: var(--amber);
	}

	code {
		margin-left: auto;
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.miss {
		margin: 0;
		padding: var(--sp-8) var(--pad-x) 0;
	}
</style>
