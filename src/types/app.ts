// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
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
  createdat: string;
  updatedat: string | null;
  fields: {
    veranstalter?: string; // applookup -> URL zu 'Veranstalter' Record
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

export interface Anmeldungen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    veranstaltung?: string; // applookup -> URL zu 'Veranstaltungen' Record
    vorname?: string;
    nachname?: string;
    email_anmeldung?: string;
    telefon_anmeldung?: string;
    anzahl_personen?: number;
    anmerkungen?: string;
    email_benachrichtigung?: boolean;
  };
}

export interface Veranstalter {
  record_id: string;
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

export const APP_IDS = {
  VERANSTALTUNGEN: '6a315b225049324bae74cc15',
  ANMELDUNGEN: '6a315b23fe1f8743a7f9aaff',
  VERANSTALTER: '6a315b1e3b0ba0a7a2d28905',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'veranstaltungen': {
    kategorie: [{ key: "gesundheit", label: "Gesundheit & Prävention" }, { key: "sport", label: "Sport & Bewegung" }, { key: "ernaehrung", label: "Ernährung" }, { key: "entspannung", label: "Entspannung & Achtsamkeit" }, { key: "beratung", label: "Beratung & Information" }, { key: "sonstiges", label: "Sonstiges" }],
  },
  'veranstalter': {
    organisation_typ: [{ key: "verein", label: "Verein" }, { key: "kommune", label: "Kommune" }, { key: "sonstige", label: "Sonstige Organisation" }],
  },
};

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
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateVeranstaltungen = StripLookup<Veranstaltungen['fields']>;
export type CreateAnmeldungen = StripLookup<Anmeldungen['fields']>;
export type CreateVeranstalter = StripLookup<Veranstalter['fields']>;