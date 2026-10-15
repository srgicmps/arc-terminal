<!--
	Barra de tareas de Arc OS (abajo o arriba): botón Inicio, apps ancladas, ventanas abiertas (con su estado:
	en primer plano, abierta o minimizada; al pasar, su nombre completo) y la bandeja: escritorios, bolsas y
	reloj, notificaciones, cuenta y panel de control. Todo con teclado: Tab recorre, Intro abre.
-->
<script lang="ts">
	import Logo from '#lib/components/Logo.svelte';
	import ContextMenu, { type MenuEntry } from '#lib/components/os/ContextMenu.svelte';
	import { appMenu, winMenu } from './menus.ts';
	import { cloud } from '#lib/cloud.svelte.ts';
	import NoticeCenter from './NoticeCenter.svelte';
	import { shell, toggle } from './shell.svelte.ts';
	import StartMenu from './StartMenu.svelte';
	import type { StartApp } from './start.ts';
	import TrayClock from './TrayClock.svelte';
	import type { DeskInfo, TaskWin } from './types.ts';

	interface Props {
		apps: StartApp[];
		windows: TaskWin[];
		desks: DeskInfo[];
		onopen: (appId: string) => void;
		onactivate: (winId: string) => void;
		ondesk: (deskId: string) => void;
		onnavigate: (href: string) => void;
		/** Aviso del núcleo («Hay 12 ventanas…»). */
		status?: string | null;
	}
	let { apps, windows, desks, onopen, onactivate, ondesk, onnavigate, status = null }: Props = $props();

	const byId = $derived(new Map(apps.map((a) => [a.id, a])));
	// Ancladas sin ventana abierta (las abiertas ya salen como ventana).
	const pinnedIdle = $derived(shell.pinned.filter((id) => byId.has(id) && !windows.some((w) => w.appId === id)).map((id) => byId.get(id)!));
	const short = (s: string) => s.slice(0, 2);

	let menu = $state<{ x: number; y: number; items: MenuEntry[] } | null>(null);
	const ctx = (e: MouseEvent, items: MenuEntry[]) => (e.preventDefault(), (menu = { x: e.clientX, y: e.clientY, items }));
</script>

<nav class="taskbar" class:top={shell.bar === 'top'} aria-label="Barra de tareas">
	<div class="start-wrap">
		<button type="button" class="startbtn" aria-expanded={shell.open === 'start'} aria-controls="os-start" aria-label="Inicio" onclick={() => toggle('start')}>
			<Logo />
		</button>
		{#if shell.open === 'start'}<StartMenu {apps} {onopen} />{/if}
	</div>

	<ul class="tasks">
		{#each pinnedIdle as a (a.id)}
			<li><button type="button" class="task idle" title={a.title} aria-label={`Abrir ${a.title}`} onclick={() => onopen(a.id)} oncontextmenu={(e) => ctx(e, appMenu(a.id))}><span class="ico">{a.icon ?? short(a.code ?? a.title)}</span></button></li>
		{/each}
		{#each windows as w (w.id)}
			<li>
				<button
					type="button"
					class="task"
					class:focused={w.focused}
					class:min={w.minimized}
					aria-pressed={w.focused}
					title={`${w.title}${w.minimized ? ' (minimizada)' : ''}`}
					onclick={() => onactivate(w.id)}
					oncontextmenu={(e) => ctx(e, winMenu(w))}
				>
					<span class="ico">{w.icon ?? byId.get(w.appId)?.icon ?? short(w.title)}</span>
					<span class="label">{w.title}</span>
				</button>
				<span class="peek" aria-hidden="true">
					<b>{w.title}</b>
					<span>{byId.get(w.appId)?.desc ?? ''}</span>
					<i>{w.focused ? 'En primer plano' : w.minimized ? 'Minimizada' : 'Abierta'}</i>
				</span>
			</li>
		{/each}
	</ul>

	{#if status}<span class="status" role="status">{status}</span>{/if}
	<div class="tray">
		{#if desks.length > 1}
			<div class="desks" role="group" aria-label="Escritorios">
				{#each desks as d, i (d.id)}
					<button type="button" aria-pressed={d.active} title={d.name} onclick={() => ondesk(d.id)}>{i + 1}</button>
				{/each}
			</div>
		{/if}
		<TrayClock />
		<NoticeCenter {onnavigate} />
		<button type="button" class="tray-btn" aria-expanded={shell.open === 'control'} aria-controls="os-control" aria-label="Panel de control" onclick={() => toggle('control')}>
			<span aria-hidden="true">⚙</span>
		</button>
		<span class="user mut" title={cloud.user || 'Sin cuenta (solo en este navegador)'}>{cloud.user ? cloud.user.slice(0, 1).toUpperCase() : '·'}</span>
	</div>
</nav>
{#if menu}<ContextMenu x={menu.x} y={menu.y} items={menu.items} label="Menú de la ventana" onclose={() => (menu = null)} />{/if}

<style>
	/* Botones de la shell sin el borde ni el fondo que algunas estéticas dan a todos los botones. */
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.taskbar {
		position: relative;
		z-index: var(--z-bar);
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		height: var(--os-bar-h);
		padding: 0 var(--sp-6);
		background: var(--panel);
		border-top: var(--hair) solid var(--panel-edge);
		backdrop-filter: var(--panel-blur);
	}
	.taskbar.top {
		order: -1;
		border-top: 0;
		border-bottom: var(--hair) solid var(--panel-edge);
	}
	.start-wrap {
		position: relative;
	}
	.startbtn {
		display: grid;
		place-items: center;
		width: var(--control-h);
		height: var(--control-h);
		border-radius: var(--radius-s);
		color: var(--amber);
	}
	.startbtn[aria-expanded='true'],
	.startbtn:hover {
		background: var(--raise);
	}
	.tasks {
		flex: 1;
		min-width: 0;
		display: flex;
		gap: var(--sp-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.task {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		max-width: 180px;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-8);
		border-radius: var(--radius-s);
		color: var(--muted);
	}
	.task:hover {
		background: var(--raise);
		color: var(--fg);
	}
	.task.focused {
		background: var(--raise);
		color: var(--fg);
	}
	/* Raya de estado: ámbar si está delante, fina y tenue si está abierta detrás, ninguna si minimizada. */
	.task::after {
		content: '';
		position: absolute;
		left: 30%;
		right: 30%;
		bottom: 0;
		height: var(--hair);
		background: var(--faint);
	}
	.top .task::after {
		top: 0;
		bottom: auto;
	}
	.task.focused::after {
		left: 15%;
		right: 15%;
		background: var(--amber);
	}
	.task.min::after,
	.task.idle::after {
		display: none;
	}
	/* Sin scroll (cortaría la vista previa): con muchas ventanas, los nombres se acortan. */
	.tasks li {
		position: relative;
		min-width: 0;
	}
	.tasks li .task {
		max-width: 100%;
	}
	/* Vista previa al pasar o con el foco: nombre, qué es y su estado. */
	.peek {
		position: absolute;
		left: 0;
		bottom: calc(100% + var(--sp-8));
		display: none;
		gap: var(--sp-2);
		width: 220px;
		padding: var(--sp-8) var(--sp-10);
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--radius);
		box-shadow: var(--shadow-pop);
		font-size: var(--fs-xs);
		pointer-events: none;
	}
	.top .peek {
		top: calc(100% + var(--sp-8));
		bottom: auto;
	}
	.tasks li:hover .peek,
	.tasks li:focus-within .peek {
		display: grid;
	}
	.peek b {
		font-size: var(--fs-s);
		font-weight: var(--fw-medium);
	}
	.peek i {
		color: var(--amber);
		font-style: normal;
	}
	.status {
		color: var(--amber);
		font-size: var(--fs-xs);
		white-space: nowrap;
	}
	.ico {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-s);
	}
	.tray {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.tray :global(.tray-btn) {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		height: var(--control-h);
		padding: 0 var(--sp-8);
		border-radius: var(--radius-s);
		color: var(--fg);
		font-size: var(--fs-s);
	}
	.tray :global(.tray-btn:hover),
	.tray :global(.tray-btn[aria-expanded='true']) {
		background: var(--raise);
	}
	/* Desplegables de la barra: encima si la barra va abajo y debajo si va arriba. */
	.taskbar :global(.pop) {
		position: absolute;
		bottom: calc(100% + var(--sp-8));
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--radius);
		box-shadow: var(--shadow-pop);
		z-index: var(--z-popover);
	}
	.taskbar.top :global(.pop) {
		top: calc(100% + var(--sp-8));
		bottom: auto;
	}
	.desks {
		display: flex;
		gap: var(--sp-2);
		margin-right: var(--sp-4);
	}
	.desks button {
		min-width: var(--sp-20);
		height: var(--sp-20);
		border: var(--hair) solid var(--line);
		border-radius: var(--radius-s);
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xxs);
	}
	.desks button[aria-pressed='true'] {
		border-color: var(--amber-edge);
		color: var(--amber);
	}
	.user {
		display: grid;
		place-items: center;
		width: var(--sp-24);
		height: var(--sp-24);
		margin-left: var(--sp-4);
		border: var(--hair) solid var(--line);
		border-radius: 50%;
		font-size: var(--fs-xs);
	}
</style>
