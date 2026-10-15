<!--
	Elegir el aspecto del escritorio de Arc OS: tres tarjetas con una miniatura dibujada solo con CSS (barra, dock,
	botones de ventana) y su descripción. Es un grupo de radios: flechas para cambiar, como Seg.
-->
<script lang="ts">
	import { setSkin, shell } from './shell.svelte.ts';
	import { SKINS, type Skin } from './skins.ts';

	function move(e: KeyboardEvent, i: number) {
		const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
		if (!d) return;
		e.preventDefault();
		const next = SKINS[(i + d + SKINS.length) % SKINS.length];
		setSkin(next.id);
		((e.currentTarget as HTMLElement).parentElement?.children[SKINS.indexOf(next)] as HTMLElement | undefined)?.focus();
	}
</script>

<div class="skins" role="radiogroup" aria-label="Aspecto del escritorio">
	{#each SKINS as s, i (s.id)}
		{@const on = shell.skin === s.id}
		<button type="button" role="radio" aria-checked={on} tabindex={on ? 0 : -1} class="card" onclick={() => setSkin(s.id as Skin)} onkeydown={(e) => move(e, i)}>
			<span class="mini {s.id}" aria-hidden="true">
				{#if s.id === 'mac'}<i class="menubar"></i>{/if}
				{#if s.id === 'linux'}<i class="topbar"><b></b></i>{/if}
				<i class="win"><i class="title"><i class="btns"><i></i><i></i><i></i></i></i></i>
				{#if s.id === 'windows'}<i class="taskbar"><b></b><b></b><b></b></i>{/if}
				{#if s.id === 'mac'}<i class="dock"><b></b><b></b><b></b><b></b></i>{/if}
			</span>
			<span class="name">{s.label}</span>
			<span class="desc">{s.desc}</span>
		</button>
	{/each}
</div>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.skins {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: var(--sp-8);
	}
	.card {
		display: grid;
		align-content: start;
		gap: var(--sp-4);
		padding: var(--sp-6);
		border: var(--hair) solid var(--line);
		border-radius: var(--radius);
		text-align: left;
	}
	.card[aria-checked='true'] {
		border-color: var(--amber);
		background: var(--amber-soft);
	}
	.name {
		font-size: var(--fs-s);
		font-weight: var(--fw-medium);
	}
	.desc {
		color: var(--muted);
		font-size: var(--fs-xxs);
		line-height: var(--lh-snug);
	}
	/* Miniatura: 16:10, con piezas posicionadas (px de geometría propia). */
	.mini {
		position: relative;
		display: block;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border-radius: var(--radius-s);
		background: linear-gradient(160deg, var(--amber-soft), var(--raise));
	}
	.mini i,
	.mini b {
		position: absolute;
		display: block;
	}
	.win {
		left: 18%;
		top: 22%;
		width: 64%;
		height: 50%;
		background: var(--panel);
		border-radius: var(--radius-s);
		box-shadow: var(--shadow);
	}
	.title {
		left: 0;
		right: 0;
		top: 0;
		height: 7px;
		background: var(--raise);
	}
	.btns {
		top: 2px;
		right: 3px;
		display: flex;
		gap: 2px;
	}
	.btns i {
		position: static;
		width: 3px;
		height: 3px;
		background: var(--muted);
	}
	.mac .btns {
		left: 3px;
		right: auto;
	}
	.mac .btns i {
		border-radius: 50%;
		background: var(--down);
	}
	.mac .btns i:nth-child(2) {
		background: var(--amber);
	}
	.mac .btns i:nth-child(3) {
		background: var(--up);
	}
	.linux .win {
		border-radius: var(--radius);
	}
	.linux .btns i {
		border-radius: 50%;
	}
	.taskbar {
		left: 0;
		right: 0;
		bottom: 0;
		height: 9px;
		display: flex;
		gap: 3px;
		padding: 2px 4px;
		background: var(--panel);
	}
	.taskbar b,
	.dock b {
		position: static;
		width: 5px;
		height: 5px;
		border-radius: 1px;
		background: var(--amber);
	}
	.menubar,
	.topbar {
		left: 0;
		right: 0;
		top: 0;
		height: 6px;
		background: var(--panel);
	}
	.topbar {
		background: var(--fg);
	}
	.topbar b {
		left: 45%;
		top: 2px;
		width: 10%;
		height: 2px;
		background: var(--bg);
	}
	.dock {
		left: 30%;
		right: 30%;
		bottom: 3px;
		height: 9px;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 3px;
		border-radius: var(--radius-s);
		background: var(--panel);
	}
</style>
