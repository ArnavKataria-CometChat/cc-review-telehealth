'use client';

// Admin console — clinic CRUD and user provisioning (doctor / staff / patient /
// admin). Creating a doctor or patient provisions the role profile atomically
// on the backend. Admins never author clinical notes (enforced server-side).

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Guard } from '@/components/Guard';
import { PageHeader, ErrorNotice, Spinner, EmptyState, Field } from '@/components/ui';
import { api, ApiError, type CreateUserInput } from '@/lib/api';
import type { Clinic, PublicUser, Role } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/format';

function AdminInner() {
  return (
    <>
      <PageHeader
        title="Clinics & Users"
        subtitle="Manage clinics and provision accounts across the platform."
        actions={
          <Link className="btn btn-secondary" href="/admin/audit">
            View audit log
          </Link>
        }
      />
      <div className="grid grid-2">
        <ClinicsSection />
        <UsersSection />
      </div>
    </>
  );
}

// ------------------------------------------------------------------ clinics

function ClinicsSection() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.clinics();
      setClinics(res.clinics);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load clinics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.createClinic(name.trim(), address.trim());
      setName('');
      setAddress('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create clinic.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.deleteClinic(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete clinic.');
    }
  }

  return (
    <div className="card stack" style={{ gap: 16 }}>
      <h2 style={{ fontSize: 18 }}>Clinics</h2>

      {error ? <ErrorNotice message={error} /> : null}

      {loading ? (
        <Spinner />
      ) : clinics.length === 0 ? (
        <EmptyState>No clinics yet.</EmptyState>
      ) : (
        <ul className="list-reset stack" style={{ gap: 8 }}>
          {clinics.map((c) => (
            <li
              key={c.id}
              className="row spread"
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <span>
                <strong>{c.name}</strong>
                <br />
                <span className="faint">{c.address}</span>
              </span>
              <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="stack" style={{ gap: 4 }}>
        <hr className="divider" />
        <h3 className="section-title">Add clinic</h3>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Address">
          <input value={address} onChange={(e) => setAddress(e.target.value)} required />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add clinic'}
        </button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ users

const CREATABLE_ROLES: Role[] = ['doctor', 'staff', 'patient', 'admin'];

function UsersSection() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminUsers(roleFilter || undefined);
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    api.clinics().then((res) => setClinics(res.clinics)).catch(() => setClinics([]));
  }, []);

  return (
    <div className="card stack" style={{ gap: 16 }}>
      <div className="row spread">
        <h2 style={{ fontSize: 18 }}>Users</h2>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | '')}
          style={{ width: 150 }}
        >
          <option value="">All roles</option>
          {CREATABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      {error ? <ErrorNotice message={error} /> : null}

      {loading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState>No users match.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="mono">{u.email}</td>
                  <td>
                    <span className={`role-pill role-${u.role}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewUserForm clinics={clinics} onCreated={loadUsers} />
    </div>
  );
}

function NewUserForm({
  clinics,
  onCreated,
}: {
  clinics: Clinic[];
  onCreated: () => void;
}) {
  const [role, setRole] = useState<Role>('doctor');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [mrn, setMrn] = useState('');
  const [dob, setDob] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!name.trim() || !email.trim() || password.length < 6) return false;
    if (role === 'doctor') return !!specialty.trim() && !!clinicId;
    if (role === 'patient') return !!mrn.trim() && !!dob;
    return true;
  }, [role, name, email, password, specialty, clinicId, mrn, dob]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setErr(null);
    setOk(null);

    let input: CreateUserInput;
    const base = { name: name.trim(), email: email.trim(), password };
    if (role === 'doctor') {
      input = { role, ...base, specialty: specialty.trim(), clinicId };
    } else if (role === 'patient') {
      input = { role, ...base, mrn: mrn.trim(), dob };
    } else {
      input = { role, ...base };
    }

    try {
      const res = await api.createUser(input);
      setOk(`Created ${res.user.name} (${ROLE_LABEL[res.user.role]}).`);
      setName('');
      setEmail('');
      setPassword('');
      setSpecialty('');
      setMrn('');
      setDob('');
      onCreated();
    } catch (error) {
      setErr(error instanceof ApiError ? error.message : 'Could not create user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 4 }}>
      <hr className="divider" />
      <h3 className="section-title">Provision user</h3>

      <Field label="Role">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {CREATABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>

      <div className="form-row">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Password" hint="At least 6 characters.">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>

      {role === 'doctor' ? (
        <div className="form-row">
          <Field label="Specialty">
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. Cardiology"
            />
          </Field>
          <Field label="Clinic">
            <select value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
              <option value="">Select clinic…</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {role === 'patient' ? (
        <div className="form-row">
          <Field label="MRN">
            <input value={mrn} onChange={(e) => setMrn(e.target.value)} placeholder="MRN-1003" />
          </Field>
          <Field label="Date of birth">
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
        </div>
      ) : null}

      {err ? <ErrorNotice message={err} /> : null}
      {ok ? <div className="notice notice-success">{ok}</div> : null}

      <button type="submit" className="btn btn-primary" disabled={saving || !canSubmit}>
        {saving ? 'Creating…' : 'Create user'}
      </button>
    </form>
  );
}

export default function AdminPage() {
  return (
    <Guard roles={['admin']}>
      <AdminInner />
    </Guard>
  );
}
