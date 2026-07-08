import { AuditEntry, Role } from '../domain/types';
import { genId, store } from '../db/store';

export interface AuditActor {
  id: string;
  role: Role;
}

// Append-only audit trail. Admins get full read access; every mutating action
// (login, booking, status change, note authored, slot/CRUD changes) records here.
export function audit(
  actor: AuditActor | null,
  action: string,
  target: string,
  detail?: string,
): void {
  const entry: AuditEntry = {
    id: genId('aud'),
    at: new Date().toISOString(),
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    action,
    target,
    detail,
  };
  store.audit.push(entry);
}

export function listAudit(limit = 200): AuditEntry[] {
  return store.audit.slice(-limit).reverse();
}
