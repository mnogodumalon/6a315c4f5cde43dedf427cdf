import type { Anmeldungen, Veranstaltungen } from './app';

export type EnrichedVeranstaltungen = Veranstaltungen & {
  veranstalterName: string;
};

export type EnrichedAnmeldungen = Anmeldungen & {
  veranstaltungName: string;
};
