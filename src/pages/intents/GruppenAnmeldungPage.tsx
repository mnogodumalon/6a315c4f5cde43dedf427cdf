import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Veranstaltungen } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  IconCalendarEvent,
  IconMapPin,
  IconUsers,
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconCircleCheck,
} from '@tabler/icons-react';

// --- Types ---

interface TeilnehmerEntry {
  id: string;
  vorname: string;
  nachname: string;
  email_anmeldung: string;
  telefon_anmeldung: string;
  anzahl_personen: number;
  anmerkungen: string;
  email_benachrichtigung: boolean;
}

interface RegistriertesPerson {
  vorname: string;
  nachname: string;
  anzahl_personen: number;
}

function createEmptyTeilnehmer(): TeilnehmerEntry {
  return {
    id: crypto.randomUUID(),
    vorname: '',
    nachname: '',
    email_anmeldung: '',
    telefon_anmeldung: '',
    anzahl_personen: 1,
    anmerkungen: '',
    email_benachrichtigung: true,
  };
}

function formatVeranstaltungDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const parsed = parseISO(dateStr);
    return format(parsed, 'dd. MMMM yyyy, HH:mm', { locale: de }) + ' Uhr';
  } catch {
    return dateStr;
  }
}

// --- Main Component ---

const WIZARD_STEPS = [
  { label: 'Veranstaltung' },
  { label: 'Teilnehmer' },
  { label: 'Bestätigung' },
];

export default function GruppenAnmeldungPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { veranstaltungen, anmeldungen, loading, error, fetchAll } = useDashboardData();

  // Step state — read initial step from URL
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 3 ? s : 1;
  })();
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Selection state
  const initialEventId = searchParams.get('veranstaltungId') ?? null;
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);

  // Teilnehmer form state
  const [teilnehmerList, setTeilnehmerList] = useState<TeilnehmerEntry[]>([createEmptyTeilnehmer()]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registriertPersonen, setRegistriertPersonen] = useState<RegistriertesPerson[]>([]);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedEventId) {
      params.set('veranstaltungId', selectedEventId);
    } else {
      params.delete('veranstaltungId');
    }
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedEventId, searchParams, setSearchParams]);

  // If veranstaltungId is in URL and step > 1, auto-skip to step 2
  useEffect(() => {
    if (initialEventId && initialStep === 1) {
      setCurrentStep(2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute current registrations per Veranstaltung
  const registrierungenMap = useMemo(() => {
    const map = new Map<string, number>();
    anmeldungen.forEach(a => {
      const url = a.fields.veranstaltung;
      if (!url) return;
      const match = url.match(/([a-f0-9]{24})$/i);
      if (!match) return;
      const id = match[1];
      const existing = map.get(id) ?? 0;
      map.set(id, existing + (a.fields.anzahl_personen ?? 1));
    });
    return map;
  }, [anmeldungen]);

  // Find selected event
  const selectedEvent = useMemo(
    () => veranstaltungen.find(v => v.record_id === selectedEventId) ?? null,
    [veranstaltungen, selectedEventId]
  );

  // Compute live totals for step 2
  const totalNewPersonen = useMemo(
    () => teilnehmerList.reduce((sum, t) => sum + (t.anzahl_personen || 0), 0),
    [teilnehmerList]
  );

  const existingBelegung = selectedEventId ? (registrierungenMap.get(selectedEventId) ?? 0) : 0;
  const maxTeilnehmer = selectedEvent?.fields.max_teilnehmer ?? 0;
  const gesamtNachAnmeldung = existingBelegung + totalNewPersonen;
  const freiePlaetze = Math.max(0, maxTeilnehmer - existingBelegung);
  const istUeberbucht = maxTeilnehmer > 0 && gesamtNachAnmeldung > maxTeilnehmer;
  const istAmLimit = maxTeilnehmer > 0 && gesamtNachAnmeldung === maxTeilnehmer;

  // Handlers

  const handleEventSelect = useCallback((id: string) => {
    setSelectedEventId(id);
    setTeilnehmerList([createEmptyTeilnehmer()]);
    setCurrentStep(2);
  }, []);

  const handleTeilnehmerChange = useCallback(
    (index: number, field: keyof TeilnehmerEntry, value: string | number | boolean) => {
      setTeilnehmerList(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const handleAddTeilnehmer = useCallback(() => {
    setTeilnehmerList(prev => [...prev, createEmptyTeilnehmer()]);
  }, []);

  const handleRemoveTeilnehmer = useCallback((index: number) => {
    setTeilnehmerList(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedEventId) return;
    const veranstaltungUrl = createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEventId);

    setSubmitting(true);
    setSubmitError(null);

    try {
      const results: RegistriertesPerson[] = [];
      for (const t of teilnehmerList) {
        await LivingAppsService.createAnmeldungenEntry({
          veranstaltung: veranstaltungUrl,
          vorname: t.vorname,
          nachname: t.nachname,
          email_anmeldung: t.email_anmeldung || undefined,
          telefon_anmeldung: t.telefon_anmeldung || undefined,
          anzahl_personen: t.anzahl_personen,
          anmerkungen: t.anmerkungen || undefined,
          email_benachrichtigung: t.email_benachrichtigung,
        });
        results.push({
          vorname: t.vorname,
          nachname: t.nachname,
          anzahl_personen: t.anzahl_personen,
        });
      }
      setRegistriertPersonen(results);
      await fetchAll();
      setCurrentStep(3);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedEventId, teilnehmerList, fetchAll]);

  const handleReset = useCallback(() => {
    setSelectedEventId(null);
    setTeilnehmerList([createEmptyTeilnehmer()]);
    setRegistriertPersonen([]);
    setSubmitError(null);
    setCurrentStep(1);
  }, []);

  // Validation
  const formValid = useMemo(() => {
    if (teilnehmerList.length === 0) return false;
    return teilnehmerList.every(t => t.vorname.trim() !== '' && t.nachname.trim() !== '');
  }, [teilnehmerList]);

  // Build items for EntitySelectStep
  const eventItems = useMemo(() => {
    return (veranstaltungen as Veranstaltungen[]).map(v => {
      const belegung = registrierungenMap.get(v.record_id) ?? 0;
      const max = v.fields.max_teilnehmer ?? 0;
      const datumStr = v.fields.beginn ? formatVeranstaltungDate(v.fields.beginn) : 'Kein Datum';
      const ortStr = v.fields.veranstaltungsort_name ?? 'Kein Veranstaltungsort';
      const platzInfo = max > 0 ? `${belegung} / ${max} Plätze belegt` : 'Unbegrenzte Plätze';
      return {
        id: v.record_id,
        title: v.fields.titel ?? 'Unbekannte Veranstaltung',
        subtitle: `${datumStr} · ${ortStr}`,
        stats: [
          { label: 'Plätze', value: platzInfo },
          ...(v.fields.kosten ? [{ label: 'Kosten', value: v.fields.kosten }] : []),
        ],
        icon: <IconCalendarEvent size={20} className="text-primary" />,
      };
    });
  }, [veranstaltungen, registrierungenMap]);

  return (
    <IntentWizardShell
      title="Gruppen-Anmeldung"
      subtitle="Melde mehrere Personen auf einmal für eine Veranstaltung an."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Veranstaltung auswählen ── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Veranstaltung auswählen</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Wähle die Veranstaltung aus, für die du Personen anmelden möchtest.
            </p>
          </div>

          <EntitySelectStep
            items={eventItems}
            onSelect={handleEventSelect}
            searchPlaceholder="Veranstaltung suchen..."
            emptyIcon={<IconCalendarEvent size={40} />}
            emptyText="Keine Veranstaltungen gefunden."
          />
        </div>
      )}

      {/* ── Step 2: Teilnehmer erfassen ── */}
      {currentStep === 2 && selectedEvent && (
        <div className="space-y-5">
          {/* Event-Kontext oben */}
          <div className="rounded-2xl border bg-card p-4 overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconCalendarEvent size={20} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {selectedEvent.fields.titel ?? 'Veranstaltung'}
                </p>
                {selectedEvent.fields.beginn && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <IconCalendarEvent size={13} className="shrink-0" />
                    {formatVeranstaltungDate(selectedEvent.fields.beginn)}
                  </p>
                )}
                {selectedEvent.fields.veranstaltungsort_name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <IconMapPin size={13} className="shrink-0" />
                    {selectedEvent.fields.veranstaltungsort_name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Kapazitäts-Anzeige */}
          {maxTeilnehmer > 0 && (
            <div className="space-y-2">
              <BudgetTracker
                budget={maxTeilnehmer}
                booked={existingBelegung}
                label="Platzbelegung"
                showRemaining={false}
              />
              <div className="flex items-center justify-between text-sm px-1">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{existingBelegung}</span> von{' '}
                  <span className="font-semibold text-foreground">{maxTeilnehmer}</span> Plätzen belegt
                  {' '}—{' '}
                  <span className={`font-semibold ${freiePlaetze === 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {freiePlaetze} noch frei
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className={
                    istUeberbucht
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : istAmLimit
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-green-300 bg-green-50 text-green-700'
                  }
                >
                  <IconUsers size={12} className="mr-1" />
                  Gesamt: {totalNewPersonen} {totalNewPersonen === 1 ? 'Person' : 'Personen'}
                </Badge>
              </div>
            </div>
          )}

          {/* Kapazitäts-Warnungen */}
          {istUeberbucht && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <IconAlertTriangle size={16} className="shrink-0 mt-0.5" stroke={2} />
              <span>
                Die Gesamtanzahl ({gesamtNachAnmeldung}) übersteigt die maximale Teilnehmerzahl ({maxTeilnehmer}).
                Bitte reduziere die Anzahl der Personen.
              </span>
            </div>
          )}
          {!istUeberbucht && istAmLimit && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <IconAlertTriangle size={16} className="shrink-0 mt-0.5" stroke={2} />
              <span>
                Mit dieser Anmeldung werden alle verfügbaren Plätze belegt.
              </span>
            </div>
          )}

          {/* Teilnehmer-Einträge */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Teilnehmer ({teilnehmerList.length})
            </h3>

            {teilnehmerList.map((t, idx) => (
              <div
                key={t.id}
                className="rounded-2xl border bg-card p-4 space-y-3 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Person {idx + 1}
                  </span>
                  {teilnehmerList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTeilnehmer(idx)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Person entfernen"
                    >
                      <IconTrash size={16} stroke={2} />
                    </button>
                  )}
                </div>

                {/* Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Vorname <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={t.vorname}
                      onChange={e => handleTeilnehmerChange(idx, 'vorname', e.target.value)}
                      placeholder="Max"
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Nachname <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={t.nachname}
                      onChange={e => handleTeilnehmerChange(idx, 'nachname', e.target.value)}
                      placeholder="Mustermann"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Kontakt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">E-Mail</label>
                    <Input
                      type="email"
                      value={t.email_anmeldung}
                      onChange={e => handleTeilnehmerChange(idx, 'email_anmeldung', e.target.value)}
                      placeholder="max@beispiel.de"
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Telefon</label>
                    <Input
                      type="tel"
                      value={t.telefon_anmeldung}
                      onChange={e => handleTeilnehmerChange(idx, 'telefon_anmeldung', e.target.value)}
                      placeholder="+49 123 456789"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Anzahl + Anmerkungen */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Anzahl Personen
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={maxTeilnehmer > 0 ? maxTeilnehmer : undefined}
                      value={t.anzahl_personen}
                      onChange={e =>
                        handleTeilnehmerChange(
                          idx,
                          'anzahl_personen',
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Anmerkungen</label>
                    <textarea
                      value={t.anmerkungen}
                      onChange={e => handleTeilnehmerChange(idx, 'anmerkungen', e.target.value)}
                      placeholder="Besondere Hinweise..."
                      rows={2}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    />
                  </div>
                </div>

                {/* E-Mail-Benachrichtigung */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    role="checkbox"
                    aria-checked={t.email_benachrichtigung}
                    tabIndex={0}
                    onClick={() =>
                      handleTeilnehmerChange(
                        idx,
                        'email_benachrichtigung',
                        !t.email_benachrichtigung
                      )
                    }
                    onKeyDown={e => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleTeilnehmerChange(
                          idx,
                          'email_benachrichtigung',
                          !t.email_benachrichtigung
                        );
                      }
                    }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                      t.email_benachrichtigung
                        ? 'bg-primary border-primary'
                        : 'border-input bg-background'
                    }`}
                  >
                    {t.email_benachrichtigung && (
                      <IconCheck size={12} stroke={3} className="text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    E-Mail-Bestätigung erhalten
                  </span>
                </label>
              </div>
            ))}

            {/* Weitere Person hinzufügen */}
            <Button
              type="button"
              variant="outline"
              onClick={handleAddTeilnehmer}
              className="w-full gap-2"
            >
              <IconPlus size={16} stroke={2} />
              Weitere Person hinzufügen
            </Button>
          </div>

          {/* Fehler-Anzeige */}
          {submitError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <IconAlertTriangle size={16} className="shrink-0 mt-0.5" stroke={2} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="sm:w-auto w-full"
            >
              Zurück
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formValid || istUeberbucht}
              className="flex-1 gap-2"
            >
              {submitting ? (
                <>Wird angemeldet...</>
              ) : (
                <>
                  <IconCheck size={16} stroke={2} />
                  {totalNewPersonen === 1 ? '1 Person anmelden' : `${totalNewPersonen} Personen anmelden`}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Bestätigung ── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Erfolgs-Header */}
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <IconCircleCheck size={36} className="text-green-600" stroke={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {registriertPersonen.reduce((sum, p) => sum + p.anzahl_personen, 0)} Personen erfolgreich angemeldet!
              </h2>
              {selectedEvent && (
                <p className="text-sm text-muted-foreground mt-1">
                  für{' '}
                  <span className="font-medium text-foreground">
                    {selectedEvent.fields.titel}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Angemeldete Personen */}
          {registriertPersonen.length > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Angemeldete Personen
                </h3>
              </div>
              <ul className="divide-y">
                {registriertPersonen.map((p, idx) => (
                  <li key={idx} className="flex items-center justify-between px-4 py-3 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <IconUsers size={14} className="text-primary" />
                      </div>
                      <span className="text-sm font-medium truncate">
                        {p.vorname} {p.nachname}
                      </span>
                    </div>
                    {p.anzahl_personen > 1 && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {p.anzahl_personen} Personen
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Veranstaltungs-Kontext */}
          {selectedEvent && (
            <div className="rounded-2xl border bg-card p-4 overflow-hidden">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconCalendarEvent size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{selectedEvent.fields.titel}</p>
                  {selectedEvent.fields.beginn && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {formatVeranstaltungDate(selectedEvent.fields.beginn)}
                    </p>
                  )}
                  {selectedEvent.fields.veranstaltungsort_name && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <IconMapPin size={12} className="shrink-0" />
                      {selectedEvent.fields.veranstaltungsort_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Aktions-Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Weitere Anmeldung
            </Button>
            <a
              href="#/"
              className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Zurück zum Dashboard
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
