<!--
	Barra de tareas de Arc OS: une la shell (src/lib/os/shell/, menú Inicio, bandeja, notificaciones y panel de
	control) con el núcleo (src/lib/os/os.svelte.ts: apps, ventanas y escritorios). Aquí solo se traducen datos y
	acciones de uno a otro, como un componente contenedor de Vue que pasa props y escucha emits.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { APPS, appOf, desk, focus, focusedWin, goDesk, minimize, newDesk, openApp, openPath, os, setShell } from '#lib/os/os.svelte.ts';
	import { opened } from '#lib/os/shell/shell.svelte.ts';
	import type { StartApp } from '#lib/os/shell/start.ts';
	import ShellBar from '#lib/os/shell/Taskbar.svelte';
	import type { DeskInfo, TaskWin } from '#lib/os/shell/types.ts';

	const apps: StartApp[] = APPS.map((a) => ({ id: a.id, title: a.name, code: a.code, icon: a.icon, desc: a.desc }));

	const windows = $derived<TaskWin[]>(
		desk()
			.wins.map((w) => ({ w, app: appOf(w) }))
			.filter((x) => !!x.app)
			.map(({ w, app }) => ({ id: w.uid, appId: w.app, title: app!.name, icon: app!.icon, minimized: !!w.min, focused: focusedWin()?.uid === w.uid && !w.min }))
	);
	const desks = $derived<DeskInfo[]>(os.state.desks.map((d) => ({ id: d.id, name: d.name, active: d.id === os.state.active })));
	const status = $derived(os.notice && Date.now() - os.notice.at < 8000 ? os.notice.text : null);

	function onopen(id: string) {
		openApp(id);
	}
	// Tocar la ventana que está delante la minimiza; cualquier otra, la trae al frente (y la restaura).
	function onactivate(uid: string) {
		const f = focusedWin();
		if (f?.uid === uid && !f.min) minimize(uid);
		else focus(uid);
	}
	function onnavigate(href: string) {
		const win = openPath(href);
		if (win) opened(win.app);
		else if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
	}
	function onleave() {
		setShell('clasico');
		goto(resolve('/'));
	}
</script>

<ShellBar
	{apps}
	{windows}
	{desks}
	{onopen}
	{onactivate}
	ondesk={goDesk}
	{onnavigate}
	onadddesk={() => newDesk()}
	{onleave}
	deskW={os.area.w}
	{status}
/>
