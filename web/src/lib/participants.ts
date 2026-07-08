// Helpers for the embedded patient/doctor on an appointment. The backend embeds
// the full view when the related record exists, otherwise just `{ userId }`.

import type { EmbeddedDoctor, EmbeddedPatient } from './types';

export function embeddedName(who: EmbeddedPatient | EmbeddedDoctor): string {
  if ('name' in who && who.name) return who.name;
  return 'Unknown';
}

export function embeddedId(who: EmbeddedPatient | EmbeddedDoctor): string {
  return who.userId;
}
