<!--
	Fondo de pantalla de Arc OS: pinta el que toca (el del escritorio que se ve, el general o el de la
	presentación) a pantalla completa, detrás de iconos, widgets y ventanas. Lo usan el escritorio de la shell, la
	pantalla de bloqueo y, si quiere, el móvil. Los fondos incluidos salen de los tokens (día y noche solos); los
	vivos se mueven con datos; las imágenes propias vienen de IndexedDB. Al cambiar, funde (salvo reduced-motion).
-->
<script lang="ts">
	import { subsolar } from '#lib/geo/globe.ts';
	import { place } from '#lib/place.svelte.ts';
	import { imageUrl } from './images.ts';
	import LiveWall from './LiveWall.svelte';
	import { activeSource, followShell, loadWall, shellWallpaper, wall } from './wall.svelte.ts';
	import { imageCss, skyPhase, sunElevation, type WallSource } from './wall.ts';

	/** Un fondo concreto (vista previa de la galería); sin él, el que toca ahora. */
	let { source = null, preview = false }: { source?: WallSource | null; preview?: boolean } = $props();

	$effect(() => loadWall());
	// El Panel de control y Ajustes eligen con setWallpaper de la shell: se sigue aquí.
	$effect(() => {
		if (!preview && !source) followShell(shellWallpaper());
	});

	const src = $derived(source ?? activeSource());
	const key = $derived(JSON.stringify(src));

	let url = $state<string | null>(null);
	$effect(() => {
		const s = src;
		url = null;
		if (s.kind !== 'image') return;
		let gone = false;
		imageUrl(s.img, preview).then((u) => !gone && (url = u));
		return () => (gone = true);
	});

	const sky = $derived.by(() => {
		if (src.kind !== 'preset' || src.id !== 'cielo') return null;
		const p = place.current;
		return skyPhase(sunElevation(p.lat, p.lon, subsolar(new Date(wall.now))));
	});

	const style = $derived.by(() => {
		if (src.kind === 'color') return `background:${src.color}`;
		if (src.kind === 'gradient') return `background:linear-gradient(${src.angle}deg, ${src.from}, ${src.to})`;
		if (src.kind === 'image' && url) {
			const c = imageCss(src.fit, src.x, src.y);
			return `background-image:url("${url}");background-size:${c.size};background-repeat:${c.repeat};background-position:${c.position}`;
		}
		return '';
	});
</script>

{#key key}
	<div class="wall" class:preview data-wall={src.kind === 'preset' ? src.id : src.kind} data-sky={sky} {style} aria-hidden="true">
		{#if src.kind === 'preset' && src.id === 'globo' && !preview}<LiveWall />{/if}
	</div>
{/key}

<style>
	.wall {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: var(--os-desk);
		animation: in 600ms ease-out;
	}

	.preview {
		animation: none;
	}

	@keyframes in {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.wall {
			animation: none;
		}
	}

	/* Los incluidos, todos con tokens. «sistema» cambia con el aspecto (data-os-skin). */
	[data-wall='sistema'],
	[data-wall='degradado'] {
		background-image: radial-gradient(ellipse at 20% 0%, var(--amber-soft), transparent 60%), linear-gradient(var(--bg), var(--panel));
	}
	:global([data-os-skin='windows']) [data-wall='sistema'] {
		background-image: radial-gradient(ellipse 80% 60% at 50% 110%, var(--amber-soft), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 0%, var(--raise), transparent 70%);
	}
	:global([data-os-skin='mac']) [data-wall='sistema'] {
		background-image: linear-gradient(160deg, var(--raise) 0%, var(--amber-soft) 55%, var(--panel) 100%);
	}
	:global([data-os-skin='linux']) [data-wall='sistema'] {
		background-image: radial-gradient(circle at 70% 30%, var(--amber-soft), transparent 45%), linear-gradient(var(--panel), var(--bg));
	}
	:global([data-os-skin='dsm']) [data-wall='sistema'] {
		background-image: linear-gradient(180deg, var(--amber-soft) 0%, transparent 40%), radial-gradient(ellipse 70% 50% at 30% 100%, var(--raise), transparent 70%);
	}
	/* Estilo único de Arc OS («Mando», OS 6): su rejilla técnica tenue. */
	:global([data-os-skin='mando']) [data-wall='sistema'] {
		background-image: var(--bg-image, none);
	}
	[data-wall='estilo'] {
		background-image: var(--bg-image, none);
	}
	[data-wall='aurora'] {
		background-image:
			radial-gradient(60% 40% at 15% 10%, var(--amber-soft), transparent 70%),
			radial-gradient(50% 45% at 85% 25%, var(--os-wall-cool), transparent 70%),
			radial-gradient(70% 50% at 50% 110%, var(--amber-soft), transparent 70%);
	}
	[data-wall='horizonte'] {
		background-image: linear-gradient(to top, var(--amber-soft), transparent 45%), linear-gradient(var(--bg), var(--panel));
	}
	[data-wall='duna'] {
		background-image:
			radial-gradient(120% 60% at 30% 100%, var(--amber-soft), transparent 60%),
			radial-gradient(90% 50% at 90% 95%, var(--os-wall-cool), transparent 60%),
			linear-gradient(var(--panel), var(--bg));
	}
	[data-wall='rejilla'] {
		background-image:
			linear-gradient(var(--line) var(--hair), transparent var(--hair)),
			linear-gradient(90deg, var(--line) var(--hair), transparent var(--hair));
		background-size: var(--os-wall-grid) var(--os-wall-grid);
	}
	[data-wall='puntos'] {
		background-image: radial-gradient(var(--line) var(--sp-1), transparent calc(var(--sp-1) + var(--hair)));
		background-size: var(--sp-24) var(--sp-24);
	}
	[data-wall='globo'] {
		background-image: radial-gradient(circle at 50% 50%, var(--amber-soft), transparent 70%);
	}
	/* «Tu cielo»: noche, alba o atardecer y día, con los colores de la estética. */
	[data-sky='noche'] {
		background-image: radial-gradient(80% 50% at 70% 0%, var(--os-wall-cool), transparent 70%), linear-gradient(var(--bg), var(--bg));
	}
	[data-sky='crepusculo'] {
		background-image: linear-gradient(to top, var(--amber-soft) 0%, var(--os-wall-cool) 45%, var(--bg) 100%);
	}
	[data-sky='dia'] {
		background-image: radial-gradient(60% 50% at 75% 10%, var(--amber-soft), transparent 70%), linear-gradient(var(--raise), var(--panel));
	}
</style>
