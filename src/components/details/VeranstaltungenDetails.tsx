import type { Veranstaltungen, Veranstalter, Anmeldungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { MapRouteLinks } from '@/components/widgets/MapWidget';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface VeranstaltungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Veranstaltungen;
  /** N:1-Ziel „Veranstalter": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  veranstalterList: Veranstalter[];
  /** Klick auf die Veranstalter-Relation → overlay.push auf dessen Detail. */
  onOpenVeranstalter?: (record: Veranstalter) => void;
  /** 1:N „Anmeldungen" (veranstaltung): VOLLE Liste — der Block filtert auf diesen Record. */
  anmeldungenList: Anmeldungen[];
  /** Zeilen-Klick → overlay.push auf das Anmeldungen-Detail (nie der Edit-Dialog). */
  onOpenAnmeldungen: (record: Anmeldungen) => void;
  /** Kontextuelles „+": öffnet den Anmeldungen-Dialog mit diesem Record vorgesetzt. */
  onAddAnmeldungen: () => void;
}

export function VeranstaltungenDetails({
  record,
  veranstalterList,
  onOpenVeranstalter,
  anmeldungenList,
  onOpenAnmeldungen,
  onAddAnmeldungen,
}: VeranstaltungenDetailsProps) {
  const veranstalterTarget = veranstalterList.find(r => r.record_id === extractRecordId(record.fields.veranstalter));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('veranstaltungen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'beschreibung_veranstaltung')} value={record.fields.beschreibung_veranstaltung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('veranstaltungen', 'kategorie')} value={record.fields.kategorie} format="pill" />
        <RecordField label={fieldLabel('veranstaltungen', 'beginn')} value={record.fields.beginn} format="datetime" />
        <RecordField label={fieldLabel('veranstaltungen', 'ende')} value={record.fields.ende} format="datetime" />
        <RecordField label={fieldLabel('veranstaltungen', 'anmeldefrist')} value={record.fields.anmeldefrist} format="date" />
        <RecordField label={fieldLabel('veranstaltungen', 'veranstaltungsort_name')} value={record.fields.veranstaltungsort_name} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'veranstaltungsort_strasse')} value={record.fields.veranstaltungsort_strasse} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'veranstaltungsort_hausnummer')} value={record.fields.veranstaltungsort_hausnummer} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'veranstaltungsort_plz')} value={record.fields.veranstaltungsort_plz} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'veranstaltungsort_ort')} value={record.fields.veranstaltungsort_ort} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'veranstaltungsort_geo')}>
          {record.fields.veranstaltungsort_geo ? (
            <div className="space-y-1">
              <div>{record.fields.veranstaltungsort_geo.info ?? `${record.fields.veranstaltungsort_geo.lat}, ${record.fields.veranstaltungsort_geo.long}`}</div>
              {/* Directions links — the map popup is hover-fleeting; the overlay
                  is the only mobile-reachable place for navigation. */}
              <MapRouteLinks lat={record.fields.veranstaltungsort_geo.lat} long={record.fields.veranstaltungsort_geo.long} />
            </div>
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('veranstaltungen', 'max_teilnehmer')} value={record.fields.max_teilnehmer} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'kosten')} value={record.fields.kosten} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'flyer')} className="md:col-span-2">
          {record.fields.flyer ? (
            <MediaThumbnail src={record.fields.flyer as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('veranstaltungen', 'veranstalter')}
          name={veranstalterTarget?.fields.organisation_name ?? '—'}
          meta={[veranstalterTarget?.fields.email, veranstalterTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={veranstalterTarget && onOpenVeranstalter ? () => onOpenVeranstalter!(veranstalterTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('anmeldungen')}
        items={anmeldungenList.filter(r => extractRecordId(r.fields.veranstaltung) === record.record_id)}
        map={r => ({ name: r.fields.vorname ?? appLabel('anmeldungen'), meta: undefined })}
        onOpen={onOpenAnmeldungen}
        onAdd={onAddAnmeldungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.VERANSTALTUNGEN} recordId={record.record_id} />
    </>
  );
}
