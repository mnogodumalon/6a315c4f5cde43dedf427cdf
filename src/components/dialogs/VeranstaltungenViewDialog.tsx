import { useState } from 'react';
import type { Veranstaltungen, Veranstalter } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText, IconChevronDown } from '@tabler/icons-react';
import { GeoMapPicker } from '@/components/GeoMapPicker';
import { MapRouteLinks } from '@/components/widgets/MapWidget';
import { t, appLabel, fieldLabel, lookupLabel, dateFnsLocale, dateFormat } from '@/i18n';
import { format, parseISO } from 'date-fns';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), dateFormat(), { locale: dateFnsLocale() }); } catch { return d; }
}

interface VeranstaltungenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Veranstaltungen | null;
  onEdit: (record: Veranstaltungen) => void;
  veranstalterList: Veranstalter[];
}

export function VeranstaltungenViewDialog({ open, onClose, record, onEdit, veranstalterList }: VeranstaltungenViewDialogProps) {
  const [showCoords, setShowCoords] = useState(false);

  function getVeranstalterDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return veranstalterList.find(r => r.record_id === id)?.fields.organisation_name ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('veranstaltungen') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'veranstalter')}</Label>
            <p className="text-sm">{getVeranstalterDisplayName(record.fields.veranstalter)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'titel')}</Label>
            <p className="text-sm">{record.fields.titel ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'beschreibung_veranstaltung')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.beschreibung_veranstaltung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'kategorie')}</Label>
            <Badge variant="secondary">{lookupLabel('veranstaltungen', 'kategorie', record.fields.kategorie?.key) ?? record.fields.kategorie?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'beginn')}</Label>
            <p className="text-sm">{formatDate(record.fields.beginn)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'ende')}</Label>
            <p className="text-sm">{formatDate(record.fields.ende)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'anmeldefrist')}</Label>
            <p className="text-sm">{formatDate(record.fields.anmeldefrist)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'veranstaltungsort_name')}</Label>
            <p className="text-sm">{record.fields.veranstaltungsort_name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'veranstaltungsort_strasse')}</Label>
            <p className="text-sm">{record.fields.veranstaltungsort_strasse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'veranstaltungsort_hausnummer')}</Label>
            <p className="text-sm">{record.fields.veranstaltungsort_hausnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'veranstaltungsort_plz')}</Label>
            <p className="text-sm">{record.fields.veranstaltungsort_plz ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'veranstaltungsort_ort')}</Label>
            <p className="text-sm">{record.fields.veranstaltungsort_ort ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'veranstaltungsort_geo')}</Label>
            {record.fields.veranstaltungsort_geo?.info && (
              <p className="text-sm text-muted-foreground break-words whitespace-normal">{record.fields.veranstaltungsort_geo.info}</p>
            )}
            {record.fields.veranstaltungsort_geo?.lat != null && record.fields.veranstaltungsort_geo?.long != null && (
              <GeoMapPicker
                lat={record.fields.veranstaltungsort_geo.lat}
                lng={record.fields.veranstaltungsort_geo.long}
                readOnly
              />
            )}
            {record.fields.veranstaltungsort_geo?.lat != null && record.fields.veranstaltungsort_geo?.long != null && (
              <MapRouteLinks lat={record.fields.veranstaltungsort_geo.lat} long={record.fields.veranstaltungsort_geo.long} className="mt-1" />
            )}
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1 max-sm:py-2 transition-colors" onClick={() => setShowCoords(v => !v)}>
              {showCoords ? t('fr_hide_coords') : t('fr_show_coords')}
              <IconChevronDown className={`h-3 w-3 transition-transform ${showCoords ? "rotate-180" : ""}`} />
            </button>
            {showCoords && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-xs text-muted-foreground">{t('fr_lat')}:</span> {record.fields.veranstaltungsort_geo?.lat?.toFixed(6) ?? '—'}</div>
                <div><span className="text-xs text-muted-foreground">{t('fr_long')}:</span> {record.fields.veranstaltungsort_geo?.long?.toFixed(6) ?? '—'}</div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'max_teilnehmer')}</Label>
            <p className="text-sm">{record.fields.max_teilnehmer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'kosten')}</Label>
            <p className="text-sm">{record.fields.kosten ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('veranstaltungen', 'flyer')}</Label>
            {record.fields.flyer ? (
              <MediaThumbnail src={record.fields.flyer} fit="contain" className="w-full rounded-lg border" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.VERANSTALTUNGEN} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}