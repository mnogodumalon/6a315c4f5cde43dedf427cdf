/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'veranstaltungen'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.veranstaltungen.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.veranstaltungen.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.veranstaltungen.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.veranstaltungen              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   veranstaltungen: veranstalter, titel, beschreibung_veranstaltung, kategorie, beginn, ende, anmeldefrist, veranstaltungsort_name, …  ·  → veranstalter · ← anmeldungen (list + contextual +)
 *   veranstalter: organisation_name, organisation_typ, ansprechpartner_vorname, ansprechpartner_nachname, email, telefon, strasse, hausnummer, …  ·  ← veranstaltungen (list + contextual +)
 *   anmeldungen: veranstaltung, vorname, nachname, email_anmeldung, telefon_anmeldung, anzahl_personen, anmerkungen, email_benachrichtigung  ·  → veranstaltungen
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Veranstaltungen, Veranstalter, Anmeldungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichVeranstaltungen, enrichAnmeldungen } from '@/lib/enrich';
import type { EnrichedVeranstaltungen, EnrichedAnmeldungen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { VeranstaltungenDialog, type VeranstaltungenDialogDefaults } from '@/components/dialogs/VeranstaltungenDialog';
import { VeranstaltungenDetails } from '@/components/details/VeranstaltungenDetails';
import { VeranstalterDialog, type VeranstalterDialogDefaults } from '@/components/dialogs/VeranstalterDialog';
import { VeranstalterDetails } from '@/components/details/VeranstalterDetails';
import { AnmeldungenDialog, type AnmeldungenDialogDefaults } from '@/components/dialogs/AnmeldungenDialog';
import { AnmeldungenDetails } from '@/components/details/AnmeldungenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'veranstaltungen'; record: EnrichedVeranstaltungen }
  | { type: 'veranstalter'; record: Veranstalter }
  | { type: 'anmeldungen'; record: EnrichedAnmeldungen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  veranstaltungen: EntityCrudApi<Veranstaltungen, VeranstaltungenDialogDefaults>;
  veranstalter: EntityCrudApi<Veranstalter, VeranstalterDialogDefaults>;
  anmeldungen: EntityCrudApi<Anmeldungen, AnmeldungenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { veranstaltungen: EnrichedVeranstaltungen[]; veranstalter: Veranstalter[]; anmeldungen: EnrichedAnmeldungen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [veranstaltungenDialog, setVeranstaltungenDialog] = useState<{ defaults?: VeranstaltungenDialogDefaults; editing?: Veranstaltungen } | null>(null);
  const [veranstalterDialog, setVeranstalterDialog] = useState<{ defaults?: VeranstalterDialogDefaults; editing?: Veranstalter } | null>(null);
  const [anmeldungenDialog, setAnmeldungenDialog] = useState<{ defaults?: AnmeldungenDialogDefaults; editing?: Anmeldungen } | null>(null);
  const enrichedVeranstaltungen = useMemo(() => enrichVeranstaltungen(data.veranstaltungen, { veranstalterMap: data.veranstalterMap }), [data.veranstaltungen, data.veranstalterMap]);
  const enrichedAnmeldungen = useMemo(() => enrichAnmeldungen(data.anmeldungen, { veranstaltungenMap: data.veranstaltungenMap }), [data.anmeldungen, data.veranstaltungenMap]);

  function detailVeranstaltungen(record: Veranstaltungen, push = false) {
    const rec = enrichedVeranstaltungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'veranstaltungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitVeranstaltungen(fields: Veranstaltungen['fields']) {
    const editing = veranstaltungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setVeranstaltungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateVeranstaltungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('veranstaltungen')} — ${t('crud_updated')}`, async () => {
        data.setVeranstaltungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateVeranstaltungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createVeranstaltungenEntry(fields);
      undoToast(`${appLabel('veranstaltungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailVeranstalter(record: Veranstalter, push = false) {
    const item: OverlayItem = { type: 'veranstalter', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitVeranstalter(fields: Veranstalter['fields']) {
    const editing = veranstalterDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setVeranstalter(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateVeranstalterEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('veranstalter')} — ${t('crud_updated')}`, async () => {
        data.setVeranstalter(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateVeranstalterEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createVeranstalterEntry(fields);
      undoToast(`${appLabel('veranstalter')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailAnmeldungen(record: Anmeldungen, push = false) {
    const rec = enrichedAnmeldungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'anmeldungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAnmeldungen(fields: Anmeldungen['fields']) {
    const editing = anmeldungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAnmeldungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAnmeldungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('anmeldungen')} — ${t('crud_updated')}`, async () => {
        data.setAnmeldungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAnmeldungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAnmeldungenEntry(fields);
      undoToast(`${appLabel('anmeldungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <VeranstaltungenDialog
        open={veranstaltungenDialog !== null}
        onClose={() => setVeranstaltungenDialog(null)}
        onSubmit={submitVeranstaltungen}
        defaultValues={veranstaltungenDialog?.defaults}
        recordId={veranstaltungenDialog?.editing?.record_id}
        veranstalterList={data.veranstalter}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
      />
      <VeranstalterDialog
        open={veranstalterDialog !== null}
        onClose={() => setVeranstalterDialog(null)}
        onSubmit={submitVeranstalter}
        defaultValues={veranstalterDialog?.defaults}
        recordId={veranstalterDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstalter']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstalter']}
      />
      <AnmeldungenDialog
        open={anmeldungenDialog !== null}
        onClose={() => setAnmeldungenDialog(null)}
        onSubmit={submitAnmeldungen}
        defaultValues={anmeldungenDialog?.defaults}
        recordId={anmeldungenDialog?.editing?.record_id}
        veranstaltungenList={data.veranstaltungen}
        enablePhotoScan={AI_PHOTO_SCAN['Anmeldungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Anmeldungen']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'veranstaltungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.titel ?? appLabel('veranstaltungen')} subtitle={top.record.fields.beginn ? formatDate(top.record.fields.beginn) : undefined} />
                <VeranstaltungenDetails
                  record={top.record}
                  veranstalterList={data.veranstalter}
                  onOpenVeranstalter={(r) => detailVeranstalter(r, true)}
                  anmeldungenList={data.anmeldungen}
                  onOpenAnmeldungen={(r) => detailAnmeldungen(r, true)}
                  onAddAnmeldungen={() => setAnmeldungenDialog({ defaults: { veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'veranstalter') {
            return (
              <>
                <RecordHeader title={top.record.fields.organisation_name ?? appLabel('veranstalter')} subtitle={undefined} />
                <VeranstalterDetails
                  record={top.record}
                  veranstaltungenList={data.veranstaltungen}
                  onOpenVeranstaltungen={(r) => detailVeranstaltungen(r, true)}
                  onAddVeranstaltungen={() => setVeranstaltungenDialog({ defaults: { veranstalter: createRecordUrl(APP_IDS.VERANSTALTER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'anmeldungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('anmeldungen')} subtitle={undefined} />
                <AnmeldungenDetails
                  record={top.record}
                  veranstaltungenList={data.veranstaltungen}
                  onOpenVeranstaltungen={(r) => detailVeranstaltungen(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'veranstaltungen') setVeranstaltungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'veranstalter') setVeranstalterDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'anmeldungen') setAnmeldungenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    veranstaltungen: {
      openCreate: (defaults?: VeranstaltungenDialogDefaults) => setVeranstaltungenDialog({ defaults }),
      openEdit: (record: Veranstaltungen) => setVeranstaltungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Veranstaltungen) => detailVeranstaltungen(record, false),
    },
    veranstalter: {
      openCreate: (defaults?: VeranstalterDialogDefaults) => setVeranstalterDialog({ defaults }),
      openEdit: (record: Veranstalter) => setVeranstalterDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Veranstalter) => detailVeranstalter(record, false),
    },
    anmeldungen: {
      openCreate: (defaults?: AnmeldungenDialogDefaults) => setAnmeldungenDialog({ defaults }),
      openEdit: (record: Anmeldungen) => setAnmeldungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Anmeldungen) => detailAnmeldungen(record, false),
    },
    enriched: { veranstaltungen: enrichedVeranstaltungen, veranstalter: data.veranstalter, anmeldungen: enrichedAnmeldungen },
  };
}
