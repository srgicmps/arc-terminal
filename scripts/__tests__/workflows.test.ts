// Los workflows de .github/workflows, leídos como texto: reglas que el CI solo descubre al ejecutarlos.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = '.github/workflows';

/** Las líneas de un workflow sin los comentarios (un job comentado o una nota no cuentan). */
const code = (file: string) =>
	readFileSync(`${DIR}/${file}`, 'utf8')
		.split('\n')
		.filter((line) => !/^\s*#/.test(line));

/**
 * Los pasos de cada job, en orden y como texto: { 'deploy.yml › despertador': ['- uses: actions/checkout@…', …] }.
 * Un paso empieza en «- » con la sangría de los pasos (6 espacios) y sigue mientras las líneas vayan más adentro.
 */
function stepsByJob(): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const file of readdirSync(DIR).filter((f) => f.endsWith('.yml'))) {
		let inJobs = false;
		let job = '';
		for (const line of code(file)) {
			if (/^jobs:\s*$/.test(line)) inJobs = true;
			else if (/^\S/.test(line)) inJobs = false;
			const name = inJobs && /^ {2}([\w-]+):\s*$/.exec(line);
			if (name) job = `${file} › ${name[1]}`;
			if (!job) continue;
			const steps = (out[job] ??= []);
			if (/^ {6}- /.test(line)) steps.push(line.trim());
			else if (steps.length && /^ {7,}\S/.test(line)) steps[steps.length - 1] += `\n${line.trim()}`;
		}
	}
	return out;
}

const uses = (step: string, action: string) => new RegExp(`^- uses: ${action}@`).test(step);

describe('workflows', () => {
	it('lee los jobs de cada workflow y sus pasos', () => {
		const jobs = stepsByJob();
		expect(Object.keys(jobs)).toContain('deploy.yml › despertador');
		expect(Object.keys(jobs)).toContain('fast.yml › build');
		const node = jobs['deploy.yml › clave-push'].find((s) => uses(s, 'actions/setup-node'));
		expect(node).toContain('node-version-file: .nvmrc');
	});

	// setup-node v5 ve «packageManager: pnpm» en package.json y prepara su caché él solo:
	// - si pnpm no está ya instalado, el job se para con «Unable to locate executable file: pnpm» (le pasó al
	//   despertador). Salvo que se apague esa caché con `package-manager-cache: false`.
	// - si el job no ejecuta `pnpm install`, no hay store que guardar y su paso «Post» puede ponerlo en rojo cuando la
	//   caché de ese lockfile aún no existe: entonces tiene que ir apagada.
	it('todo job con setup-node instala pnpm antes o apaga su caché, y sin pnpm install la apaga', () => {
		for (const [job, steps] of Object.entries(stepsByJob())) {
			const node = steps.findIndex((s) => uses(s, 'actions/setup-node'));
			if (node < 0) continue;
			const noCache = /package-manager-cache:\s*false/.test(steps[node]);
			const installs = steps.some((s) => /pnpm install/.test(s));
			if (!installs) expect(noCache, `${job}: sin pnpm install, package-manager-cache: false`).toBe(true);
			if (noCache) continue;
			const pnpm = steps.findIndex((s) => uses(s, 'pnpm/action-setup'));
			expect(pnpm, `${job}: pnpm/action-setup antes de actions/setup-node`).toBeGreaterThanOrEqual(0);
			expect(pnpm, `${job}: pnpm/action-setup antes de actions/setup-node`).toBeLessThan(node);
		}
	});

	// Cada «herramienta» que se puede elegir en Run workflow tiene un job que la atiende (si no, la Action sale en
	// verde sin hacer nada), y al revés. Los comentarios no cuentan.
	it('cada herramienta de deploy.yml tiene su job', () => {
		const text = code('deploy.yml').join('\n');
		const options = /herramienta:[\s\S]*?options:\s*\[([^\]]*)\]/.exec(text)?.[1].split(',').map((o) => o.trim());
		expect(options, 'options: [...] de «herramienta»').toBeDefined();
		expect(options).toContain('clave-push');
		const handled = new Set([...text.matchAll(/inputs\.herramienta == '([\w-]+)'/g)].map((m) => m[1]));
		for (const option of options!.filter((o) => o !== 'ninguna')) expect(handled, option).toContain(option);
		for (const used of handled) expect(options, used).toContain(used);
	});
});
