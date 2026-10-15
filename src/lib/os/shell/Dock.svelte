<!--
	Dock del aspecto Mac: centrado abajo, con las apps ancladas y las abiertas (un punto debajo si tienen ventana),
	una lupa al pasar el ratón que agranda los iconos cercanos (skins.ts → magnify) y, al final, Launchpad.
	Tocar una app abierta la trae al frente (o la minimiza si ya estaba delante); una cerrada, la abre.
-->
<script lang="ts">
	import * as os from './bridge.ts';
	import { shell, toggle } from './shell.svelte.ts';
	import { magnify } from './skins.ts';
	import type { StartApp } from './start.ts';

	const wins = $derived(os.windows());
	const byId = new Map(os.apps.map((a) => [a.id, a]));
	const items = $derived.by(() => {
		const ids = [...shell.pinned, ...wins.map((w) => w.appId).filter((id) => !shell.pinned.includes(id))];
		return [...new Set(ids)].map((id) => byId.get(id)).filter((a): a is StartApp => !!a);
	});

	let pointer = $state<number | null>(null);
	let list = $state<HTMLUListElement>();
	let centers = $state<number[]>([]);

	function measure() {
		centers = [...(list?.children ?? [])].map((el) => {
			const r = el.getBoundingClientRect();
			return r.left + r.width / 2;
		});
	}
	const scale = (i: number) => (pointer === null || centers[i] === undefined ? 1 : magnify(pointer - centers[i]));

	function press(a: StartApp) {
		const mine = wins.filter((w) => w.appId === a.id);
		if (!mine.length) return os.open(a.id);
		os.activate((mine.find((w) => w.focused) ?? mine[0]).id);
	}
</script>

<nav class="dockwrap" aria-label="Dock">
	<ul
		class="dock"
		bind:this={list}
		onpointerenter={measure}
		onpointermove={(e) => e.pointerType === 'mouse' && (pointer = e.clientX)}
		onpointerleave={() => (pointer = null)}
	>
		{#each items as a, i (a.id)}
			{@const open = wins.some((w) => w.appId === a.id)}
			<li style:--s={scale(i)}>
				<button type="button" aria-label={`${a.title}${open ? ' (abierta)' : ''}`} onclick={() => press(a)}>
					<span class="ico" aria-hidden="true">{a.icon ?? '·'}</span>
					<span class="tip" aria-hidden="true">{a.title}</span>
				</button>
				{#if open}<i class="dot" aria-hidden="true"></i>{/if}
			</li>
		{/each}
		<li class="sep" aria-hidden="true"></li>
		<li style:--s={scale(items.length + 1)}>
			<button type="button" aria-label="Launchpad: todas las apps" aria-expanded={shell.open === 'launchpad'} onclick={() => toggle('launchpad')}>
				<span class="ico grid" aria-hidden="true">⊞</span>
				<span class="tip" aria-hidden="true">Launchpad</span>
			</button>
		</li>
	</ul>
</nav>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.dockwrap {
		display: flex;
		justify-content: center;
		height: var(--os-dock-h);
		padding-bottom: var(--sp-6);
	}
	.dock {
		pointer-events: auto;
		display: flex;
		align-items: flex-end;
		gap: var(--sp-6);
		margin: 0;
		padding: var(--sp-4) var(--sp-8);
		list-style: none;
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--os-menu-radius, var(--radius));
		box-shadow: var(--shadow);
		backdrop-filter: var(--panel-blur);
	}
	li {
		position: relative;
		display: grid;
		justify-items: center;
	}
	.ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: var(--os-icon-radius, var(--radius));
		background: var(--raise);
		color: var(--amber);
		font-size: var(--fs-l);
		transform: scale(var(--s, 1));
		transform-origin: bottom center;
		transition: transform var(--dur-fast) var(--ease);
	}
	@media (prefers-reduced-motion: reduce) {
		.ico {
			transform: none;
		}
	}
	.tip {
		position: absolute;
		bottom: calc(100% + var(--sp-24));
		left: 50%;
		display: none;
		padding: var(--sp-2) var(--sp-8);
		transform: translateX(-50%);
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--radius-s);
		font-size: var(--fs-xs);
		white-space: nowrap;
		pointer-events: none;
	}
	button:hover .tip,
	button:focus-visible .tip {
		display: block;
	}
	.dot {
		position: absolute;
		bottom: calc(-1 * var(--sp-4));
		width: var(--sp-4);
		height: var(--sp-4);
		border-radius: 50%;
		background: var(--fg);
	}
	.sep {
		align-self: stretch;
		width: var(--hair);
		margin: var(--sp-4) var(--sp-2);
		background: var(--line);
	}
</style>
