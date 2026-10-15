<!--
	Panel de control de Arc OS: Apariencia (fondo y barra arriba o abajo; dentro de Arc OS manda el aspecto, no
	la estética de la web), Escritorio (widgets y escritorios virtuales), Avisos, Cuenta y, solo para el admin,
	Administración. Lo de fuera de Arc OS se abre en su ventana (AVISOS, ESTILO, ADMIN).
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount } from 'svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { cloud } from '#lib/cloud.svelte.ts';
	import { accountLine } from '#lib/os/system/account.ts';
	import * as os from './bridge.ts';
	import { setBar, setName, setWidgets, shell } from './shell.svelte.ts';
	import { addWidget, defaultWidgets, removeWidget, WIDGET_KINDS, WIDGET_LABEL, type WidgetKind } from './widgets.ts';

	const desks = $derived(os.desks());
	const deskW = $derived(os.deskW());

	let admin = $state(false);
	onMount(async () => {
		try {
			const r = await fetch(asset('api/admin?yo=1' as Parameters<typeof asset>[0]), { cache: 'no-store', redirect: 'manual' });
			admin = r.ok && ((await r.json()) as { admin?: boolean }).admin === true;
		} catch {}
	});

	let bar = $state(shell.bar);
	$effect(() => setBar(bar));

	const current = $derived(shell.widgets ?? defaultWidgets(deskW, shell.skin));
	const has = (k: WidgetKind) => current.some((w) => w.kind === k);
	function flip(k: WidgetKind) {
		setWidgets(has(k) ? removeWidget(current, k) : addWidget(current, k, deskW));
	}
	function app(id: string) {
		shell.open = null;
		os.open(id);
	}
	function go(href: string) {
		shell.open = null;
		os.navigate(href);
	}
	// Qué pasa con tu cuenta: sincronizada, sin conexión, sesión caducada… (cloud.svelte.ts → account.ts).
	const account = $derived(accountLine(cloud.state, cloud.user, cloud.frozen));
</script>

<div id="os-control" class="control" role="dialog" aria-label="Panel de control">
	<header>
		<h2>Panel de control</h2>
		<button type="button" aria-label="Cerrar el panel de control" onclick={() => (shell.open = null)}>✕</button>
	</header>
	<div class="scroll">
		<section>
			<h3>Apariencia</h3>
			<p class="mut">Arc OS tiene su propio aspecto. La estética, el acento y la densidad solo cambian el contenido de las apps.</p>
			<button type="button" class="link" onclick={() => go('/estilo')}>Estética de las apps…</button>
			<button type="button" class="link" onclick={() => app('wallpaper')}>Cambiar fondo…</button>
			{#if shell.skin === 'windows'}
				<div class="row">
					<Seg label="Barra de tareas" options={[{ value: 'bottom', label: 'Barra abajo' }, { value: 'top', label: 'Barra arriba' }]} bind:value={bar} />
				</div>
			{/if}
		</section>
		<section>
			<h3>Escritorio</h3>
			<p class="mut">Widgets: arrástralos por su título o muévelos con las flechas.</p>
			<div class="chips" role="group" aria-label="Widgets del escritorio">
				{#each WIDGET_KINDS as k (k)}
					<button type="button" aria-pressed={has(k)} onclick={() => flip(k)}>{WIDGET_LABEL[k]}</button>
				{/each}
			</div>
			<p class="mut">Escritorios: {desks.length || 1}.</p>
			<button type="button" class="link" onclick={os.addDesk}>Añadir escritorio</button>
		</section>
		<section>
			<h3>Avisos</h3>
			<p class="mut">Temas, nivel, silencio y «Tu mañana» al móvil.</p>
			<button type="button" class="link" onclick={() => go('/avisos')}>Abrir AVISOS</button>
		</section>
		<section>
			<h3>Cuenta</h3>
			<label class="row">
				<span class="mut">Cómo te llamamos</span>
				<input class="name" type="text" maxlength="40" autocomplete="given-name" value={shell.name} onchange={(e) => setName(e.currentTarget.value)} />
			</label>
			<p class:mut={!account.warn} class:warn={account.warn}>{account.text}</p>
		</section>
		<section>
			<h3>Arc OS</h3>
			<p class="mut">Es opcional: puedes volver a la web de siempre cuando quieras (y entrar otra vez con OS).</p>
			<button type="button" class="link" onclick={os.leave}>Volver a la web clásica</button>
		</section>
		<section>
			<button type="button" class="link" onclick={() => app('ajustes')}>Todos los ajustes…</button>
		</section>
		{#if admin}
			<section>
				<h3>Administración</h3>
				<button type="button" class="link" onclick={() => go('/admin')}>Usuarios, invitaciones y sugerencias</button>
			</section>
		{/if}
	</div>
</div>

<style>
	.warn {
		color: var(--amber-dim);
	}

	/* Botones de la shell sin el borde ni el fondo que algunas estéticas dan a todos los botones. */
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.control {
		position: fixed;
		right: var(--sp-12);
		top: var(--sp-12);
		bottom: calc(var(--os-bar-h) + var(--sp-12));
		z-index: var(--z-modal);
		display: flex;
		flex-direction: column;
		width: min(420px, calc(100vw - 2 * var(--sp-12)));
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--radius);
		box-shadow: var(--shadow-pop);
	}
	/* Con la barra arriba (Windows subida, Mac y Linux), el panel baja; con el dock del Mac, deja su hueco. */
	:global([data-os-bar='top']) .control,
	:global([data-os-skin='mac']) .control,
	:global([data-os-skin='linux']) .control {
		top: calc(var(--os-bar-h) + var(--sp-12));
		bottom: var(--sp-12);
	}
	:global([data-os-skin='mac']) .control {
		bottom: calc(var(--os-dock-h) + var(--sp-12));
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--head-y) var(--pad-x);
		border-bottom: var(--hair) solid var(--line);
	}
	h2 {
		margin: 0;
		font-family: var(--title-font);
		font-size: var(--fs-title);
		font-weight: var(--fw-medium);
	}
	header button {
		padding: var(--sp-4) var(--sp-6);
		color: var(--muted);
	}
	.scroll {
		overflow: auto;
		padding: 0 var(--pad-x) var(--sp-12);
	}
	section {
		padding: var(--sp-12) 0;
		border-bottom: var(--hair) solid var(--line);
	}
	section:last-child {
		border-bottom: 0;
	}
	h3 {
		margin: 0 0 var(--sp-8);
		color: var(--muted);
		font-size: var(--fs-xxs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}
	p {
		margin: var(--sp-6) 0;
		font-size: var(--fs-s);
	}
	.row {
		margin-top: var(--sp-10);
	}
	label.row {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
	}
	.name {
		flex: 1;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-8);
		border: var(--hair) solid var(--line);
		border-radius: var(--radius-s);
		background: var(--bg);
		color: var(--fg);
		font: inherit;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4);
	}
	.chips button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		border: var(--hair) solid var(--line);
		border-radius: var(--radius-s);
		color: var(--muted);
		font-size: var(--fs-s);
	}
	.chips button[aria-pressed='true'] {
		border-color: var(--amber-edge);
		color: var(--fg);
		background: var(--amber-soft);
	}
	.link {
		min-height: var(--control-h);
		color: var(--amber);
		font-size: var(--fs-s);
	}
</style>
