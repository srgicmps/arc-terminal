<!--
	Barra de tareas provisional de Arc OS: un lanzador sencillo, los escritorios y una tecla por ventana.
	La sustituye la de «OS 2 Escritorio y barra» (menú Inicio, bandeja, notificaciones); usa solo la API de
	src/lib/os/os.svelte.ts.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { APPS, appOf, desk, focus, focusedWin, goDesk, minimize, newDesk, openApp, os } from '#lib/os/os.svelte.ts';

	let pick = $state('');
	const groups = [
		{ label: 'Vistas', kind: 'vista' },
		{ label: 'Experiencias', kind: 'exp' },
		{ label: 'Herramientas', kind: 'herramienta' }
	] as const;

	function launch() {
		if (pick) openApp(pick);
		pick = '';
	}

	const toggle = (uid: string) => (focusedWin()?.uid === uid ? minimize(uid) : focus(uid));
</script>

<nav class="bar" data-ui="os-bar" aria-label="Barra de tareas">
	<label class="launch">
		<span class="sr">Abrir una app</span>
		<select bind:value={pick} onchange={launch}>
			<option value="">＋ Abrir…</option>
			{#each groups as g (g.kind)}
				{@const list = APPS.filter((a) => a.kind === g.kind)}
				{#if list.length}
					<optgroup label={g.label}>
						{#each list as a (a.id)}<option value={a.id}>{a.icon} {a.name}{a.code ? ` · ${a.code}` : ''}</option>{/each}
					</optgroup>
				{/if}
			{/each}
		</select>
	</label>
	<span class="desks" role="group" aria-label="Escritorios">
		{#each os.state.desks as d, i (d.id)}
			<button type="button" aria-pressed={d.id === os.state.active} title="{d.name} · Alt+{i + 1}" onclick={() => goDesk(d.id)}>{i + 1}</button>
		{/each}
		<button type="button" title="Escritorio nuevo" aria-label="Escritorio nuevo" onclick={() => newDesk()}>＋</button>
	</span>
	<span class="wins">
		{#each desk().wins as w (w.uid)}
			{@const app = appOf(w)}
			{#if app}
				<button type="button" class:min={w.min} aria-pressed={focusedWin()?.uid === w.uid} onclick={() => toggle(w.uid)}>
					<span aria-hidden="true">{app.icon}</span>
					{app.name}
				</button>
			{/if}
		{/each}
	</span>
	{#if os.notice}<span class="notice" role="status">{os.notice.text}</span>{/if}
	<a class="classic" href={resolve('/')}>Terminal clásico</a>
</nav>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		height: calc(var(--control-h) + 2 * var(--sp-4));
		padding: 0 var(--pad-x);
		background: var(--panel);
		border-top: var(--border);
		font-size: var(--fs-s);
		overflow-x: auto;
	}

	select,
	button,
	.classic {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		border: var(--border);
		border-radius: var(--radius-s);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		white-space: nowrap;
		cursor: pointer;
	}

	.desks,
	.wins {
		display: flex;
		gap: var(--sp-4);
	}

	.wins {
		flex: 1;
		min-width: 0;
	}

	button[aria-pressed='true'] {
		border-color: var(--amber-dim);
		color: var(--amber);
	}

	button.min {
		color: var(--muted);
	}

	.notice {
		color: var(--amber-dim);
	}

	.classic {
		display: inline-flex;
		align-items: center;
		color: var(--muted);
		text-decoration: none;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
