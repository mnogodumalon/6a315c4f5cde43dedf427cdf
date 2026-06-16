import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Veranstaltungen, Veranstalter, LookupValue } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, uploadFile, getUserProfile, LivingAppsService } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Veranstaltungen';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/Combobox';
import { VeranstalterDialog } from '@/components/dialogs/VeranstalterDialog';
import { DatePicker } from '@/components/DatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { IconAlertCircle, IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconCrosshair, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode, dataUriToBlob } from '@/lib/ai';
import { GeoMapPicker } from '@/components/GeoMapPicker';
import { lookupKey } from '@/lib/formatters';

interface VeranstaltungenDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Veranstaltungen['fields']) => Promise<void>;
  /** SHAPE-TOLERANT: lookup fields accept the bare key (string) or the
   *  LookupValue object; applookup fields the bare record id or the full
   *  record URL — the dialog normalizes both. */
  defaultValues?: Omit<Veranstaltungen['fields'], 'kategorie'> & {
    kategorie?: LookupValue | string;
  };
  /** Record id when editing — enables the attachments section. Omit on create. */
  recordId?: string;
  veranstalterList: Veranstalter[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

// defaultValues are SHAPE-TOLERANT: the dialog resolves bare lookup keys via
// its own options and bare record ids via the field's target app — consumers
// never carry the LookupValue/record-URL shape in their head.
const NORMALIZE_LOOKUPS: Record<string, readonly { key: string; label: string }[]> = {
  kategorie: LOOKUP_OPTIONS['veranstaltungen']?.['kategorie'] ?? [],
};
const NORMALIZE_APPLOOKUPS: Record<string, string> = {
  veranstalter: APP_IDS.VERANSTALTER,
};
function normalizeDefaults(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const [k, opts] of Object.entries(NORMALIZE_LOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string') out[k] = opts.find(o => o.key === v) ?? { key: v, label: v };
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' ? opts.find(o => o.key === x) ?? { key: x, label: x } : x));
  }
  for (const [k, appId] of Object.entries(NORMALIZE_APPLOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string' && v !== '' && !v.startsWith('http')) out[k] = createRecordUrl(appId, v);
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' && x !== '' && !x.startsWith('http') ? createRecordUrl(appId, x) : x));
  }
  return out;
}

export function VeranstaltungenDialog({ open, onClose, onSubmit, defaultValues, recordId, veranstalterList, enablePhotoScan = true, enablePhotoLocation = true }: VeranstaltungenDialogProps) {
  const [fields, setFields] = useState<Partial<Veranstaltungen['fields']>>({});
  const [saving, setSaving] = useState(false);
  const normalizedDefaults = useMemo<Record<string, unknown> | undefined>(
    () => (defaultValues ? normalizeDefaults(defaultValues as Record<string, unknown>) : undefined),
    [defaultValues],
  );
  // Dirty-tracking: in edit-mode the Speichern button is disabled until the
  // user actually changes something. JSON.stringify is good enough for our
  // fields (plain values + LookupValue objects + string arrays).
  const isDirty = useMemo(() => {
    if (!normalizedDefaults) return true;  // create-mode: always allow submit
    try {
      return JSON.stringify(fields) !== JSON.stringify(normalizedDefaults);
    } catch {
      return true;
    }
  }, [fields, normalizedDefaults]);
  // Inline-Create state for "Veranstalter" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraVeranstalter` list, and select it in
  // the originating Combobox via the captured `createVeranstalterField`.
  const [createVeranstalterOpen, setCreateVeranstalterOpen] = useState(false);
  const [createVeranstalterInitial, setCreateVeranstalterInitial] = useState('');
  const [createVeranstalterField, setCreateVeranstalterField] = useState<string>('');
  const [extraVeranstalter, setExtraVeranstalter] = useState< Veranstalter[]>([]);
  const veranstalterListAll = useMemo(
    () => [...veranstalterList, ...extraVeranstalter],
    [veranstalterList, extraVeranstalter],
  );
  function openCreateVeranstalter(fieldKey: string, q: string) {
    setCreateVeranstalterField(fieldKey);
    setCreateVeranstalterInitial(q);
    setCreateVeranstalterOpen(true);
  }
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Computed-field plumbing. Pure no-op when formEnhancements.computed is {}.
  // The number renderer uses computedValues only as a fallback when the user
  // hasn't typed anything — clearing the input always restores the computation.
  // computedContext exposes applookup list props so { kind: 'applookup', ... }
  // operands can resolve to numeric fields on the target record.
  const computedContext = useMemo<ComputedContext>(() => ({
    lookupLists: {
      'veranstalter': veranstalterList,
    },
  }), [veranstalterList, ]);
  const computedValues = useMemo<Record<string, number | null>>(() => {
    let out: Record<string, number | null> = {};
    const entries = Object.entries(formEnhancements.computed);
    for (let i = 0; i < 5; i++) {
      const merged: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
      for (const [k, v] of Object.entries(out)) {
        if (v === null) continue;
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') merged[k] = v;
      }
      const next: Record<string, number | null> = {};
      let changed = false;
      for (const [key, spec] of entries) {
        const v = evalComputed(spec, merged, computedContext);
        next[key] = v;
        if (v !== out[key]) changed = true;
      }
      out = next;
      if (!changed) break;
    }
    return out;
  }, [fields, computedContext]);

  useEffect(() => {
    if (open) {
      setFields(applyDefaults(normalizedDefaults ?? {}, formEnhancements.defaults) as Partial<Veranstaltungen['fields']>);
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
      setSubmitError(null);
      setGeoFromPhoto(false);
    }
  }, [open, normalizedDefaults]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  // Submit errors surface IN the dialog (it is modal — a banner in the page
  // body would be hidden behind it). A consumer onSubmit that THROWS (the
  // documented "throw to prevent closing" validation pattern) lands here:
  // the dialog stays open, nothing is saved, the message is visible.
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSubmitError(null);
    try {
      // Fill empty number slots from computed values; user-typed values always win.
      // CRITICAL: only backend-mapped keys may be backfilled. Virtual computeds
      // (sub-agent invents `_netto`, `_bestellung_gesamtbetrag` etc. for the
      // "Berechnungen" display) have no backend counterpart — writing them
      // triggers a 422 from the Living-Apps API ("field does not exist").
      const merged = { ...fields };
      for (const [key, val] of Object.entries(computedValues)) {
        if (val === null) continue;
        if (!backendFieldSet.has(key)) continue;
        const cur = (merged as Record<string, unknown>)[key];
        if (cur === undefined || cur === null || cur === '') {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      const clean = cleanFieldsForApi(merged, 'veranstaltungen');
      await onSubmit(clean as Veranstaltungen['fields']);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  const [locating, setLocating] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [geoFromPhoto, setGeoFromPhoto] = useState(false);
  const geoDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  async function geoLocate(fieldKey: string) {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      let info = '';
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        info = data.display_name ?? '';
      } catch {}
      setFields(f => ({ ...f, [fieldKey]: { lat: latitude, long: longitude, info } as any }));
      setGeoFromPhoto(false);
      setLocating(false);
    }, () => { setLocating(false); });
  }
  function handleMapMove(fieldKey: string, lat: number, lng: number) {
    setFields(f => ({ ...f, [fieldKey]: { ...((f as any)[fieldKey] ?? {}), lat, long: lng } }));
    clearTimeout(geoDebounceRef.current);
    geoDebounceRef.current = setTimeout(async () => {
      const info = await reverseGeocode(lat, lng);
      setFields(f => ({ ...f, [fieldKey]: { ...((f as any)[fieldKey] ?? {}), info } }));
    }, 600);
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="veranstalter" entity="Veranstalter">\n${JSON.stringify(veranstalterList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "veranstalter": string | null, // Display name from Veranstalter (see <available-records>)\n  "titel": string | null, // Titel der Veranstaltung\n  "beschreibung_veranstaltung": string | null, // Beschreibung\n  "kategorie": LookupValue | null, // Kategorie (select one key: "gesundheit" | "sport" | "ernaehrung" | "entspannung" | "beratung" | "sonstiges") mapping: gesundheit=Gesundheit & Prävention, sport=Sport & Bewegung, ernaehrung=Ernährung, entspannung=Entspannung & Achtsamkeit, beratung=Beratung & Information, sonstiges=Sonstiges\n  "beginn": string | null, // YYYY-MM-DDTHH:MM\n  "ende": string | null, // YYYY-MM-DDTHH:MM\n  "anmeldefrist": string | null, // YYYY-MM-DD\n  "veranstaltungsort_name": string | null, // Name des Veranstaltungsorts\n  "veranstaltungsort_strasse": string | null, // Straße\n  "veranstaltungsort_hausnummer": string | null, // Hausnummer\n  "veranstaltungsort_plz": string | null, // Postleitzahl\n  "veranstaltungsort_ort": string | null, // Ort\n  "max_teilnehmer": number | null, // Maximale Teilnehmerzahl\n  "kosten": string | null, // Kosten / Eintritt\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["veranstalter"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const veranstalterName = raw['veranstalter'] as string | null;
        if (veranstalterName) {
          const veranstalterMatch = veranstalterList.find(r => matchName(veranstalterName!, [String(r.fields.organisation_name ?? '')]));
          if (veranstalterMatch) merged['veranstalter'] = createRecordUrl(APP_IDS.VERANSTALTER, veranstalterMatch.record_id);
        }
        return merged as Partial<Veranstaltungen['fields']>;
      });
      // Upload scanned file to file fields
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          const blob = dataUriToBlob(uri!);
          const fileUrl = await uploadFile(blob, file.name);
          setFields(prev => ({ ...prev, flyer: fileUrl }));
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
        }
      }
      if (gps) {
        setFields(f => ({ ...f, veranstaltungsort_geo: { lat: gps.latitude, long: gps.longitude, info: geoAddr } as any }));
        setGeoFromPhoto(true);
      }
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error('Scan fehlgeschlagen:', err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues ? 'Veranstaltungen bearbeiten' : 'Veranstaltungen hinzufügen';

  const fieldBlocks: Record<string, React.ReactNode> = {
    'veranstalter': (
      <div key="veranstalter" className="space-y-1.5">
        <Label htmlFor="veranstalter">Veranstalter (E-Mail-Adresse)</Label>
        <Combobox
          id="veranstalter"
          placeholder=""
          items={veranstalterListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.organisation_name ?? r.record_id),
          }))}
          value={extractRecordId(fields.veranstalter)}
          onChange={id => setFields(f => ({ ...f, veranstalter: id ? createRecordUrl(APP_IDS.VERANSTALTER, id) : undefined }))}
          searchPlaceholder="Suchen…"
          emptyText="Kein Treffer"
          onCreateNew={(q) => openCreateVeranstalter("veranstalter", q)}
          createLabel="Neu in Veranstalter"
        />
      </div>
    ),
    'titel': (
      <div key="titel" className="space-y-1.5">
        <Label htmlFor="titel">Titel der Veranstaltung</Label>
        <Input
          id="titel"
          placeholder=""
          value={fields.titel ?? ''}
          onChange={e => setFields(f => ({ ...f, titel: e.target.value }))}
        />
      </div>
    ),
    'beschreibung_veranstaltung': (
      <div key="beschreibung_veranstaltung" className="space-y-1.5">
        <Label htmlFor="beschreibung_veranstaltung">Beschreibung</Label>
        <Textarea
          id="beschreibung_veranstaltung"
          placeholder=""
          value={fields.beschreibung_veranstaltung ?? ''}
          onChange={e => setFields(f => ({ ...f, beschreibung_veranstaltung: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'kategorie': (
      <div key="kategorie" className="space-y-1.5">
        <Label htmlFor="kategorie">Kategorie</Label>
        <Select
          value={lookupKey(fields.kategorie) ?? ''}
          onValueChange={v => setFields(f => ({ ...f, kategorie: v === 'none' ? undefined : v as any }))}
        >
          <SelectTrigger id="kategorie"><SelectValue placeholder="" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="gesundheit">Gesundheit & Prävention</SelectItem>
            <SelectItem value="sport">Sport & Bewegung</SelectItem>
            <SelectItem value="ernaehrung">Ernährung</SelectItem>
            <SelectItem value="entspannung">Entspannung & Achtsamkeit</SelectItem>
            <SelectItem value="beratung">Beratung & Information</SelectItem>
            <SelectItem value="sonstiges">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
      </div>
    ),
    'beginn': (
      <div key="beginn" className="space-y-1.5">
        <Label htmlFor="beginn">Beginn (Datum & Uhrzeit)</Label>
        <DatePicker
          id="beginn"
          placeholder=""
          mode="datetime"
          value={fields.beginn ?? null}
          onChange={v => setFields(f => ({ ...f, beginn: v ?? undefined }))}
        />
      </div>
    ),
    'ende': (
      <div key="ende" className="space-y-1.5">
        <Label htmlFor="ende">Ende (Datum & Uhrzeit)</Label>
        <DatePicker
          id="ende"
          placeholder=""
          mode="datetime"
          value={fields.ende ?? null}
          onChange={v => setFields(f => ({ ...f, ende: v ?? undefined }))}
        />
      </div>
    ),
    'anmeldefrist': (
      <div key="anmeldefrist" className="space-y-1.5">
        <Label htmlFor="anmeldefrist">Anmeldefrist</Label>
        <DatePicker
          id="anmeldefrist"
          placeholder=""
          mode="date"
          value={fields.anmeldefrist ?? null}
          onChange={v => setFields(f => ({ ...f, anmeldefrist: v ?? undefined }))}
        />
      </div>
    ),
    'veranstaltungsort_name': (
      <div key="veranstaltungsort_name" className="space-y-1.5">
        <Label htmlFor="veranstaltungsort_name">Name des Veranstaltungsorts</Label>
        <Input
          id="veranstaltungsort_name"
          placeholder=""
          value={fields.veranstaltungsort_name ?? ''}
          onChange={e => setFields(f => ({ ...f, veranstaltungsort_name: e.target.value }))}
        />
      </div>
    ),
    'veranstaltungsort_strasse': (
      <div key="veranstaltungsort_strasse" className="space-y-1.5">
        <Label htmlFor="veranstaltungsort_strasse">Straße</Label>
        <Input
          id="veranstaltungsort_strasse"
          placeholder=""
          value={fields.veranstaltungsort_strasse ?? ''}
          onChange={e => setFields(f => ({ ...f, veranstaltungsort_strasse: e.target.value }))}
        />
      </div>
    ),
    'veranstaltungsort_hausnummer': (
      <div key="veranstaltungsort_hausnummer" className="space-y-1.5">
        <Label htmlFor="veranstaltungsort_hausnummer">Hausnummer</Label>
        <Input
          id="veranstaltungsort_hausnummer"
          placeholder=""
          value={fields.veranstaltungsort_hausnummer ?? ''}
          onChange={e => setFields(f => ({ ...f, veranstaltungsort_hausnummer: e.target.value }))}
        />
      </div>
    ),
    'veranstaltungsort_plz': (
      <div key="veranstaltungsort_plz" className="space-y-1.5">
        <Label htmlFor="veranstaltungsort_plz">Postleitzahl</Label>
        <Input
          id="veranstaltungsort_plz"
          placeholder=""
          value={fields.veranstaltungsort_plz ?? ''}
          onChange={e => setFields(f => ({ ...f, veranstaltungsort_plz: e.target.value }))}
        />
      </div>
    ),
    'veranstaltungsort_ort': (
      <div key="veranstaltungsort_ort" className="space-y-1.5">
        <Label htmlFor="veranstaltungsort_ort">Ort</Label>
        <Input
          id="veranstaltungsort_ort"
          placeholder=""
          value={fields.veranstaltungsort_ort ?? ''}
          onChange={e => setFields(f => ({ ...f, veranstaltungsort_ort: e.target.value }))}
        />
      </div>
    ),
    'veranstaltungsort_geo': (
      <div key="veranstaltungsort_geo" className="space-y-1.5">
        <Label htmlFor="veranstaltungsort_geo">Standort auf der Karte</Label>
        <div className="space-y-3">
          <Button type="button" variant="outline" className="w-full" disabled={locating} onClick={() => geoLocate("veranstaltungsort_geo")}>
            {locating ? <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <IconCrosshair className="h-4 w-4 mr-1.5" />}
            Aktuellen Standort verwenden
          </Button>
          {geoFromPhoto && fields.veranstaltungsort_geo && (
            <p className="text-xs text-primary italic">Standort aus Foto übernommen</p>
          )}
          {fields.veranstaltungsort_geo?.info && (
            <p className="text-sm text-muted-foreground break-words whitespace-normal">
              {fields.veranstaltungsort_geo.info}
            </p>
          )}
          {fields.veranstaltungsort_geo?.lat != null && fields.veranstaltungsort_geo?.long != null && (
            <GeoMapPicker
              lat={fields.veranstaltungsort_geo.lat}
              lng={fields.veranstaltungsort_geo.long}
              onChange={(lat, lng) => handleMapMove("veranstaltungsort_geo", lat, lng)}
            />
          )}
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors" onClick={() => setShowCoords(v => !v)}>
            {showCoords ? 'Koordinaten verbergen' : 'Koordinaten anzeigen'}
            <IconChevronDown className={`h-3 w-3 transition-transform ${showCoords ? "rotate-180" : ""}`} />
          </button>
          {showCoords && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Breitengrad</Label>
                <Input type="number" step="any"
                  value={fields.veranstaltungsort_geo?.lat ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setFields(f => ({ ...f, veranstaltungsort_geo: { ...(f.veranstaltungsort_geo as any ?? {}), lat: v ? Number(v) : undefined } }));
                  }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Längengrad</Label>
                <Input type="number" step="any"
                  value={fields.veranstaltungsort_geo?.long ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setFields(f => ({ ...f, veranstaltungsort_geo: { ...(f.veranstaltungsort_geo as any ?? {}), long: v ? Number(v) : undefined } }));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    'max_teilnehmer': (
      <div key="max_teilnehmer" className="space-y-1.5">
        <Label htmlFor="max_teilnehmer">Maximale Teilnehmerzahl</Label>
        <Input
          id="max_teilnehmer"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'max_teilnehmer')}
          placeholder=""
          value={fields.max_teilnehmer !== undefined ? fields.max_teilnehmer : (computedValues['max_teilnehmer'] ?? '')}
          onChange={e => setFields(f => ({ ...f, max_teilnehmer: clampNumberValue(formEnhancements, 'max_teilnehmer', e.target.value) }))}
        />
      </div>
    ),
    'kosten': (
      <div key="kosten" className="space-y-1.5">
        <Label htmlFor="kosten">Kosten / Eintritt</Label>
        <Input
          id="kosten"
          placeholder=""
          value={fields.kosten ?? ''}
          onChange={e => setFields(f => ({ ...f, kosten: e.target.value }))}
        />
      </div>
    ),
    'flyer': (
      <div key="flyer" className="space-y-1.5">
        <Label htmlFor="flyer">Bild / Flyer</Label>
        {fields.flyer ? (
          <div className="flex items-center gap-3 rounded-lg border p-2">
            <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <IconFileText size={20} className="text-muted-foreground" />
              </div>
              <img
                src={fields.flyer}
                alt=""
                className="relative h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-foreground">{fields.flyer.split("/").pop()}</p>
              <div className="flex gap-2 mt-1">
                <label
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  Ändern
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const fileUrl = await uploadFile(file, file.name);
                        setFields(f => ({ ...f, flyer: fileUrl }));
                      } catch (err) { console.error('Upload failed:', err); }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setFields(f => ({ ...f, flyer: undefined }))}
                >
                  Entfernen
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <IconUpload size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Datei hochladen</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const fileUrl = await uploadFile(file, file.name);
                  setFields(f => ({ ...f, flyer: fileUrl }));
                } catch (err) { console.error('Upload failed:', err); }
              }}
            />
          </label>
        )}
      </div>
    ),
  };
  const orderedFields = applyFieldOrder(Object.keys(fieldBlocks), formEnhancements.fieldOrder);
  const orderedFieldsKey = orderedFields.map((it) => typeof it === 'string' ? it : it.row.join('+')).join(',');

  // Render-Modell für Computed-Felder:
  //
  //   • BACKEND-FELDER mit computed-Eintrag (z.B. gesamtpreis bei einer
  //     Katzenpension) bleiben als normales Eingabe-Feld stehen. Der Number-
  //     Input nutzt den computed-Wert als Vorschlag, der User kann jederzeit
  //     überschreiben (clearing → restore computed).
  //   • VIRTUELLE computed-Keys (Eintrag in formEnhancements.computed, ABER
  //     kein passendes Backend-Feld in orderedFields) erscheinen NICHT als
  //     Input, sondern unten als kompakte 'Berechnungen'-Übersicht oder als
  //     Inline-Hint unter dem letzten beitragenden Input.
  const FIELD_LABELS: Record<string, string> = {"veranstalter": "Veranstalter (E-Mail-Adresse)", "titel": "Titel der Veranstaltung", "beschreibung_veranstaltung": "Beschreibung", "kategorie": "Kategorie", "beginn": "Beginn (Datum & Uhrzeit)", "ende": "Ende (Datum & Uhrzeit)", "anmeldefrist": "Anmeldefrist", "veranstaltungsort_name": "Name des Veranstaltungsorts", "veranstaltungsort_strasse": "Straße", "veranstaltungsort_hausnummer": "Hausnummer", "veranstaltungsort_plz": "Postleitzahl", "veranstaltungsort_ort": "Ort", "veranstaltungsort_geo": "Standort auf der Karte", "max_teilnehmer": "Maximale Teilnehmerzahl", "kosten": "Kosten / Eintritt", "flyer": "Bild / Flyer"};
  const CURRENCY_KEYS = new Set<string>([]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {"veranstalter": {"organisation_name": "Name der Organisation", "organisation_typ": "Typ der Organisation", "ansprechpartner_vorname": "Vorname Ansprechpartner", "ansprechpartner_nachname": "Nachname Ansprechpartner", "email": "E-Mail-Adresse", "telefon": "Telefonnummer", "strasse": "Straße", "hausnummer": "Hausnummer", "plz": "Postleitzahl", "ort": "Ort", "website": "Website", "beschreibung": "Beschreibung der Organisation"}};
  const inputFields = useMemo(() => flattenFieldOrder(orderedFields), [orderedFieldsKey]);
  const backendFieldSet = useMemo(() => new Set(inputFields), [inputFields.join(',')]);
  const virtualComputed = useMemo(
    () => Object.fromEntries(
      Object.entries(formEnhancements.computed).filter(([k]) => !backendFieldSet.has(k)),
    ),
    [backendFieldSet],
  );
  const virtualFormEnhancements = useMemo(
    () => ({ ...formEnhancements, computed: virtualComputed }),
    [virtualComputed],
  );
  const computedLayout = useMemo(
    () => classifyComputed(virtualFormEnhancements, inputFields, computedDeps),
    [virtualFormEnhancements, inputFields.join(',')],
  );
  // Applookup-Referenzen: pro ownKey (Lookup-Feld im Form) die Liste der
  // lookupKeys, die in irgendeiner computed-Formel referenziert werden.
  // MODUS-1: aus dem Spec-Tree extrahiert. MODUS-2: aus dem Build-Time-
  // Export computedApplookupRefs (parse-formulas hat Regex-Pairs gesammelt).
  // Pro (ownKey, lookupKey)-Paar nur einmal; pro ownKey können aber mehrere
  // lookupKeys gleichzeitig auftauchen (z.B. einzelpreis UND karten10_preis
  // beim Yoga-Kurs), und alle werden separat als Inline-Hint gerendert.
  const applookupRefs = useMemo(
    () => mergeApplookupRefs(
      extractApplookupRefs(formEnhancements.computed),
      computedApplookupRefs,
    ),
    [],
  );
  function summaryLabel(k: string): string {
    if (FIELD_LABELS[k]) return FIELD_LABELS[k];
    // Leading underscore(s) als Virtual-Marker abstreifen; Unterstriche zu
    // Leerzeichen, jedes Wort kapitalisieren. Umlaute kommen vom Sub-Agent
    // direkt im Key (z. B. `_buchung_dauer_nächte`) — JS/TS/Vite unterstützen
    // Unicode-Identifier nativ, daher keine ASCII-Transliteration nötig.
    return k.replace(/^_+/, '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function formatSummaryValue(k: string, v: unknown): string {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Backend-Feld mit €-Label ODER virtueller Computed-Key, dessen Name nach Geld aussieht.
    const looksLikeCurrency = CURRENCY_KEYS.has(k) || /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k);
    if (looksLikeCurrency) {
      return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center gap-3 space-y-0">
          <DialogTitle className="flex-1 truncate text-left">{DIALOG_INTENT}</DialogTitle>
          {enablePhotoScan && (
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
              aria-controls="ai-fill-panel"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all mr-7 shadow-sm ${
                aiOpen
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:border-primary/50'
              }`}
            >
              <IconSparkles className={`h-3.5 w-3.5 ${aiOpen ? '' : 'text-primary'}`} />
              <span className="hidden sm:inline">KI-Ausfüllen</span>
              <IconChevronDown className={`h-3 w-3 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </DialogHeader>
        {enablePhotoScan && aiOpen && (
          <div id="ai-fill-panel" className="border-b bg-muted/20 px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">Versteht Fotos, Dokumente und Text und füllt alles für dich aus</p>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  KI-Assistent darf zusätzlich Informationen zu meiner Person verwenden
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? 'Lade...' : '(mehr Infos)'}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Folgende Infos über dich können von der KI genutzt werden:</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">Profil konnte nicht geladen werden</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">KI analysiert...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Felder werden automatisch ausgefüllt</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Felder ausgefüllt!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüfe die Werte und passe sie ggf. an</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Foto oder Dokument hierher ziehen oder auswählen</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />Kamera
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />Foto wählen
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />Dokument
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder="Text eingeben oder einfügen, z.B. Notizen, E-Mails, Beschreibungen..."
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title="Paste"
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />Analysieren
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 min-w-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
            {(() => {
              const renderField = (k: string) => {
                const inlineHints = computedLayout.anchors[k] ?? [];
                const refs = applookupRefs[k] ?? [];
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    {fieldBlocks[k]}
                    {refs.map(({ lookupKey }) => {
                      // Show the live numeric value the formula will pull from
                      // the selected lookup target (e.g. "Monatspreis: 34,90 €"
                      // under the Tarif combobox). Hidden while no lookup is
                      // selected or the target field is non-numeric.
                      const v = resolveApplookupRef(k, lookupKey, fields as Record<string, unknown>, computedContext);
                      if (v === null) return null;
                      const lbl = APPLOOKUP_LABELS[k]?.[lookupKey] ?? lookupKey;
                      const text = formatSummaryValue(lookupKey, v);
                      return (
                        <div key={`alh-${k}-${lookupKey}`} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{lbl}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                    {inlineHints.map((cKey) => {
                      const v = computedValues[cKey];
                      const text = formatSummaryValue(cKey, v);
                      if (text === '—') return null;
                      return (
                        <div key={cKey} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{summaryLabel(cKey)}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return orderedFields.map((item, idx) => {
                if (typeof item === 'string') return renderField(item);
                const cols = item.cols ?? `repeat(${item.row.length}, minmax(0, 1fr))`;
                return (
                  <div key={`row-${idx}`} className="grid gap-3" style={{ gridTemplateColumns: cols }}>
                    {item.row.map(renderField)}
                  </div>
                );
              });
            })()}
            {(computedLayout.aggregates.length > 0 || computedLayout.finalTotal) && (
              <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                {computedLayout.aggregates.length > 0 && (
                  <dl className="space-y-1.5 pb-2">
                    {computedLayout.aggregates.map((k) => {
                      const userVal = (fields as Record<string, unknown>)[k];
                      const computed = computedValues[k];
                      const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                      return (
                        <div key={k} className="flex justify-between items-baseline gap-3">
                          <dt className="text-sm text-muted-foreground truncate">{summaryLabel(k)}</dt>
                          <dd className="text-sm font-medium tabular-nums whitespace-nowrap">{formatSummaryValue(k, v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {computedLayout.finalTotal && (() => {
                  const k = computedLayout.finalTotal;
                  const userVal = (fields as Record<string, unknown>)[k];
                  const computed = computedValues[k];
                  const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                  // Innere Border nur wenn aggregates existieren — sonst hätten wir
                  // zwei direkt aufeinanderfolgende Striche (Outer + Inner) mit nur
                  // einer Aggregat-Zeile dazwischen → zu viel visuelles Rauschen.
                  const sep = computedLayout.aggregates.length > 0 ? 'pt-3 border-t border-border' : 'pt-1';
                  return (
                    <div className={`flex justify-between items-baseline gap-3 ${sep}`}>
                      <span className="text-base font-semibold text-foreground">{summaryLabel(k)}</span>
                      <span className="text-lg font-bold tabular-nums whitespace-nowrap text-foreground">{formatSummaryValue(k, v)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            {recordId && (
              <div className="pt-2 border-t border-border">
                <AttachmentsSection appId={APP_IDS.VERANSTALTUNGEN} recordId={recordId} />
              </div>
            )}
          </div>
          {submitError && (
            <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive" role="alert">
              <IconAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{submitError}</span>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button
              type="submit"
              disabled={saving || !isDirty}
            >
              {saving ? 'Speichern...' : defaultValues ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {createVeranstalterOpen && (
      <VeranstalterDialog
        open={createVeranstalterOpen}
        onClose={() => setCreateVeranstalterOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createVeranstalterEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Veranstalter;
            setExtraVeranstalter(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.VERANSTALTER, result.id);
            setFields(prev => ({ ...prev, [createVeranstalterField]: url } as any));
          }
          setCreateVeranstalterOpen(false);
        }}
        defaultValues={createVeranstalterInitial
          ? ({ organisation_name: createVeranstalterInitial } as any)
          : undefined}
      />
    )}
    </>
  );
}