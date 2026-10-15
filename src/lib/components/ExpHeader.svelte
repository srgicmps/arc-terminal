<!--
	Cabecera común de las experiencias (src/routes/x/<id>): icono y nombre, un selector para saltar a otra
	experiencia y «✕ Salir» (o Esc) para volver a la vista normal. Así todas tienen la misma salida, sea cual sea su forma.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { EXPERIENCES, expHref, type Experience } from '#lib/experiences.ts';

	interface Props {
		exp: Experience;
		/** Una línea bajo el nombre (fecha, edición…). */
		sub?: string;
		/** Controles a la derecha. */
		aside?: Snippet;
	}

	let { exp, sub, aside }: Props = $props();

	const href = (path: string) => (resolve as (r: string) => string)(path);
	const jump = (id: string) => {
		const next = EXPERIENCES.find((e) => e.id === id);
		if (next && next.id !== exp.id) goto(href(expHref(next)));
	};
</script>

<svelte:head>
	<title>{exp.name} · Arc Terminal</title>
</svelte:head>

<header class="xh">
	<div class="who">
		<a class="back" href={href('/')} title="Volver a la vista normal de Arc (Esc)">✕ Salir</a>
		<h1><span aria-hidden="true">{exp.icon}</span> {exp.name}</h1>
		{#if sub}<p>{sub}</p>{/if}
	</div>
	<div class="side">
		{#if aside}{@render aside()}{/if}
		{#if EXPERIENCES.length > 1}
			<label>
				<span class="sr">Otra experiencia</span>
				<select value={exp.id} onchange={(e) => jump(e.currentTarget.value)}>
					{#each EXPERIENCES as e (e.id)}<option value={e.id}>{e.icon} {e.name}</option>{/each}
				</select>
			</label>
		{/if}
	</div>
</header>

<style>
	.xh {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-8) var(--sp-16);
		padding-block: var(--sp-2) var(--sp-12);
	}

	.who {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-4) var(--sp-12);
		min-width: 0;
	}

	.back {
		display: inline-flex;
		align-items: center;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		border: var(--hair) solid var(--amber-edge);
		font-family: var(--mono);
		font-size: var(--fs-s);
		color: var(--amber);
		text-decoration: none;
	}

	.back:hover,
	.back:focus-visible {
		border-color: var(--amber);
		background: var(--amber-soft);
	}

	h1 {
		margin: 0;
		font-family: var(--sans);
		font-weight: var(--fw-medium);
		font-size: var(--fs-xl);
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.side {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8);
	}

	select {
		background: var(--raise);
		border: var(--border);
		color: var(--fg);
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		font-size: var(--fs-s);
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
