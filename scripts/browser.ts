/// <reference types="node" />
// Ayudantes de las herramientas con navegador (scripts/smoke.ts, tv-shots.ts y compare-views.ts): arrancar
// `vite preview` con la web ya construida y abrir Chromium.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium, type Browser } from 'playwright-core';

/** Chromium de la imagen de desarrollo; en el runner de GitHub, el Chrome que trae instalado. */
export function launch(): Promise<Browser> {
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
	const root = `http://localhost:${port}/arc-terminal`;
	const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(port), '--strictPort'], {
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
