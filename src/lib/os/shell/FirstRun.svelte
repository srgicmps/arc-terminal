<!--
	Primer arranque de Arc OS: antes de nada, «¿Cómo quieres tu escritorio?» con los tres aspectos. Se puede
	cambiar luego en el Panel de control. Sale una vez (cuando aún no hay arc-os-skin guardado).
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { setSkin, shell } from './shell.svelte.ts';
	import SkinPicker from './SkinPicker.svelte';

	let box = $state<HTMLElement>();
	$effect(() => {
		tick().then(() => box?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
	});
</script>

<div class="first" role="dialog" aria-modal="true" aria-labelledby="os-first-title" bind:this={box}>
	<div class="card">
		<h2 id="os-first-title">¿Cómo quieres tu escritorio?</h2>
		<p class="mut">Los mismos datos y las mismas ventanas, con la barra y los menús que te resulten más familiares. Lo puedes cambiar cuando quieras en el Panel de control (⚙).</p>
		<SkinPicker />
		<div class="go"><button type="button" onclick={() => setSkin(shell.skin)}>Empezar</button></div>
	</div>
</div>

<style>
	.first {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: grid;
		place-items: center;
		padding: var(--sp-16);
		background: var(--os-veil);
		backdrop-filter: var(--os-blur);
	}
	.card {
		width: min(640px, 100%);
		padding: var(--sp-24);
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--os-menu-radius, var(--radius));
		box-shadow: var(--shadow-pop);
	}
	h2 {
		margin: 0 0 var(--sp-8);
		font-family: var(--title-font);
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
	}
	p {
		margin: 0 0 var(--sp-16);
		font-size: var(--fs-s);
		line-height: var(--lh-text);
	}
	.go {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--sp-16);
	}
	.go button {
		flex: 0 0 auto;
		width: auto;
		height: var(--control-h);
		padding: 0 var(--sp-20);
		border: 0;
		border-radius: var(--radius-s);
		background: var(--amber);
		color: var(--on-amber);
		font: inherit;
		font-weight: var(--fw-medium);
		cursor: pointer;
	}
</style>
