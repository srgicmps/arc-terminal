import { describe, expect, it } from 'vitest';
import { describeAlert, freshAlerts, lastTime, type LogEntry } from './alerts.ts';

const e = (k: string, t: string, p: LogEntry['p'] = 2, s: LogEntry['s'] = 'sent'): LogEntry => ({ k, t, p, s });

describe('avisos como toasts', () => {
	it('nombra cada aviso por su id', () => {
		expect(describeAlert(e('mkt:S&P 500:2026-10-15', 'x'))?.title).toBe('Mercados · S&P 500');
		expect(describeAlert(e('stock:NVDA:2026-10-15', 'x'))?.href).toBe('/mis');
		expect(describeAlert(e('quake:us123', 'x', 1))?.detail).toBe('Aviso P1 de Arc');
	});

	it('deja fuera lo desconocido, lo no enviado y el diésel', () => {
		expect(describeAlert(e('raro:1', 'x'))).toBeNull();
		expect(describeAlert(e('quake:1', 'x', 1, 'baseline'))).toBeNull();
		expect(describeAlert(e('diesel:day:zona:2026-10-15', 'x'))).toBeNull();
	});

	it('solo lo nuevo y urgente, y nada la primera vez', () => {
		const list = [e('quake:1', '2026-10-15T10:00', 1), e('mkt:Oro:t', '2026-10-15T11:00', 2), e('macro:ipc:t', '2026-10-15T12:00', 3)];
		expect(freshAlerts(list, null)).toEqual([]);
		expect(freshAlerts(list, '2026-10-15T10:30').map((a) => a.id)).toEqual(['alert:mkt:Oro:t']);
		expect(freshAlerts(list, '2026-10-15T09:00', 3)).toHaveLength(3);
		expect(lastTime(list)).toBe('2026-10-15T12:00');
	});
});
