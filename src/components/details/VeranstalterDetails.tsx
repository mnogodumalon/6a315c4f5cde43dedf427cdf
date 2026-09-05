import type { Veranstalter, Veranstaltungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface VeranstalterDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Veranstalter;
  /** 1:N „Veranstaltungen" (veranstalter): VOLLE Liste — der Block filtert auf diesen Record. */
  veranstaltungenList: Veranstaltungen[];
  /** Zeilen-Klick → overlay.push auf das Veranstaltungen-Detail (nie der Edit-Dialog). */
  onOpenVeranstaltungen: (record: Veranstaltungen) => void;
  /** Kontextuelles „+": öffnet den Veranstaltungen-Dialog mit diesem Record vorgesetzt. */
  onAddVeranstaltungen: () => void;
}

export function VeranstalterDetails({
  record,
  veranstaltungenList,
  onOpenVeranstaltungen,
  onAddVeranstaltungen,
}: VeranstalterDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('veranstalter', 'organisation_name')} value={record.fields.organisation_name} format="text" />
        <RecordField label={fieldLabel('veranstalter', 'organisation_typ')} value={record.fields.organisation_typ} format="pill" />
        <RecordField label={fieldLabel('veranstalter', 'ansprechpartner_vorname')} value={record.fields.ansprechpartner_vorname} format="text" />
        <RecordField label={fieldLabel('veranstalter', 'ansprechpartner_nachname')} value={record.fields.ansprechpartner_nachname} format="text" />
        <RecordField label={fieldLabel('veranstalter', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('veranstalter', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('veranstalter', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('veranstalter', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('veranstalter', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('veranstalter', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('veranstalter', 'website')} value={record.fields.website} format="url" />
        <RecordField label={fieldLabel('veranstalter', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('veranstaltungen')}
        items={veranstaltungenList.filter(r => extractRecordId(r.fields.veranstalter) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('veranstaltungen'), meta: r.fields.beginn })}
        onOpen={onOpenVeranstaltungen}
        onAdd={onAddVeranstaltungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.VERANSTALTER} recordId={record.record_id} />
    </>
  );
}
