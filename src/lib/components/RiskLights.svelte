<!--
	Semáforo de riesgo (TOP, dentro del panel «Termómetro de riesgo»): una fila con el último dato de cada
	indicador y un punto por estado: gris en calma, ámbar tenue en vigilancia y ámbar en tensión (verde y rojo
	quedan para subidas y bajadas). Los umbrales, en src/lib/risk-lights.ts; se calculan en el +page.server.ts.
-->
<script lang="ts">
	import type { Light } from '#lib/risk-lights.ts';

	let { lights }: { lights: Light[] } = $props();

	const WORD = { calm: 'calma', watch: 'vigilancia', stress: 'tensión' } as const;
</script>

{#if lights.length}
	<ul class="lights" aria-label="Semáforo de riesgo">
		{#each lights as l (l.id)}
			<li class={l.level} title="{l.name} · {WORD[l.level]} · umbrales: {l.rule} · {l.date}">
				<span class="lbl"><i aria-hidden="true"></i>{l.label}</span>
				<b>{l.value}</b>
				<span class="sr">{WORD[l.level]}</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.lights {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
		border-bottom: var(--border);
	}

	li {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-6) var(--pad-x);
		border-right: var(--border);
		cursor: default;
	}

	.lbl {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		color: var(--faint);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
		white-space: nowrap;
	}

	i {
		width: var(--sp-6);
		height: var(--sp-6);
		border-radius: 50%;
		border: var(--hair) solid var(--muted);
	}

	b {
		font-weight: var(--fw-regular);
		color: var(--fg);
	}

	.watch i {
		background: var(--amber-dim);
		border-color: var(--amber-dim);
	}

	.stress i {
		background: var(--amber);
		border-color: var(--amber);
	}

	.stress b {
		color: var(--amber);
	}

</style>
