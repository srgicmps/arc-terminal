/// <reference types="node" />
// Ayudantes de las herramientas con navegador (scripts/smoke.ts, tv-shots.ts, compare-views.ts y vitals.ts): arrancar
// `vite preview` con la web ya construida y abrir Chromium.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { chromium, webkit, type Browser } from 'playwright-core';

/** Chromium de la imagen de desarrollo; en el runner de GitHub, el Chrome que trae instalado. */
export function launch(): Promise<Browser> {
	// WebKit (el motor de Safari), el que instala Playwright: para probar lo que solo pasa en el iPhone.
	if (process.env.SMOKE_BROWSER === 'webkit') return webkit.launch();
	const local = '/opt/pw-browsers/chromium';
	if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
	if (existsSync(local)) return chromium.launch({ executablePath: local });
	return chromium.launch({ channel: 'chrome' });
}

/**
 * Arranca `vite preview` en `port` (con la web construida en `cwd`, por defecto la de aquí) y espera a que
 * responda. Devuelve el proceso y la raíz de la web.
 */
export async function preview(port: number, cwd?: string): Promise<{ server: ChildProcess; root: string }> {
	const root = `http://localhost:${port}`;
	// Si ya contesta otro servidor en ese puerto (otra prueba a la vez, uno que se quedó suelto), se probaría su web,
	// quizá de otro build: mejor parar y decirlo.
	if (await fetch(`${root}/`).then(() => true, () => false)) throw new Error(`el puerto ${port} ya está ocupado (¿otro vite preview?)`);
	// vite con node, sin `pnpm exec`: al matar a pnpm, vite seguía vivo y ocupando el puerto.
	const vite = join(dirname(createRequire(resolve(cwd ?? '.', 'package.json')).resolve('vite/package.json')), 'bin/vite.js');
	const server = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort'], {
		stdio: 'ignore',
		cwd
	});
	// Que no quede un servidor suelto si el script acaba antes de tiempo (Ctrl+C, error…).
	process.on('exit', () => server.kill());
	for (let i = 0; i < 50; i++) {
		try {
			if ((await fetch(`${root}/`)).ok) return { server, root };
		} catch {}
		await new Promise((r) => setTimeout(r, 200));
	}
	server.kill();
	throw new Error(`vite preview no responde en el puerto ${port}`);
}

/**
 * Las vistas de la web ya construida, una por cada .html de build/ («index.html» es «/»). Sin 404 ni la
 * ficha de valor (/s), que necesita un ?sym= y cada herramienta añade a su manera. Así no hace falta leer
 * COMMANDS, que usa import.meta.glob (solo existe en Vite) y no se puede importar desde Node.
 */
export function viewPaths(dir = 'build'): string[] {
	return readdirSync(dir)
		.filter((f) => f.endsWith('.html') && f !== '404.html' && f !== 's.html')
		.map((f) => (f === 'index.html' ? '/' : `/${f.slice(0, -'.html'.length)}`))
		.sort();
}
