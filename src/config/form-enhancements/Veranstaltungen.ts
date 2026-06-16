import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'veranstalter',
    'titel',
    'beschreibung_veranstaltung',
    'kategorie',
    { row: ['beginn', 'ende'] },
    'anmeldefrist',
    'veranstaltungsort_name',
    { row: ['veranstaltungsort_strasse', 'veranstaltungsort_hausnummer'], cols: '2fr 1fr' },
    { row: ['veranstaltungsort_plz', 'veranstaltungsort_ort'], cols: '1fr 2fr' },
    'max_teilnehmer',
    'kosten',
  ],
  defaults: {
    'beginn': { kind: 'today', withTime: true },
    'ende': { kind: 'todayOffset', days: 1, withTime: true },
    'anmeldefrist': { kind: 'today' },
  },
  computed: {
    '_veranstaltung_dauer_minuten': { op: 'mul', left: { kind: 'dateDiff', from: 'beginn', to: 'ende', unit: 'hours' }, right: { kind: 'literal', value: 60 } },
  },
};

// Build-time-populated field dependencies for MODUS-2 arrow functions in
// `computed`. The sub-agent leaves this empty; scripts/parse-formulas.mjs
// fills it after Step 0 by regex-extracting ctx.* calls from each function
// body. The dialog feeds these into classifyComputed so MODUS-2 entries get
// inline anchors instead of always landing in the aggregate section.
export const computedDeps: Record<string, string[]> = {};

// Build-time-populated applookup (ownKey → lookupKey) pairs found in MODUS-2
// arrow functions. Filled by scripts/parse-formulas.mjs from regex matches
// on `ctx.applookup('x','y')` and `ctx.applookupAny('x','y')`. The dialog
// merges this with MODUS-1 refs extracted at render time, so every numeric
// field the formula pulls from a selected lookup is surfaced as an inline
// hint next to the lookup combobox.
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
