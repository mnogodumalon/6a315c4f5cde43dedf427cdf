import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Veranstaltungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    veranstalter?: RecordUrl; // applookup -> URL zu 'Veranstalter' Record
    titel?: string;
    beschreibung_veranstaltung?: string;
    kategorie?: LookupValue;
    beginn?: string; // Format: YYYY-MM-DD oder ISO String
    ende?: string; // Format: YYYY-MM-DD oder ISO String
    anmeldefrist?: string; // Format: YYYY-MM-DD oder ISO String
    veranstaltungsort_name?: string;
    veranstaltungsort_strasse?: string;
    veranstaltungsort_hausnummer?: string;
    veranstaltungsort_plz?: string;
    veranstaltungsort_ort?: string;
    veranstaltungsort_geo?: GeoLocation; // { lat, long, info }
    max_teilnehmer?: number;
    kosten?: string;
    flyer?: string;
  };
}

export interface Veranstalter {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    organisation_name?: string;
    organisation_typ?: LookupValue;
    ansprechpartner_vorname?: string;
    ansprechpartner_nachname?: string;
    email?: string;
    telefon?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    website?: string;
    beschreibung?: string;
  };
}

export interface Anmeldungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    veranstaltung?: RecordUrl; // applookup -> URL zu 'Veranstaltungen' Record
    vorname?: string;
    nachname?: string;
    email_anmeldung?: string;
    telefon_anmeldung?: string;
    anzahl_personen?: number;
    anmerkungen?: string;
    email_benachrichtigung?: boolean;
  };
}

export const APP_IDS = {
  VERANSTALTUNGEN: '6a315b225049324bae74cc15',
  VERANSTALTER: '6a315b1e3b0ba0a7a2d28905',
  ANMELDUNGEN: '6a315b23fe1f8743a7f9aaff',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'veranstaltungen': {
    kategorie: [{ key: "gesundheit", get label() { return lookupLabel('veranstaltungen', 'kategorie', "gesundheit") ?? "Gesundheit & Prävention"; } }, { key: "sport", get label() { return lookupLabel('veranstaltungen', 'kategorie', "sport") ?? "Sport & Bewegung"; } }, { key: "ernaehrung", get label() { return lookupLabel('veranstaltungen', 'kategorie', "ernaehrung") ?? "Ernährung"; } }, { key: "entspannung", get label() { return lookupLabel('veranstaltungen', 'kategorie', "entspannung") ?? "Entspannung & Achtsamkeit"; } }, { key: "beratung", get label() { return lookupLabel('veranstaltungen', 'kategorie', "beratung") ?? "Beratung & Information"; } }, { key: "sonstiges", get label() { return lookupLabel('veranstaltungen', 'kategorie', "sonstiges") ?? "Sonstiges"; } }],
  },
  'veranstalter': {
    organisation_typ: [{ key: "kommune", get label() { return lookupLabel('veranstalter', 'organisation_typ', "kommune") ?? "Kommune"; } }, { key: "verein", get label() { return lookupLabel('veranstalter', 'organisation_typ', "verein") ?? "Verein"; } }, { key: "sonstige", get label() { return lookupLabel('veranstalter', 'organisation_typ', "sonstige") ?? "Sonstige Organisation"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'veranstaltungen': {
    'veranstalter': 'applookup/select',
    'titel': 'string/text',
    'beschreibung_veranstaltung': 'string/textarea',
    'kategorie': 'lookup/select',
    'beginn': 'date/datetimeminute',
    'ende': 'date/datetimeminute',
    'anmeldefrist': 'date/date',
    'veranstaltungsort_name': 'string/text',
    'veranstaltungsort_strasse': 'string/text',
    'veranstaltungsort_hausnummer': 'string/text',
    'veranstaltungsort_plz': 'string/text',
    'veranstaltungsort_ort': 'string/text',
    'veranstaltungsort_geo': 'geo',
    'max_teilnehmer': 'number',
    'kosten': 'string/text',
    'flyer': 'file',
  },
  'veranstalter': {
    'organisation_name': 'string/text',
    'organisation_typ': 'lookup/radio',
    'ansprechpartner_vorname': 'string/text',
    'ansprechpartner_nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'website': 'string/url',
    'beschreibung': 'string/textarea',
  },
  'anmeldungen': {
    'veranstaltung': 'applookup/select',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email_anmeldung': 'string/email',
    'telefon_anmeldung': 'string/tel',
    'anzahl_personen': 'number',
    'anmerkungen': 'string/textarea',
    'email_benachrichtigung': 'bool',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateVeranstaltungen = StripLookup<Veranstaltungen['fields']>;
export type CreateVeranstalter = StripLookup<Veranstalter['fields']>;
export type CreateAnmeldungen = StripLookup<Anmeldungen['fields']>;