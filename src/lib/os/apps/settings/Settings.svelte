<!--
	Ajustes de Arc OS: todo lo que se puede cambiar, en un sitio, con las secciones a la izquierda (arriba, en
	estrecho). No duplica nada: usa los mismos selectores y funciones que la cabecera de la web (Apariencia, Tu sitio,
	MODO) y que el Panel de control de Arc OS (aspecto, fondo, barra y widgets, de OS 2). Todo se guarda en la cuenta.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import PlacePicker from '../../../components/PlacePicker.svelte';
	import StylePicker from '../../../components/StylePicker.svelte';
	import Seg from '../../../components/ui/Seg.svelte';
	import { cloud } from '../../../cloud.svelte.ts';
	import { takesAccent } from '../../../estilos.ts';
	import { MODOS, modo, setModo } from '../../../modo.svelte.ts';
	import { keyJoin, SHORTCUTS, type Shortcut } from '../../../shortcuts.ts';
	import { ACCENTS, DENSITIES, setAccent, setDensity, taste } from '../../../taste.svelte.ts';
	import { setTheme, theme, type ThemeMode } from '../../../theme.svelte.ts';
	import { setTitleLang, titles, type TitleLang } from '../../../titles.svelte.ts';
	import { leaveOS } from '../../mode.svelte.ts';
	import { APPS, newDesk, openApp, os } from '../../os.svelte.ts';
	import { setBar, setWallpaper, setWidgets, shell, WALLPAPERS, type Wallpaper } from '../../shell/shell.svelte.ts';
	import { addWidget, defaultWidgets, removeWidget, WIDGET_KINDS, WIDGET_LABEL, type WidgetKind } from '../../shell/widgets.ts';
	import type { AppProps } from '../../apps.ts';
	import Tool from '../kit/Tool.svelte';

	let { win }: AppProps = $props();

	const SECTIONS = [
		['apariencia', 'Apariencia', '◐'],
		['escritorio', 'Escritorio', '▦'],
		['avisos', 'Avisos', '◬'],
		['cuenta', 'Cuenta y modo', '◉'],
		['region', 'Idioma y región', '◍'],
		['atajos', 'Atajos de teclado', '⌨'],
		['acerca', 'Acerca de', 'ⓘ']
	] as const;
	type Section = (typeof SECTIONS)[number][0];
	let section = $state<Section>('apariencia');

	const THEMES: { value: ThemeMode; label: string }[] = [
		{ value: 'auto', label: 'Automático' },
		{ value: 'light', label: 'Día' },
		{ value: 'dark', label: 'Noche' }
	];
	const LANGS: { value: TitleLang; label: string }[] = [
		{ value: 'es', label: 'Español (traducidos)' },
		{ value: 'en', label: 'Idioma original' }
	];

	const current = $derived(shell.widgets ?? defaultWidgets(os.area.w, shell.skin));
	const has = (k: WidgetKind) => current.some((w) => w.kind === k);
	const flip = (k: WidgetKind) => setWidgets(has(k) ? removeWidget(current, k) : addWidget(current, k, os.area.w));

	let perm = $state<NotificationPermission | 'none'>('none');
	onMount(() => (perm = 'Notification' in window ? Notification.permission : 'none'));
	const ask = async () => (perm = await Notification.requestPermission());

	const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
	const tools = APPS.filter((a) => a.kind === 'herramienta').length;
</script>

<Tool {win}>
	<div class="wrap">
		<div class="set">
			<nav aria-label="Secciones de los ajustes">
				{#each SECTIONS as [id, label, icon] (id)}
					<button type="button" aria-current={section === id} onclick={() => (section = id)}><span aria-hidden="true">{icon}</span> {label}</button>
				{/each}
			</nav>
			<div class="pane">
				{#if section === 'apariencia'}
					<h2>Apariencia</h2>
					<dl>
						<dt>Tema</dt>
						<dd><Seg label="Tema" options={THEMES} bind:value={() => theme.mode, setTheme} /></dd>
						<dt>Acento</dt>
						<dd>
							{#if takesAccent(taste.style)}<Seg label="Color de acento" options={ACCENTS} bind:value={() => taste.accent, setAccent} />
							{:else}<span class="mut">Esta estética lleva su propio color.</span>{/if}
						</dd>
						<dt>Densidad</dt>
						<dd><Seg label="Densidad" options={DENSITIES} bind:value={() => taste.density, setDensity} /></dd>
					</dl>
					<h3>Estética</h3>
					<p class="mut">Colores y letra del contenido de las apps (el escritorio de Arc OS tiene su propio aspecto).</p>
					<StylePicker />
				{:else if section === 'escritorio'}
					<h2>Escritorio</h2>
					<h3>Fondo</h3>
					<Seg label="Fondo del escritorio" options={WALLPAPERS.map((w) => ({ value: w.id, label: w.label }))} bind:value={() => shell.wallpaper, (v: Wallpaper) => setWallpaper(v)} />
					{#if shell.skin === 'windows'}
						<h3>Barra de tareas</h3>
						<Seg label="Barra de tareas" options={[{ value: 'bottom', label: 'Abajo' }, { value: 'top', label: 'Arriba' }]} bind:value={() => shell.bar, setBar} />
					{/if}
					<h3>Widgets</h3>
					<div class="chips" role="group" aria-label="Widgets del escritorio">
						{#each WIDGET_KINDS as k (k)}<button type="button" aria-pressed={has(k)} onclick={() => flip(k)}>{WIDGET_LABEL[k]}</button>{/each}
					</div>
					<h3>Escritorios virtuales</h3>
					<p>{os.state.desks.length} · <button type="button" class="link" onclick={() => newDesk()}>Añadir escritorio</button></p>
				{:else if section === 'avisos'}
					<h2>Avisos</h2>
					<h3>Al móvil</h3>
					<p class="mut">Temas, nivel, tope diario, tus valores, silencio y «Tu mañana».</p>
					<p><button type="button" onclick={() => openApp('avisos')}>Abrir AVISOS</button></p>
					<h3>En este ordenador</h3>
					<p class="mut">Las alarmas del Reloj y el temporizador avisan también con una notificación del sistema.</p>
					{#if perm === 'granted'}<p>Notificaciones del sistema: permitidas.</p>
					{:else if perm === 'denied'}<p class="mut">Notificaciones del sistema bloqueadas: se cambian en los ajustes del navegador.</p>
					{:else if perm === 'default'}<p><button type="button" onclick={ask}>Permitir notificaciones del sistema</button></p>
					{:else}<p class="mut">Este navegador no tiene notificaciones del sistema.</p>{/if}
				{:else if section === 'cuenta'}
					<h2>Cuenta y modo</h2>
					{#if cloud.user}
						<p>Tu cuenta: <b>{cloud.user}</b>. Tus ajustes, notas, alarmas y escritorios se sincronizan entre tus dispositivos.</p>
					{:else}
						<p class="mut">Sin cuenta: todo se queda en este navegador. En HELP puedes llevarte los ajustes a otro dispositivo con un enlace.</p>
					{/if}
					<h3>Modo</h3>
					<Seg label="Modo" options={MODOS} bind:value={() => modo.value, setModo} />
					<p class="mut">Sencillo: lo esencial, letra mayor y explicaciones. Terminal: todo, denso.</p>
					<h3>Arc OS</h3>
					<p class="mut">Es opcional: puedes volver a la web de siempre cuando quieras.</p>
					<p><button type="button" onclick={leaveOS}>Volver a la web clásica</button></p>
				{:else if section === 'region'}
					<h2>Idioma y región</h2>
					<h3>Tu sitio</h3>
					<p class="mut">Para el tiempo, la hora local y «Tu mañana».</p>
					<PlacePicker />
					<h3>Titulares</h3>
					<Seg label="Idioma de los titulares" options={LANGS} bind:value={() => titles.lang, setTitleLang} />
					<p class="mut">La web está en español; las cifras y fechas, con el formato de España.</p>
				{:else if section === 'atajos'}
					<h2>Atajos de teclado</h2>
					{#each groups as g (g)}
						<h3>{g}</h3>
						<dl class="keys">
							{#each (SHORTCUTS as readonly Shortcut[]).filter((s) => s.group === g) as s (s.id)}
								<dt>{#each s.keys as k, i (i)}{#if i}{keyJoin(s)}{/if}<kbd>{k}</kbd>{/each}{#if s.how} <span class="mut">{s.how}</span>{/if}</dt>
								<dd>{s.action}</dd>
							{/each}
						</dl>
					{/each}
				{:else}
					<h2>Acerca de Arc OS</h2>
					<p>Arc Terminal como un sistema operativo: escritorios, ventanas y {APPS.length} apps ({tools} del sistema).</p>
					<p class="mut">Inspirado en OS.js y en los escritorios de siempre. Todo funciona en el navegador; tus datos van solo a tu cuenta.</p>
					<p><button type="button" onclick={() => openApp('novedades')}>Novedades</button> <button type="button" onclick={() => openApp('help')}>Ayuda</button></p>
				{/if}
			</div>
		</div>
	</div>
</Tool>

<style>
	.wrap {
		container-type: inline-size;
		height: 100%;
	}

	.set {
		display: grid;
		grid-template-columns: 190px 1fr;
		gap: var(--sp-16);
		height: 100%;
	}

	nav {
		display: grid;
		align-content: start;
		gap: var(--sp-2);
		border-right: var(--border);
		padding-right: var(--sp-12);
	}

	nav button {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		text-align: left;
		background: none;
		border: 0;
		border-radius: var(--radius-s);
	}

	nav [aria-current='true'] {
		background: var(--amber-soft);
		color: var(--amber);
	}

	.pane {
		min-width: 0;
	}

	h2 {
		margin: 0 0 var(--sp-12);
		font-family: var(--sans);
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
	}

	h3 {
		margin: var(--sp-16) 0 var(--sp-6);
		font-size: var(--fs-title);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--muted);
	}

	p {
		margin: var(--sp-6) 0;
	}

	.mut {
		color: var(--muted);
		font-family: var(--sans);
	}

	button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		font: inherit;
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	.link {
		height: auto;
		padding: 0;
		border: 0;
		background: none;
		color: var(--amber);
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--sp-8) var(--sp-16);
		align-items: center;
		margin: 0;
	}

	dt {
		color: var(--muted);
	}

	dd {
		margin: 0;
	}

	.keys {
		grid-template-columns: minmax(140px, auto) 1fr;
		align-items: baseline;
	}

	.keys dt {
		color: var(--fg);
	}

	kbd {
		padding: 0 var(--sp-4);
		border: var(--border);
		border-radius: var(--radius-s);
		background: var(--raise);
		font-family: var(--mono);
		font-size: var(--fs-s);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4);
	}

	[aria-pressed='true'] {
		color: var(--amber);
		border-color: var(--amber-dim);
		background: var(--amber-soft);
	}

	@container (max-width: 560px) {
		.set {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
			height: auto;
		}

		nav {
			display: flex;
			overflow-x: auto;
			border-right: 0;
			border-bottom: var(--border);
			padding: 0 0 var(--sp-6);
		}

		nav button {
			flex: none;
			white-space: nowrap;
		}

		.keys {
			grid-template-columns: 1fr;
		}
	}
</style>
