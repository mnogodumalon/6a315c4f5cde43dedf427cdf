import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichVeranstaltungen, enrichAnmeldungen } from '@/lib/enrich';
import type { EnrichedVeranstaltungen, EnrichedAnmeldungen } from '@/types/enriched';
import type { Veranstalter } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDateTime } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  RecordOverlay,
  RecordHeader,
  RecordKeyFacts,
  RecordSection,
  RecordField,
  RecordRelation,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { AnmeldungenDialog } from '@/components/dialogs/AnmeldungenDialog';
import { VeranstalterDialog } from '@/components/dialogs/VeranstalterDialog';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconPencil,
  IconTrash,
  IconCalendar,
  IconUsers,
  IconMapPin,
  IconClock,
  IconBuildingStore,
  IconList,
  IconSearch,
  IconX,
  IconTag,
  IconMoneybag,
  IconUserPlus,
  IconChevronDown,
  IconChevronUp,
  IconChevronRight,
  IconUsersGroup,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a315c4f5cde43dedf427cdf';
const REPAIR_ENDPOINT = '/claude/build/repair';

type TabView = 'upcoming' | 'all' | 'veranstalter';

const KATEGORIE_COLORS: Record<string, string> = {
  gesundheit: 'bg-emerald-100 text-emerald-700',
  sport: 'bg-blue-100 text-blue-700',
  ernaehrung: 'bg-orange-100 text-orange-700',
  entspannung: 'bg-violet-100 text-violet-700',
  beratung: 'bg-amber-100 text-amber-700',
  sonstiges: 'bg-gray-100 text-gray-600',
};

export default function DashboardOverview() {
  const {
    veranstalter, veranstaltungen, anmeldungen,
    veranstalterMap, veranstaltungenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedVeranstaltungen = enrichVeranstaltungen(veranstaltungen, { veranstalterMap });
  const enrichedAnmeldungen = enrichAnmeldungen(anmeldungen, { veranstaltungenMap });

  const [activeTab, setActiveTab] = useState<TabView>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategorien, setSelectedKategorien] = useState<string[]>([]);

  // Dialogs
  const [veranstaltungDialogOpen, setVeranstaltungDialogOpen] = useState(false);
  const [editingVeranstaltung, setEditingVeranstaltung] = useState<EnrichedVeranstaltungen | null>(null);
  const [deleteVeranstaltung, setDeleteVeranstaltung] = useState<EnrichedVeranstaltungen | null>(null);

  const [anmeldungDialogOpen, setAnmeldungDialogOpen] = useState(false);
  const [editingAnmeldung, setEditingAnmeldung] = useState<EnrichedAnmeldungen | null>(null);
  const [deleteAnmeldung, setDeleteAnmeldung] = useState<EnrichedAnmeldungen | null>(null);

  const [veranstalterDialogOpen, setVeranstalterDialogOpen] = useState(false);
  const [editingVeranstalter, setEditingVeranstalter] = useState<Veranstalter | null>(null);
  const [deleteVeranstalter, setDeleteVeranstalter] = useState<Veranstalter | null>(null);

  const [newAnmeldungForVeranstaltung, setNewAnmeldungForVeranstaltung] = useState<string | null>(null);
  const [expandedVeranstaltung, setExpandedVeranstaltung] = useState<string | null>(null);

  // RecordOverlay stacks
  const veranstaltungOverlay = useRecordOverlayStack<EnrichedVeranstaltungen>();
  const anmeldungOverlay = useRecordOverlayStack<EnrichedAnmeldungen>();
  const veranstalterOverlay = useRecordOverlayStack<Veranstalter>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingVeranstaltungen = useMemo(() =>
    enrichedVeranstaltungen
      .filter(v => {
        if (!v.fields.beginn) return true;
        return new Date(v.fields.beginn) >= today;
      })
      .sort((a, b) => (a.fields.beginn ?? '').localeCompare(b.fields.beginn ?? '')),
    [enrichedVeranstaltungen]
  );

  const filteredVeranstaltungen = useMemo(() => {
    let list = activeTab === 'upcoming' ? upcomingVeranstaltungen : enrichedVeranstaltungen;
    if (selectedKategorien.length > 0) {
      list = list.filter(v => selectedKategorien.includes(v.fields.kategorie?.key ?? ''));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v =>
        (v.fields.titel ?? '').toLowerCase().includes(q) ||
        (v.veranstalterName ?? '').toLowerCase().includes(q) ||
        (v.fields.veranstaltungsort_ort ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeTab, upcomingVeranstaltungen, enrichedVeranstaltungen, selectedKategorien, searchQuery]);

  const anmeldungenByVeranstaltung = useMemo(() => {
    const m = new Map<string, EnrichedAnmeldungen[]>();
    enrichedAnmeldungen.forEach(a => {
      const id = extractRecordId(a.fields.veranstaltung);
      if (!id) return;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(a);
    });
    return m;
  }, [enrichedAnmeldungen]);

  // Handlers
  const handleCreateVeranstaltung = async (fields: Veranstaltungen['fields']) => {
    await LivingAppsService.createVeranstaltungenEntry(fields);
    fetchAll();
  };

  const handleUpdateVeranstaltung = async (fields: Veranstaltungen['fields']) => {
    if (!editingVeranstaltung) return;
    await LivingAppsService.updateVeranstaltungenEntry(editingVeranstaltung.record_id, fields);
    fetchAll();
  };

  const handleDeleteVeranstaltung = async () => {
    if (!deleteVeranstaltung) return;
    await LivingAppsService.deleteVeranstaltungenEntry(deleteVeranstaltung.record_id);
    setDeleteVeranstaltung(null);
    fetchAll();
  };

  const handleCreateAnmeldung = async (fields: Anmeldungen['fields']) => {
    await LivingAppsService.createAnmeldungenEntry(fields);
    fetchAll();
  };

  const handleUpdateAnmeldung = async (fields: Anmeldungen['fields']) => {
    if (!editingAnmeldung) return;
    await LivingAppsService.updateAnmeldungenEntry(editingAnmeldung.record_id, fields);
    fetchAll();
  };

  const handleDeleteAnmeldung = async () => {
    if (!deleteAnmeldung) return;
    await LivingAppsService.deleteAnmeldungenEntry(deleteAnmeldung.record_id);
    setDeleteAnmeldung(null);
    fetchAll();
  };

  const handleCreateVeranstalter = async (fields: Veranstalter['fields']) => {
    await LivingAppsService.createVeranstalterEntry(fields);
    fetchAll();
  };

  const handleUpdateVeranstalter = async (fields: Veranstalter['fields']) => {
    if (!editingVeranstalter) return;
    await LivingAppsService.updateVeranstalterEntry(editingVeranstalter.record_id, fields);
    fetchAll();
  };

  const handleDeleteVeranstalter = async () => {
    if (!deleteVeranstalter) return;
    await LivingAppsService.deleteVeranstalterEntry(deleteVeranstalter.record_id);
    setDeleteVeranstalter(null);
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Workflow-Navigation */}
      <div>
        <a
          href="#/intents/gruppen-anmeldung"
          className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconUsersGroup size={20} className="text-primary" stroke={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">Gruppen-Anmeldung</p>
            <p className="text-sm text-muted-foreground truncate">Mehrere Personen gleichzeitig für eine Veranstaltung anmelden</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
      </div>
      {/* Haupt-Tabs */}
      <div className="flex flex-wrap gap-2 items-center border-b border-border pb-0">
        {(['upcoming', 'all', 'veranstalter'] as TabView[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'upcoming' ? 'Bevorstehende' : tab === 'all' ? 'Alle Veranstaltungen' : 'Veranstalter'}
          </button>
        ))}
      </div>

      {activeTab !== 'veranstalter' ? (
        <div className="space-y-4">
          {/* Such- und Filterzeile */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Veranstaltung suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <IconX size={14} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedKategorien([])}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                  selectedKategorien.length === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Alle
              </button>
              {LOOKUP_OPTIONS.veranstaltungen?.kategorie?.map(opt => (
                <button
                  key={opt.key}
                  onClick={() =>
                    setSelectedKategorien(prev =>
                      prev.includes(opt.key)
                        ? prev.filter(k => k !== opt.key)
                        : [...prev, opt.key]
                    )
                  }
                  className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                    selectedKategorien.includes(opt.key)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => { setEditingVeranstaltung(null); setVeranstaltungDialogOpen(true); }} className="shrink-0">
              <IconPlus size={16} className="shrink-0" />
              <span className="hidden sm:inline ml-1">Neue Veranstaltung</span>
            </Button>
          </div>

          {/* Veranstaltungs-Liste */}
          {filteredVeranstaltungen.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <IconCalendar size={48} className="text-muted-foreground/40" stroke={1.5} />
              <p className="text-muted-foreground text-sm">Keine Veranstaltungen gefunden</p>
              <Button size="sm" variant="outline" onClick={() => { setEditingVeranstaltung(null); setVeranstaltungDialogOpen(true); }}>
                <IconPlus size={14} className="mr-1" /> Veranstaltung anlegen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVeranstaltungen.map(v => {
                const veranstAnmeldungen = anmeldungenByVeranstaltung.get(v.record_id) ?? [];
                const totalPersonen = veranstAnmeldungen.reduce((s, a) => s + (a.fields.anzahl_personen ?? 1), 0);
                const auslastung = v.fields.max_teilnehmer
                  ? Math.min(100, Math.round((totalPersonen / v.fields.max_teilnehmer) * 100))
                  : null;
                const katKey = v.fields.kategorie?.key ?? 'sonstiges';
                const katColor = KATEGORIE_COLORS[katKey] ?? KATEGORIE_COLORS.sonstiges;
                const isExpanded = expandedVeranstaltung === v.record_id;
                const isVergangen = v.fields.beginn ? new Date(v.fields.beginn) < today : false;

                return (
                  <div
                    key={v.record_id}
                    className={`bg-card border border-border rounded-2xl overflow-hidden transition-all ${isVergangen ? 'opacity-60' : ''}`}
                  >
                    {/* Karten-Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                      onClick={() => veranstaltungOverlay.replace(v)}
                    >
                      <div className="flex gap-3 items-start">
                        {/* Flyer-Bild oder Farb-Akzent */}
                        {v.fields.flyer ? (
                          <img
                            src={v.fields.flyer}
                            alt={v.fields.titel}
                            className="w-16 h-16 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 ${katColor}`}>
                            <IconCalendar size={24} stroke={1.5} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-2 items-start justify-between">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{v.fields.titel ?? '(kein Titel)'}</h3>
                              <p className="text-sm text-muted-foreground truncate">{v.veranstalterName || 'Kein Veranstalter'}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="secondary" className={`text-xs ${katColor} border-0`}>
                                {v.fields.kategorie?.label ?? '—'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            {v.fields.beginn && (
                              <span className="flex items-center gap-1">
                                <IconClock size={12} className="shrink-0" />
                                {formatDateTime(v.fields.beginn)}
                              </span>
                            )}
                            {v.fields.veranstaltungsort_ort && (
                              <span className="flex items-center gap-1">
                                <IconMapPin size={12} className="shrink-0" />
                                {v.fields.veranstaltungsort_name
                                  ? `${v.fields.veranstaltungsort_name}, ${v.fields.veranstaltungsort_ort}`
                                  : v.fields.veranstaltungsort_ort}
                              </span>
                            )}
                            {v.fields.kosten && (
                              <span className="flex items-center gap-1">
                                <IconMoneybag size={12} className="shrink-0" />
                                {v.fields.kosten}
                              </span>
                            )}
                          </div>
                          {/* Auslastungsbalken */}
                          {auslastung !== null && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>{totalPersonen} / {v.fields.max_teilnehmer} Plätze</span>
                                <span>{auslastung}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    auslastung >= 90 ? 'bg-destructive' : auslastung >= 70 ? 'bg-amber-500' : 'bg-primary'
                                  }`}
                                  style={{ width: `${auslastung}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Aktionsleiste */}
                    <div className="px-4 pb-3 flex flex-wrap gap-2 items-center justify-between border-t border-border pt-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={e => {
                            e.stopPropagation();
                            setNewAnmeldungForVeranstaltung(v.record_id);
                            setEditingAnmeldung(null);
                            setAnmeldungDialogOpen(true);
                          }}
                          className="text-xs h-7 px-2"
                        >
                          <IconUserPlus size={13} className="shrink-0 mr-1" />
                          Anmeldung
                          {veranstAnmeldungen.length > 0 && (
                            <span className="ml-1 bg-primary/10 text-primary rounded-full px-1.5 py-0 text-[10px] font-medium">
                              {veranstAnmeldungen.length}
                            </span>
                          )}
                        </Button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setExpandedVeranstaltung(isExpanded ? null : v.record_id);
                          }}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                          <span>{veranstAnmeldungen.length} Anmeldung{veranstAnmeldungen.length !== 1 ? 'en' : ''}</span>
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingVeranstaltung(v);
                            setVeranstaltungDialogOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Bearbeiten"
                        >
                          <IconPencil size={14} />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setDeleteVeranstaltung(v);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Löschen"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Anmeldungen-Klappliste */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/30 px-4 py-3">
                        {veranstAnmeldungen.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">Noch keine Anmeldungen</p>
                        ) : (
                          <div className="space-y-2">
                            {veranstAnmeldungen.map(a => (
                              <div
                                key={a.record_id}
                                className="flex items-center justify-between gap-2 bg-background rounded-xl px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
                                onClick={() => anmeldungOverlay.replace(a)}
                              >
                                <div className="min-w-0">
                                  <span className="text-sm font-medium truncate block">
                                    {[a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || '(kein Name)'}
                                  </span>
                                  <span className="text-xs text-muted-foreground truncate block">
                                    {a.fields.email_anmeldung ?? ''}
                                    {a.fields.anzahl_personen && a.fields.anzahl_personen > 1
                                      ? ` · ${a.fields.anzahl_personen} Personen`
                                      : ''}
                                  </span>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      setEditingAnmeldung(a);
                                      setNewAnmeldungForVeranstaltung(null);
                                      setAnmeldungDialogOpen(true);
                                    }}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                  >
                                    <IconPencil size={13} />
                                  </button>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      setDeleteAnmeldung(a);
                                    }}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  >
                                    <IconTrash size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Veranstalter-Tab */
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-foreground">Veranstalter ({veranstalter.length})</h2>
            <Button size="sm" onClick={() => { setEditingVeranstalter(null); setVeranstalterDialogOpen(true); }}>
              <IconPlus size={16} className="shrink-0" />
              <span className="hidden sm:inline ml-1">Neuer Veranstalter</span>
            </Button>
          </div>
          {veranstalter.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <IconBuildingStore size={48} className="text-muted-foreground/40" stroke={1.5} />
              <p className="text-muted-foreground text-sm">Noch keine Veranstalter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {veranstalter.map(vs => {
                const vsVeranstaltungen = enrichedVeranstaltungen.filter(v => {
                  const id = extractRecordId(v.fields.veranstalter);
                  return id === vs.record_id;
                });
                return (
                  <div
                    key={vs.record_id}
                    className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => veranstalterOverlay.replace(vs)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{vs.fields.organisation_name ?? '(kein Name)'}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {vs.fields.organisation_typ?.label ?? '—'}
                        </p>
                        {vs.fields.ort && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <IconMapPin size={11} className="shrink-0" />
                            {vs.fields.ort}
                          </p>
                        )}
                        {(vs.fields.ansprechpartner_vorname || vs.fields.ansprechpartner_nachname) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {[vs.fields.ansprechpartner_vorname, vs.fields.ansprechpartner_nachname].filter(Boolean).join(' ')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                          {vsVeranstaltungen.length} Veranst.
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEditingVeranstalter(vs);
                              setVeranstalterDialogOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            <IconPencil size={13} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setDeleteVeranstalter(vs);
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <VeranstaltungenDialog
        open={veranstaltungDialogOpen}
        onClose={() => { setVeranstaltungDialogOpen(false); setEditingVeranstaltung(null); }}
        onSubmit={editingVeranstaltung ? handleUpdateVeranstaltung : handleCreateVeranstaltung}
        defaultValues={editingVeranstaltung?.fields}
        recordId={editingVeranstaltung?.record_id}
        veranstalterList={veranstalter}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
      />

      <AnmeldungenDialog
        open={anmeldungDialogOpen}
        onClose={() => { setAnmeldungDialogOpen(false); setEditingAnmeldung(null); setNewAnmeldungForVeranstaltung(null); }}
        onSubmit={editingAnmeldung ? handleUpdateAnmeldung : handleCreateAnmeldung}
        defaultValues={editingAnmeldung
          ? editingAnmeldung.fields
          : newAnmeldungForVeranstaltung
            ? { veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, newAnmeldungForVeranstaltung) }
            : undefined
        }
        recordId={editingAnmeldung?.record_id}
        veranstaltungenList={veranstaltungen}
        enablePhotoScan={AI_PHOTO_SCAN['Anmeldungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Anmeldungen']}
      />

      <VeranstalterDialog
        open={veranstalterDialogOpen}
        onClose={() => { setVeranstalterDialogOpen(false); setEditingVeranstalter(null); }}
        onSubmit={editingVeranstalter ? handleUpdateVeranstalter : handleCreateVeranstalter}
        defaultValues={editingVeranstalter?.fields}
        recordId={editingVeranstalter?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstalter']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstalter']}
      />

      <ConfirmDialog
        open={!!deleteVeranstaltung}
        title="Veranstaltung löschen"
        description={`„${deleteVeranstaltung?.fields.titel ?? ''}" wirklich löschen? Alle zugehörigen Anmeldungen bleiben erhalten.`}
        onConfirm={handleDeleteVeranstaltung}
        onClose={() => setDeleteVeranstaltung(null)}
      />

      <ConfirmDialog
        open={!!deleteAnmeldung}
        title="Anmeldung löschen"
        description={`Anmeldung von ${[deleteAnmeldung?.fields.vorname, deleteAnmeldung?.fields.nachname].filter(Boolean).join(' ')} wirklich löschen?`}
        onConfirm={handleDeleteAnmeldung}
        onClose={() => setDeleteAnmeldung(null)}
      />

      <ConfirmDialog
        open={!!deleteVeranstalter}
        title="Veranstalter löschen"
        description={`„${deleteVeranstalter?.fields.organisation_name ?? ''}" wirklich löschen?`}
        onConfirm={handleDeleteVeranstalter}
        onClose={() => setDeleteVeranstalter(null)}
      />

      {/* RecordOverlay: Veranstaltung */}
      <RecordOverlay
        open={!!veranstaltungOverlay.current}
        onClose={veranstaltungOverlay.close}
        onEdit={() => {
          if (!veranstaltungOverlay.current) return;
          setEditingVeranstaltung(veranstaltungOverlay.current);
          setVeranstaltungDialogOpen(true);
        }}
        placement="side"
        size="lg"
        media={veranstaltungOverlay.current?.fields.flyer
          ? <MediaThumbnail src={veranstaltungOverlay.current.fields.flyer} alt={veranstaltungOverlay.current.fields.titel} className="w-full h-48 object-cover rounded-xl" />
          : undefined
        }
      >
        {veranstaltungOverlay.current && (() => {
          const v = veranstaltungOverlay.current;
          const veranstAnmeldungen = anmeldungenByVeranstaltung.get(v.record_id) ?? [];
          const totalPersonen = veranstAnmeldungen.reduce((s, a) => s + (a.fields.anzahl_personen ?? 1), 0);
          const katKey = v.fields.kategorie?.key ?? 'sonstiges';
          const katColor = KATEGORIE_COLORS[katKey] ?? KATEGORIE_COLORS.sonstiges;
          return (
            <>
              <RecordHeader
                title={v.fields.titel ?? '(kein Titel)'}
                subtitle={v.veranstalterName || undefined}
                badges={v.fields.kategorie ? [
                  <span key="kat" className={`text-xs px-2 py-0.5 rounded-full font-medium ${katColor}`}>
                    {v.fields.kategorie.label}
                  </span>
                ] : undefined}
              />
              <RecordKeyFacts items={[
                { label: 'Beginn', value: formatDateTime(v.fields.beginn) },
                { label: 'Anmeldungen', value: `${veranstAnmeldungen.length} (${totalPersonen} Personen)` },
                ...(v.fields.max_teilnehmer ? [{ label: 'Max. Plätze', value: String(v.fields.max_teilnehmer) }] : []),
                ...(v.fields.kosten ? [{ label: 'Kosten', value: v.fields.kosten }] : []),
              ]} />
              <RecordSection title="Zeitraum & Ort" cols={2}>
                <RecordField label="Beginn" value={v.fields.beginn} format="datetime" />
                <RecordField label="Ende" value={v.fields.ende} format="datetime" hideEmpty />
                <RecordField label="Anmeldefrist" value={v.fields.anmeldefrist} format="date" hideEmpty />
                <RecordField label="Veranstaltungsort" value={v.fields.veranstaltungsort_name} hideEmpty />
                <RecordField
                  label="Adresse"
                  value={[
                    v.fields.veranstaltungsort_strasse,
                    v.fields.veranstaltungsort_hausnummer,
                    v.fields.veranstaltungsort_plz,
                    v.fields.veranstaltungsort_ort,
                  ].filter(Boolean).join(' ') || undefined}
                  hideEmpty
                />
              </RecordSection>
              {v.fields.beschreibung_veranstaltung && (
                <RecordSection title="Beschreibung">
                  <RecordField label="Beschreibung" value={v.fields.beschreibung_veranstaltung} format="longtext" className="md:col-span-2" />
                </RecordSection>
              )}
              {veranstAnmeldungen.length > 0 && (
                <RecordSection title={`Anmeldungen (${veranstAnmeldungen.length})`} icon={IconUsers}>
                  {veranstAnmeldungen.map(a => (
                    <RecordRelation
                      key={a.record_id}
                      name={[a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || '(kein Name)'}
                      meta={[a.fields.email_anmeldung, a.fields.anzahl_personen ? `${a.fields.anzahl_personen} Pers.` : ''].filter(Boolean).join(' · ')}
                      icon={IconUsers}
                      onClick={() => anmeldungOverlay.replace(a)}
                    />
                  ))}
                </RecordSection>
              )}
              <RecordAttachments appId={APP_IDS.VERANSTALTUNGEN} recordId={v.record_id} />
            </>
          );
        })()}
      </RecordOverlay>

      {/* RecordOverlay: Anmeldung */}
      <RecordOverlay
        open={!!anmeldungOverlay.current}
        onClose={anmeldungOverlay.close}
        onEdit={() => {
          if (!anmeldungOverlay.current) return;
          setEditingAnmeldung(anmeldungOverlay.current);
          setNewAnmeldungForVeranstaltung(null);
          setAnmeldungDialogOpen(true);
        }}
        placement="side"
        size="md"
      >
        {anmeldungOverlay.current && (() => {
          const a = anmeldungOverlay.current;
          return (
            <>
              <RecordHeader
                title={[a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || '(kein Name)'}
                subtitle={a.veranstaltungName || undefined}
              />
              <RecordKeyFacts items={[
                { label: 'Veranstaltung', value: a.veranstaltungName || '—' },
                { label: 'Personen', value: String(a.fields.anzahl_personen ?? 1) },
              ]} />
              <RecordSection title="Kontakt" cols={2}>
                <RecordField label="Vorname" value={a.fields.vorname} hideEmpty />
                <RecordField label="Nachname" value={a.fields.nachname} hideEmpty />
                <RecordField label="E-Mail" value={a.fields.email_anmeldung} format="email" hideEmpty />
                <RecordField label="Telefon" value={a.fields.telefon_anmeldung} hideEmpty />
                <RecordField label="Anzahl Personen" value={a.fields.anzahl_personen != null ? String(a.fields.anzahl_personen) : undefined} hideEmpty />
                <RecordField label="E-Mail-Benachrichtigung" value={a.fields.email_benachrichtigung} format="bool" hideEmpty />
              </RecordSection>
              {a.fields.anmerkungen && (
                <RecordSection title="Anmerkungen">
                  <RecordField label="Anmerkungen" value={a.fields.anmerkungen} format="longtext" className="md:col-span-2" />
                </RecordSection>
              )}
              <RecordAttachments appId={APP_IDS.ANMELDUNGEN} recordId={a.record_id} />
            </>
          );
        })()}
      </RecordOverlay>

      {/* RecordOverlay: Veranstalter */}
      <RecordOverlay
        open={!!veranstalterOverlay.current}
        onClose={veranstalterOverlay.close}
        onEdit={() => {
          if (!veranstalterOverlay.current) return;
          setEditingVeranstalter(veranstalterOverlay.current);
          setVeranstalterDialogOpen(true);
        }}
        placement="side"
        size="md"
      >
        {veranstalterOverlay.current && (() => {
          const vs = veranstalterOverlay.current;
          const vsVeranstaltungen = enrichedVeranstaltungen.filter(v => {
            const id = extractRecordId(v.fields.veranstalter);
            return id === vs.record_id;
          });
          return (
            <>
              <RecordHeader
                title={vs.fields.organisation_name ?? '(kein Name)'}
                subtitle={vs.fields.organisation_typ?.label}
              />
              <RecordKeyFacts items={[
                { label: 'Veranstaltungen', value: String(vsVeranstaltungen.length) },
                ...(vs.fields.ort ? [{ label: 'Ort', value: vs.fields.ort }] : []),
              ]} />
              <RecordSection title="Kontakt" cols={2}>
                <RecordField label="Ansprechpartner" value={[vs.fields.ansprechpartner_vorname, vs.fields.ansprechpartner_nachname].filter(Boolean).join(' ') || undefined} hideEmpty />
                <RecordField label="E-Mail" value={vs.fields.email} format="email" hideEmpty />
                <RecordField label="Telefon" value={vs.fields.telefon} hideEmpty />
                <RecordField label="Website" value={vs.fields.website} format="url" hideEmpty />
              </RecordSection>
              <RecordSection title="Adresse" cols={2}>
                <RecordField label="Straße" value={[vs.fields.strasse, vs.fields.hausnummer].filter(Boolean).join(' ') || undefined} hideEmpty />
                <RecordField label="Ort" value={[vs.fields.plz, vs.fields.ort].filter(Boolean).join(' ') || undefined} hideEmpty />
              </RecordSection>
              {vs.fields.beschreibung && (
                <RecordSection title="Beschreibung">
                  <RecordField label="Beschreibung" value={vs.fields.beschreibung} format="longtext" className="md:col-span-2" />
                </RecordSection>
              )}
              {vsVeranstaltungen.length > 0 && (
                <RecordSection title="Veranstaltungen" icon={IconCalendar}>
                  {vsVeranstaltungen.map(v => (
                    <RecordRelation
                      key={v.record_id}
                      name={v.fields.titel ?? '(kein Titel)'}
                      meta={formatDateTime(v.fields.beginn)}
                      icon={IconCalendar}
                      onClick={() => veranstaltungOverlay.replace(v)}
                    />
                  ))}
                </RecordSection>
              )}
              <RecordAttachments appId={APP_IDS.VERANSTALTER} recordId={vs.record_id} />
            </>
          );
        })()}
      </RecordOverlay>
    </div>
  );
}

// ── Type aliases used in handler signatures ─────────────────────────────────
type Veranstaltungen = import('@/types/app').Veranstaltungen;
type Anmeldungen = import('@/types/app').Anmeldungen;

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-32 rounded-full" />)}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
