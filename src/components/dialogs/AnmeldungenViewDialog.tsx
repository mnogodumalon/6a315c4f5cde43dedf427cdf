import type { Anmeldungen, Veranstaltungen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_IDS } from '@/types/app';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { IconPencil } from '@tabler/icons-react';
import { t, appLabel, fieldLabel, lookupLabel } from '@/i18n';

interface AnmeldungenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Anmeldungen | null;
  onEdit: (record: Anmeldungen) => void;
  veranstaltungenList: Veranstaltungen[];
}

export function AnmeldungenViewDialog({ open, onClose, record, onEdit, veranstaltungenList }: AnmeldungenViewDialogProps) {
  function getVeranstaltungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return veranstaltungenList.find(r => r.record_id === id)?.fields.titel ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('view_entity', { entity: appLabel('anmeldungen') })}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            {t('edit_button')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('anmeldungen', 'veranstaltung')}</Label>
            <p className="text-sm">{getVeranstaltungenDisplayName(record.fields.veranstaltung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('anmeldungen', 'vorname')}</Label>
            <p className="text-sm">{record.fields.vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('anmeldungen', 'nachname')}</Label>
            <p className="text-sm">{record.fields.nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('anmeldungen', 'email_anmeldung')}</Label>
            <p className="text-sm">{record.fields.email_anmeldung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('anmeldungen', 'telefon_anmeldung')}</Label>
            <p className="text-sm">{record.fields.telefon_anmeldung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('anmeldungen', 'anzahl_personen')}</Label>
            <p className="text-sm">{record.fields.anzahl_personen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('anmeldungen', 'anmerkungen')}</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.anmerkungen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{fieldLabel('anmeldungen', 'email_benachrichtigung')}</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.email_benachrichtigung ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.email_benachrichtigung ? t('yes') : t('no')}
            </span>
          </div>
          <div className="pt-2 border-t border-border">
            <AttachmentsSection appId={APP_IDS.ANMELDUNGEN} recordId={record.record_id} readOnly />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}