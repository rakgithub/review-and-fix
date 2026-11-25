import type { ProblemCode } from './catalogue.ts';

// ISO 3166-1 alpha-2, all 249 assigned codes.
export const COUNTRY_CODES: ReadonlySet<string> = new Set(
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
  BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
  DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
  HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
  MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
  NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY
  QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
  TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
  VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/),
);

const ALIASES = new Map<string, string>([
  ['germany', 'DE'],
  ['deutschland', 'DE'],
  ['spain', 'ES'],
  ['españa', 'ES'],
  ['netherlands', 'NL'],
  ['the netherlands', 'NL'],
  ['nederland', 'NL'],
  ['poland', 'PL'],
  ['polska', 'PL'],
  ['italy', 'IT'],
  ['italia', 'IT'],
  // Same word in English and French.
  ['france', 'FR'],
  ['uk', 'GB'],
  ['united kingdom', 'GB'],
  ['usa', 'US'],
  ['u.s.', 'US'],
  ['united states', 'US'],
]);

export function suggestCountry(value: string): string | null {
  const key = value.trim().replace(/\s+/g, ' ').toLowerCase();
  const code = key.toUpperCase();
  if (COUNTRY_CODES.has(code)) return code;
  return ALIASES.get(key) ?? null;
}

export function checkCountry(value: string): ProblemCode | null {
  if (COUNTRY_CODES.has(value)) return null;
  return suggestCountry(value) ? 'country_not_code' : 'country_unknown';
}
