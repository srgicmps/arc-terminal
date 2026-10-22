// Los workflows de .github/workflows, leídos como texto: reglas que el CI solo descubre al ejecutarlos.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIR = '.github/workflows';

/** Los `uses:` de cada job, en orden: { 'deploy.yml › despertador': ['actions/checkout@…', …] }. */
function usesByJob(): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const file of readdirSync(DIR).filter((f) => f.endsWith('.yml'))) {
		let inJobs = false;
		let job = '';
		for (const line of readFileSync(`${DIR}/${file}`, 'utf8').split('\n')) {
			if (/^jobs:\s*$/.test(line)) inJobs = true;
			else if (/^\S/.test(line)) inJobs = false;
			const name = inJobs && /^ {2}([\w-]+):\s*$/.exec(line);
			if (name) job = `${file} › ${name[1]}`;
			const uses = job && /^\s+(?:- )?uses:\s*(\S+)/.exec(line);
			if (uses) (out[job] ??= []).push(uses[1]);
		}
	}
	return out;
}

describe('workflows', () => {
	it('lee los jobs de cada workflow', () => {
		const jobs = usesByJob();
		expect(Object.keys(jobs)).toContain('deploy.yml › despertador');
		expect(Object.keys(jobs)).toContain('fast.yml › build');
	});

	// setup-node v5 ve «packageManager: pnpm» en package.json y prepara su caché él solo: si pnpm no está ya
	// instalado, el job se para con «Unable to locate executable file: pnpm» (le pasó al despertador).
	it('todo job con setup-node instala pnpm antes', () => {
		for (const [job, uses] of Object.entries(usesByJob())) {
			const node = uses.findIndex((u) => u.startsWith('actions/setup-node@'));
			if (node < 0) continue;
			const pnpm = uses.findIndex((u) => u.startsWith('pnpm/action-setup@'));
			expect(pnpm, `${job}: pnpm/action-setup antes de actions/setup-node`).toBeGreaterThanOrEqual(0);
			expect(pnpm, `${job}: pnpm/action-setup antes de actions/setup-node`).toBeLessThan(node);
		}
	});

	// Cada «herramienta» que se puede elegir en Run workflow tiene un job que la atiende (si no, la Action sale en
	// verde sin hacer nada), y al revés.
	it('cada herramienta de deploy.yml tiene su job', () => {
		const text = readFileSync(`${DIR}/deploy.yml`, 'utf8');
		const options = /herramienta:[\s\S]*?options:\s*\[([^\]]*)\]/.exec(text)?.[1].split(',').map((o) => o.trim());
		expect(options).toContain('clave-push');
		const handled = new Set([...text.matchAll(/inputs\.herramienta == '([\w-]+)'/g)].map((m) => m[1]));
		for (const option of options!.filter((o) => o !== 'ninguna')) expect(handled, option).toContain(option);
		for (const used of handled) expect(options, used).toContain(used);
	});
});
