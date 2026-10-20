// «Quitar» en /admin borra TODO lo de esa persona en D1, con el SQL de verdad (D1 de mentira sobre SQLite).
import { beforeEach, describe, expect, it } from 'vitest';
import { parseConfig } from '../src/lib/alertconfig.ts';
import { d1AdminStore, touchSeen } from './admin.ts';
import { d1AlertStore } from './alerts.ts';
import { sqliteD1 } from './d1sqlite.ts';
import { d1FamilyStore } from './family.ts';
import { d1FeedbackStore } from './feedback.ts';
import { d1ForecastStore } from './forecasts.ts';
import { d1Store } from './prefs.ts';
import { d1RssStore } from './rss.ts';
import { resetSchema } from './schema.ts';

// Cada test usa una base nueva: que las tablas se vuelvan a crear en ella.
beforeEach(resetSchema);

describe('d1AdminStore.forget', () => {
	it('borra ajustes, avisos, último acceso, familia, envíos, RSS, predicciones y sugerencias de esa persona, y nada de otra', async () => {
		const db = sqliteD1();
		for (const user of ['ana@x.es', 'bob@x.es']) {
			await d1Store(db).patch(user, { 'arc-mis': '["NVDA"]' }, []);
			await d1AlertStore(db).put(user, { uid: `${user[0]}`.repeat(16), topic: `arc-${user[0]}`, config: parseConfig({ on: true }) });
			await touchSeen(db, user);
			await d1FamilyStore(db).put(user, { id: user[0].repeat(16), name: user, accept: true });
			await d1FamilyStore(db).logSent(user, Date.now());
			await d1RssStore(db).put(user, ['https://example.com/feed.xml']);
			await d1ForecastStore(db).setPlayer(user, { uid: user[0].repeat(16), alias: null });
			await d1ForecastStore(db).setBet(user, { round: 'us10@2026-10-30T08:00Z', value: 4.1 });
			await d1FeedbackStore(db).add({ user, view: '/eco', text: 'Una idea', at: Date.now() });
		}
		await d1AdminStore(db).forget('ana@x.es');
		const left = (table: string, user: string) =>
			(db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user = ?`).get(user) as { n: number }).n;
		// Escrita a mano, aparte de USER_TABLES: si alguien quita una de allí, falla aquí también.
		for (const t of [
			'prefs',
			'alerts',
			'seen',
			'family',
			'family_sent',
			'rss',
			'forecast_bets',
			'forecast_players',
			'feedback'
		]) {
			expect(left(t, 'ana@x.es'), t).toBe(0);
			expect(left(t, 'bob@x.es'), t).toBe(1);
		}
	});

	it('funciona aunque las tablas de familia, RSS o predicciones no existan todavía', async () => {
		const db = sqliteD1();
		await expect(d1AdminStore(db).forget('ana@x.es')).resolves.toBeUndefined();
	});
});
