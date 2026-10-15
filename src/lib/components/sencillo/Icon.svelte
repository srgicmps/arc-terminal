<!-- Iconos de línea de la app Sencilla (24×24, trazo del color del texto). -->
<script lang="ts" module>
	export type IconName =
		| 'home'
		| 'euro'
		| 'house'
		| 'globe'
		| 'bell'
		| 'search'
		| 'bolt'
		| 'fuel'
		| 'sun'
		| 'leaf'
		| 'chart'
		| 'news'
		| 'close'
		| 'chevron'
		| 'back'
		| 'clock'
		| 'flag'
		| 'cpu'
		| 'spark';
</script>

<script lang="ts">
	let { name, size }: { name: IconName; size?: string } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" style:width={size} style:height={size} aria-hidden="true">
	{#if name === 'home'}
		<path d="M3 11 12 4l9 7" /><path d="M5 10v10h5v-6h4v6h5V10" />
	{:else if name === 'euro'}
		<path d="M17 6.5A7 7 0 1 0 17 17.5" /><path d="M4 10h9M4 14h9" />
	{:else if name === 'house'}
		<path d="M4 20V10l8-6 8 6v10z" /><path d="M10 20v-5h4v5" />
	{:else if name === 'globe'}
		<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
	{:else if name === 'bell'}
		<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" />
	{:else if name === 'search'}
		<circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
	{:else if name === 'bolt'}
		<path d="M13 3 5 14h6l-1 7 8-11h-6z" />
	{:else if name === 'fuel'}
		<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M5 10h9" /><path d="M14 8h2l2 2v7a1.5 1.5 0 0 0 3 0V9l-3-3" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
	{:else if name === 'leaf'}
		<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19 13 11" />
	{:else if name === 'chart'}
		<path d="M4 19h16" /><path d="m5 15 4-4 3 3 6-7" />
	{:else if name === 'news'}
		<rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 12h8M8 15h5" />
	{:else if name === 'close'}
		<path d="m6 6 12 12M18 6 6 18" />
	{:else if name === 'chevron'}
		<path d="m9 5 7 7-7 7" />
	{:else if name === 'back'}
		<path d="m15 5-7 7 7 7" />
	{:else if name === 'clock'}
		<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
	{:else if name === 'flag'}
		<path d="M5 21V4M5 4h11l-2 4 2 4H5" />
	{:else if name === 'cpu'}
		<rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
	{:else if name === 'spark'}
		<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
	{/if}
</svg>

<style>
	.icon {
		width: var(--app-icon);
		height: var(--app-icon);
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
