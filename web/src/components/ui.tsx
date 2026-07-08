'use client';

// Tiny presentational primitives shared across screens. No component library —
// just typed wrappers over the styles in globals.css.

import type { AppointmentStatus, SlotStatus } from '@/lib/types';
import { APPOINTMENT_STATUS_LABEL, SLOT_STATUS_LABEL } from '@/lib/format';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`status-badge appt-${status}`}>
      {APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}

export function SlotStatusBadge({ status }: { status: SlotStatus }) {
  return (
    <span className={`status-badge slot-${status}`}>
      {SLOT_STATUS_LABEL[status]}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading-block">
      <div className="spinner" aria-label={label} />
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="notice notice-error" role="alert">
      {message}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
