<!--
	«Bienvenido a Arc OS»: el asistente del primer arranque (cuando aún no hay arc-os-skin guardado), en tres
	pasos: fondo, widgets y cómo quieres que te llame. El aspecto es uno solo y no se elige. Todo se puede cambiar luego en el Panel de control (⚙).
	Las elecciones se aplican al momento, así se ve el resultado detrás. «Saltar» deja lo de por defecto.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import * as os from './bridge.ts';
	import { setName, setSkin, setWallpaper, setWidgets, shell, WALLPAPERS } from './shell.svelte.ts';
	import { addWidget, defaultWidgets, removeWidget, WIDGET_KINDS, WIDGET_LABEL, type WidgetKind } from './widgets.ts';

	const STEPS = ['Fondo', 'Widgets', 'Nombre'] as const;
	let name = $state(shell.name);
	let step = $state(0);
	let box = $state<HTMLElement>();

	$effect(() => {
		void step;
		tick().then(() => box?.querySelector<HTMLElement>('[aria-checked="true"], [aria-pressed="true"], button')?.focus());
	});

	const current = $derived(shell.widgets ?? defaultWidgets(os.deskW(), shell.skin));
	const has = (k: WidgetKind) => current.some((w) => w.kind === k);
	const flip = (k: WidgetKind) => setWidgets(has(k) ? removeWidget(current, k) : addWidget(current, k, os.deskW()));

	function finish() {
		setName(name);
		setSkin(shell.skin);
	}
</script>

<div class="first" role="dialog" aria-modal="true" aria-labelledby="os-first-title" bind:this={box}>
	<div class="card">
		<p class="kicker">Bienvenido a Arc OS · paso {step + 1} de {STEPS.length}</p>
		<ol class="dots" aria-hidden="true">
			{#each STEPS as s, i (s)}<li class:on={i <= step}>{s}</li>{/each}
		</ol>

		{#if step === 0}
			<h2 id="os-first-title">Elige un fondo</h2>
			<p class="mut">Se puede cambiar cuando quieras con el clic derecho en el escritorio.</p>
			<div class="walls" role="radiogroup" aria-label="Fondo del escritorio">
				{#each WALLPAPERS as wp (wp.id)}
					<button type="button" role="radio" aria-checked={shell.wallpaper === wp.id} class="wall" onclick={() => setWallpaper(wp.id)}>
						<span class="sw" data-wp={wp.id} aria-hidden="true"></span>
						<span>{wp.label}</span>
					</button>
				{/each}
			</div>
		{:else if step === 1}
			<h2 id="os-first-title">Widgets en el escritorio</h2>
			<p class="mut">Datos de un vistazo. Se mueven arrastrándolos por el título.</p>
			<div class="chips" role="group" aria-label="Widgets">
				{#each WIDGET_KINDS as k (k)}
					<button type="button" aria-pressed={has(k)} onclick={() => flip(k)}>{WIDGET_LABEL[k]}</button>
				{/each}
			</div>
		{:else}
			<h2 id="os-first-title">¿Cómo quieres que te llame?</h2>
			<p class="mut">Para saludarte al entrar. Se puede dejar en blanco.</p>
			<input class="name" type="text" maxlength="40" autocomplete="given-name" aria-label="Tu nombre" placeholder="Tu nombre" bind:value={name} onkeydown={(e) => e.key === 'Enter' && finish()} />
		{/if}

		<div class="actions">
			<button type="button" class="ghost" onclick={finish}>Saltar</button>
			<span class="sp"></span>
			{#if step > 0}<button type="button" class="ghost" onclick={() => step--}>Atrás</button>{/if}
			{#if step < STEPS.length - 1}
				<button type="button" class="main" onclick={() => step++}>Siguiente</button>
			{:else}
				<button type="button" class="main" onclick={finish}>Empezar</button>
			{/if}
		</div>
	</div>
</div>

<style>
	button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
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
		width: min(680px, 100%);
		padding: var(--sp-24);
		background: var(--panel);
		border: var(--hair) solid var(--panel-edge);
		border-radius: var(--os-menu-radius, var(--radius));
		box-shadow: var(--shadow-pop);
	}
	.kicker {
		margin: 0 0 var(--sp-6);
		color: var(--amber);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}
	.dots {
		display: flex;
		gap: var(--sp-4);
		margin: 0 0 var(--sp-16);
		padding: 0;
		list-style: none;
		font-size: var(--fs-xxs);
		color: var(--faint);
	}
	.dots li {
		flex: 1;
		padding-top: var(--sp-4);
		border-top: var(--sp-2) solid var(--line);
	}
	.dots li.on {
		border-top-color: var(--amber);
		color: var(--muted);
	}
	h2 {
		margin: 0 0 var(--sp-6);
		font-family: var(--title-font);
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
	}
	p {
		margin: 0 0 var(--sp-16);
		font-size: var(--fs-s);
		line-height: var(--lh-text);
	}
	.walls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: var(--sp-8);
	}
	.wall {
		display: grid;
		gap: var(--sp-6);
		padding: var(--sp-6);
		border: var(--hair) solid var(--line);
		border-radius: var(--radius);
		font-size: var(--fs-s);
		text-align: left;
	}
	.wall[aria-checked='true'] {
		border-color: var(--amber);
		background: var(--amber-soft);
	}
	.sw {
		display: block;
		aspect-ratio: 16 / 10;
		border-radius: var(--radius-s);
		background: var(--bg);
		border: var(--hair) solid var(--line);
	}
	.sw[data-wp='sistema'] {
		background-image: linear-gradient(180deg, var(--amber-soft), transparent 60%), radial-gradient(ellipse at 30% 100%, var(--raise), transparent 70%);
	}
	.sw[data-wp='rejilla'] {
		background-image:
			linear-gradient(var(--line) var(--hair), transparent var(--hair)),
			linear-gradient(90deg, var(--line) var(--hair), transparent var(--hair));
		background-size: 12px 12px;
	}
	.sw[data-wp='degradado'] {
		background-image: radial-gradient(ellipse at 20% 0%, var(--amber-soft), transparent 60%), linear-gradient(var(--bg), var(--panel));
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
	}
	.chips button {
		height: var(--control-h);
		padding: 0 var(--sp-12);
		border: var(--hair) solid var(--line);
		border-radius: var(--radius-s);
		color: var(--muted);
		font-size: var(--fs-s);
	}
	.chips button[aria-pressed='true'] {
		border-color: var(--amber-edge);
		background: var(--amber-soft);
		color: var(--fg);
	}
	.name {
		width: 100%;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		border: var(--hair) solid var(--line);
		border-radius: var(--radius-s);
		background: var(--bg);
		color: var(--fg);
		font: inherit;
	}
	.name:focus-visible {
		outline: var(--hair) solid var(--amber-edge);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		margin-top: var(--sp-20);
	}
	.sp {
		flex: 1;
	}
	.actions button {
		height: var(--control-h);
		padding: 0 var(--sp-16);
		border-radius: var(--radius-s);
	}
	.ghost {
		color: var(--muted);
	}
	.ghost:hover {
		color: var(--fg);
	}
	.main {
		background: var(--amber);
		color: var(--on-amber);
		font-weight: var(--fw-medium);
	}
</style>
