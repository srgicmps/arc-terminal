<!--
	El contenido de cada sección de Ajustes (las secciones, en sections.ts). No duplica nada: usa los mismos
	selectores y funciones que la cabecera de la web (Apariencia, Tu sitio, MODO), HELP (llevarte los ajustes) y el
	sistema de Arc OS (fondo, barra, widgets, arranque, sonidos). Todo se guarda en la cuenta.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { version } from '$app/env';
	import { resolve } from '$app/paths';
	import PlacePicker from '../../../components/PlacePicker.svelte';
	import StylePicker from '../../../components/StylePicker.svelte';
	import Seg from '../../../components/ui/Seg.svelte';
	import Share from '../../../components/ui/Share.svelte';
	import { cloud } from '../../../cloud.svelte.ts';
	import { takesAccent } from '../../../estilos.ts';
	import { MODOS, modo, setModo } from '../../../modo.svelte.ts';
	import { PREFS } from '../../../prefs.ts';
	import { keyJoin, SHORTCUTS, type Shortcut } from '../../../shortcuts.ts';
	import { ACCENTS, DENSITIES, setAccent, setDensity, taste } from '../../../taste.svelte.ts';
	import { setTheme, theme, type ThemeMode } from '../../../theme.svelte.ts';
	import { setTitleLang, titles, type TitleLang } from '../../../titles.svelte.ts';
	import { collect, encode, HASH } from '../../../transfer.ts';
	import { leaveOS } from '../../mode.svelte.ts';
	import { APPS, newDesk, openApp, os } from '../../os.svelte.ts';
	import { playTone } from '../../system/sounds.ts';
	import { lock, setSettings, sys } from '../../system/system.svelte.ts';
	import { setBar, setWallpaper, setWidgets, shell, WALLPAPERS, type Wallpaper } from '../../shell/shell.svelte.ts';
	import { addWidget, defaultWidgets, removeWidget, WIDGET_KINDS, WIDGET_LABEL, type WidgetKind } from '../../shell/widgets.ts';
	import { findApp } from '../../apps.ts';
	import type { SectionId } from './sections.ts';

	let { section }: { section: SectionId } = $props();

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

	/** Ajustes de sistema de OS 5 (system.svelte.ts): salen los que existan. */
	const sysFlag = (k: string) => k in sys.settings;
	const sysOn = (k: string) => !!(sys.settings as unknown as Record<string, boolean>)[k];
	const sysSet = (k: string, v: boolean) => setSettings({ [k]: v } as Parameters<typeof setSettings>[0]);

	const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
	/** La versión de SvelteKit es la hora de la publicación (en ms) salvo que se configure otra. */
	const built = /^\d{12,}$/.test(version) ? new Date(+version).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : version;
	const tools = APPS.filter((a) => a.kind === 'herramienta').length;

	// Copia de ajustes: el mismo enlace que HELP (lo recibe /help y pregunta antes de copiar nada).
	const transferLink = () => {
		const url = new URL(resolve('/help'), location.origin);
		url.hash = HASH.slice(1) + encode(collect(localStorage));
		return { title: 'Mis ajustes de Arc Terminal', url: url.href };
	};
	function download() {
		const blob = new Blob([JSON.stringify(collect(localStorage), null, 1)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `ajustes-arc-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	// Almacenamiento local: claves y tamaño por tipo (según prefs.ts), leído al abrir la sección.
	type Kind = 'ajuste' | 'dato' | 'caché' | 'otro';
	const KIND_LABEL: Record<Kind, string> = { ajuste: 'Ajustes', dato: 'Datos tuyos', caché: 'Cachés', otro: 'Otras' };
	let usage = $state<{ kind: Kind; keys: number; bytes: number }[]>([]);
	function measure() {
		const acc: Record<Kind, { keys: number; bytes: number }> = { ajuste: { keys: 0, bytes: 0 }, dato: { keys: 0, bytes: 0 }, caché: { keys: 0, bytes: 0 }, otro: { keys: 0, bytes: 0 } };
		try {
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key === null) continue;
				const p = PREFS.find((x) => x.storage === 'local' && (x.key === key || (x.prefix !== undefined && key.startsWith(x.prefix))));
				const k: Kind = p ? p.kind : 'otro';
				acc[k].keys++;
				acc[k].bytes += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
			}
		} catch {}
		usage = (Object.keys(acc) as Kind[]).map((kind) => ({ kind, ...acc[kind] })).filter((u) => u.keys);
	}
	const kb = (b: number) => `${(b / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} KB`;
	$effect(() => {
		if (section === 'almacenamiento') measure();
	});
</script>

<div class="pane">
	{#if section === 'cuenta'}
		<h2 tabindex="-1">Cuenta</h2>
		{#if cloud.user}
			<p>Tu cuenta: <b>{cloud.user}</b>. Tus ajustes, notas, alarmas y escritorios se sincronizan entre tus dispositivos.</p>
		{:else}
			<p class="mut">Sin cuenta: todo se queda en este navegador. En «Copia de ajustes» puedes llevártelos a otro dispositivo con un enlace.</p>
		{/if}
		<h3>Arc OS</h3>
		<p class="mut">Es opcional: puedes volver a la web de siempre cuando quieras.</p>
		<p><button type="button" onclick={leaveOS}>Volver a la web clásica</button></p>
	{:else if section === 'apariencia'}
		<h2 tabindex="-1">Apariencia del contenido</h2>
		<p class="mut">Cómo se ven las vistas dentro de las ventanas. El escritorio de Arc OS tiene su propio estilo.</p>
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
		<p class="mut">Colores y letra de todo Arc.</p>
		<StylePicker />
	{:else if section === 'modo'}
		<h2 tabindex="-1">Modo</h2>
		<Seg label="Modo" options={MODOS} bind:value={() => modo.value, setModo} />
		<p class="mut">Sencillo: lo esencial, letra mayor y explicaciones. Terminal: todo, denso.</p>
	{:else if section === 'region'}
		<h2 tabindex="-1">Idioma y región</h2>
		<h3>Tu sitio</h3>
		<p class="mut">Para el tiempo, la hora local y «Tu mañana».</p>
		<PlacePicker />
		<h3>Titulares</h3>
		<Seg label="Idioma de los titulares" options={LANGS} bind:value={() => titles.lang, setTitleLang} />
		<p class="mut">La web está en español; las cifras y fechas, con el formato de España.</p>
	{:else if section === 'sistema'}
		<h2 tabindex="-1">Arranque y bloqueo</h2>
		{#if sysFlag('boot')}
			<label class="check"><input type="checkbox" checked={sysOn('boot')} onchange={(e) => sysSet('boot', e.currentTarget.checked)} /> Pantalla de inicio la primera vez del día</label>
		{/if}
		<p><button type="button" onclick={lock}>Bloquear la pantalla</button></p>
		<p class="mut">También con Ctrl Alt L. Se entra con un clic o una tecla.</p>
	{:else if section === 'sonidos'}
		<h2 tabindex="-1">Sonidos</h2>
		{#if sysFlag('sounds')}
			<label class="check"><input type="checkbox" checked={sysOn('sounds')} onchange={(e) => sysSet('sounds', e.currentTarget.checked)} /> Sonidos del sistema (muy bajos)</label>
		{/if}
		<p class="mut">Al arrancar, bloquear, entrar y con los avisos.</p>
		<p><button type="button" onclick={() => playTone('notify')}>Probar</button></p>
	{:else if section === 'barra'}
		<h2 tabindex="-1">Barra de tareas</h2>
		{#if shell.skin === 'windows'}
			<Seg label="Barra de tareas" options={[{ value: 'bottom', label: 'Abajo' }, { value: 'top', label: 'Arriba' }]} bind:value={() => shell.bar, setBar} />
		{:else}
			<p class="mut">Con este escritorio, la barra va siempre en su sitio.</p>
		{/if}
	{:else if section === 'escritorio'}
		<h2 tabindex="-1">Escritorio y fondo</h2>
		<h3>Fondo</h3>
		<Seg label="Fondo del escritorio" options={WALLPAPERS.map((w) => ({ value: w.id, label: w.label }))} bind:value={() => shell.wallpaper, (v: Wallpaper) => setWallpaper(v)} />
		{#if findApp('wallpaper')}<p><button type="button" onclick={() => openApp('wallpaper')}>Fondo de pantalla…</button></p>{/if}
		<h3>Escritorios virtuales</h3>
		<p>{os.state.desks.length} · <button type="button" class="link" onclick={() => newDesk()}>Añadir escritorio</button></p>
	{:else if section === 'widgets'}
		<h2 tabindex="-1">Widgets</h2>
		<div class="chips" role="group" aria-label="Widgets del escritorio">
			{#each WIDGET_KINDS as k (k)}<button type="button" aria-pressed={has(k)} onclick={() => flip(k)}>{WIDGET_LABEL[k]}</button>{/each}
		</div>
	{:else if section === 'sync'}
		<h2 tabindex="-1">Sincronización</h2>
		{#if cloud.user}
			<p>Activa con <b>{cloud.user}</b>.</p>
			<p class="mut">Ajustes, MIS, notas, alarmas y escritorios se copian a tu cuenta cada pocos segundos y llegan solos a tus otros dispositivos.</p>
		{:else}
			<p class="mut">Sin cuenta en este navegador: todo se queda aquí. Con cuenta (en arcterminal.dev), se sincroniza solo.</p>
		{/if}
	{:else if section === 'copia'}
		<h2 tabindex="-1">Copia de ajustes</h2>
		<p class="mut">Todo lo tuyo (ajustes, MIS, palabras vigiladas, tu sitio…) en un enlace: ábrelo en el otro navegador y te preguntará antes de copiar nada.</p>
		<p class="row"><Share source={transferLink} /> Enlace</p>
		<p><button type="button" onclick={download}>Descargar copia (.json)</button></p>
	{:else if section === 'almacenamiento'}
		<h2 tabindex="-1">Almacenamiento local</h2>
		<p class="mut">Lo que Arc guarda en este navegador (localStorage).</p>
		{#if usage.length}
			<dl>
				{#each usage as u (u.kind)}<dt>{KIND_LABEL[u.kind]}</dt><dd>{u.keys} · {kb(u.bytes)}</dd>{/each}
				<dt>Total</dt><dd><b>{kb(usage.reduce((n, u) => n + u.bytes, 0))}</b></dd>
			</dl>
		{:else}
			<p class="mut">Nada guardado.</p>
		{/if}
		<p><button type="button" onclick={measure}>Volver a medir</button> {#if findApp('manual')}<button type="button" onclick={() => openApp('manual')}>Qué es cada clave (MANUAL)</button>{/if}</p>
	{:else if section === 'avisos'}
		<h2 tabindex="-1">Avisos</h2>
		<h3>Al móvil</h3>
		<p class="mut">Temas, nivel, tope diario, tus valores, silencio y «Tu mañana».</p>
		<p><button type="button" onclick={() => openApp('avisos')}>Abrir AVISOS</button></p>
		<h3>En este ordenador</h3>
		<p class="mut">Las alarmas del Reloj y el temporizador avisan también con una notificación del sistema.</p>
		{#if perm === 'granted'}<p>Notificaciones del sistema: permitidas.</p>
		{:else if perm === 'denied'}<p class="mut">Notificaciones del sistema bloqueadas: se cambian en los ajustes del navegador.</p>
		{:else if perm === 'default'}<p><button type="button" onclick={ask}>Permitir notificaciones del sistema</button></p>
		{:else}<p class="mut">Este navegador no tiene notificaciones del sistema.</p>{/if}
	{:else if section === 'acerca'}
		<h2 tabindex="-1">Acerca de Arc OS</h2>
		<p>Arc Terminal como un sistema operativo: escritorios, ventanas y {APPS.length} apps ({tools} del sistema).</p>
		<dl><dt>Versión</dt><dd><code>{built}</code></dd></dl>
		<p class="mut">Inspirado en OS.js y en los escritorios de siempre. Todo funciona en el navegador; tus datos van solo a tu cuenta.</p>
		<p><button type="button" onclick={() => openApp('novedades')}>Novedades</button> <button type="button" onclick={() => openApp('help')}>Ayuda</button></p>
	{:else if section === 'fuentes'}
		<h2 tabindex="-1">Fuentes</h2>
		<p class="mut">Los datos salen de fuentes públicas y oficiales; se descargan cada 5–30 minutos.</p>
		<p>
			{#if findApp('status')}<button type="button" onclick={() => openApp('status')}>Estado de las fuentes</button>{/if}
			{#if findApp('manual')}<button type="button" onclick={() => openApp('manual')}>Manual</button>{/if}
		</p>
	{:else if section === 'atajos'}
		<h2 tabindex="-1">Atajos de teclado</h2>
		{#each groups as g (g)}
			<h3>{g}</h3>
			<dl class="keys">
				{#each (SHORTCUTS as readonly Shortcut[]).filter((s) => s.group === g) as s (s.id)}
					<dt>{#each s.keys as k, i (i)}{#if i}{keyJoin(s)}{/if}<kbd>{k}</kbd>{/each}{#if s.how} <span class="mut">{s.how}</span>{/if}</dt>
					<dd>{s.action}</dd>
				{/each}
			</dl>
		{/each}
	{/if}
</div>

<style>
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

	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
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

	.check {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		margin: var(--sp-6) 0;
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
		.keys {
			grid-template-columns: 1fr;
		}
	}
</style>
