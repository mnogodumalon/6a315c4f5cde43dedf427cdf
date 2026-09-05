import type { Anmeldungen, Veranstaltungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface AnmeldungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Anmeldungen;
  /** N:1-Ziel „Veranstaltungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  veranstaltungenList: Veranstaltungen[];
  /** Klick auf die Veranstaltungen-Relation → overlay.push auf dessen Detail. */
  onOpenVeranstaltungen?: (record: Veranstaltungen) => void;
}

export function AnmeldungenDetails({
  record,
  veranstaltungenList,
  onOpenVeranstaltungen,
}: AnmeldungenDetailsProps) {
  const veranstaltungTarget = veranstaltungenList.find(r => r.record_id === extractRecordId(record.fields.veranstaltung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('anmeldungen', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('anmeldungen', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('anmeldungen', 'email_anmeldung')} value={record.fields.email_anmeldung} format="email" />
        <RecordField label={fieldLabel('anmeldungen', 'telefon_anmeldung')} value={record.fields.telefon_anmeldung} format="text" />
        <RecordField label={fieldLabel('anmeldungen', 'anzahl_personen')} value={record.fields.anzahl_personen} format="text" />
        <RecordField label={fieldLabel('anmeldungen', 'anmerkungen')} value={record.fields.anmerkungen} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('anmeldungen', 'email_benachrichtigung')} value={record.fields.email_benachrichtigung} format="bool" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('anmeldungen', 'veranstaltung')}
          name={veranstaltungTarget?.fields.titel ?? '—'}
          meta={[veranstaltungTarget?.fields.veranstaltungsort_name, veranstaltungTarget?.fields.veranstaltungsort_strasse].filter(Boolean).join(' · ') || undefined}
          onClick={veranstaltungTarget && onOpenVeranstaltungen ? () => onOpenVeranstaltungen!(veranstaltungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.ANMELDUNGEN} recordId={record.record_id} />
    </>
  );
}
