import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Veranstaltungen, Veranstalter } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Veranstaltungen';
import { evalComputed } from '@/config/form-enhancements/types';

export default function VeranstaltungenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Veranstaltungen | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [veranstalterList, setVeranstalterList] = useState<Veranstalter[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, veranstalterData] = await Promise.all([
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getVeranstalter(),
      ]);
      setVeranstalterList(veranstalterData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Veranstaltungen['fields']) {
    if (!record) return;
    await LivingAppsService.updateVeranstaltungenEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteVeranstaltungenEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/veranstaltungen');
  }

  function getVeranstalterDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return veranstalterList.find(r => r.record_id === refId)?.fields.organisation_name ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/veranstaltungen')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/veranstaltungen')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.titel ?? 'Veranstaltungen'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          veranstalter: veranstalterList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Veranstalter (E-Mail-Adresse)" value={getVeranstalterDisplayName(record.fields.veranstalter)} format="text" />
        <RecordField label="Titel der Veranstaltung" value={record.fields.titel} format="text" />
        <RecordField label="Beschreibung" value={record.fields.beschreibung_veranstaltung} format="longtext" className="md:col-span-2" />
        <RecordField label="Kategorie" value={record.fields.kategorie} format="pill" />
        <RecordField label="Beginn (Datum & Uhrzeit)" value={record.fields.beginn} format="datetime" />
        <RecordField label="Ende (Datum & Uhrzeit)" value={record.fields.ende} format="datetime" />
        <RecordField label="Anmeldefrist" value={record.fields.anmeldefrist} format="date" />
        <RecordField label="Name des Veranstaltungsorts" value={record.fields.veranstaltungsort_name} format="text" />
        <RecordField label="Straße" value={record.fields.veranstaltungsort_strasse} format="text" />
        <RecordField label="Hausnummer" value={record.fields.veranstaltungsort_hausnummer} format="text" />
        <RecordField label="Postleitzahl" value={record.fields.veranstaltungsort_plz} format="text" />
        <RecordField label="Ort" value={record.fields.veranstaltungsort_ort} format="text" />
        <RecordField label="Maximale Teilnehmerzahl" value={record.fields.max_teilnehmer} format="text" />
        <RecordField label="Kosten / Eintritt" value={record.fields.kosten} format="text" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.VERANSTALTUNGEN} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <VeranstaltungenDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        veranstalterList={veranstalterList}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Veranstaltungen löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
