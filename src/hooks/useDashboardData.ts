import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Veranstalter, Veranstaltungen, Anmeldungen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [veranstalter, setVeranstalter] = useState<Veranstalter[]>([]);
  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltungen[]>([]);
  const [anmeldungen, setAnmeldungen] = useState<Anmeldungen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [veranstalterData, veranstaltungenData, anmeldungenData] = await Promise.all([
        LivingAppsService.getVeranstalter(),
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getAnmeldungen(),
      ]);
      setVeranstalter(veranstalterData);
      setVeranstaltungen(veranstaltungenData);
      setAnmeldungen(anmeldungenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [veranstalterData, veranstaltungenData, anmeldungenData] = await Promise.all([
          LivingAppsService.getVeranstalter(),
          LivingAppsService.getVeranstaltungen(),
          LivingAppsService.getAnmeldungen(),
        ]);
        setVeranstalter(veranstalterData);
        setVeranstaltungen(veranstaltungenData);
        setAnmeldungen(anmeldungenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const veranstalterMap = useMemo(() => {
    const m = new Map<string, Veranstalter>();
    veranstalter.forEach(r => m.set(r.record_id, r));
    return m;
  }, [veranstalter]);

  const veranstaltungenMap = useMemo(() => {
    const m = new Map<string, Veranstaltungen>();
    veranstaltungen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [veranstaltungen]);

  return { veranstalter, setVeranstalter, veranstaltungen, setVeranstaltungen, anmeldungen, setAnmeldungen, loading, error, fetchAll, veranstalterMap, veranstaltungenMap };
}