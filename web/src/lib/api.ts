// Typed client for the telehealth backend REST API.
//
// A single `request()` helper attaches the Bearer session token, normalises the
// backend's `{ error: { code, message } }` envelope into a thrown `ApiError`,
// and surfaces 401s so the auth layer can log the user out.

import type {
  AppointmentStatus,
  AppointmentView,
  AuditEntry,
  Clinic,
  DoctorView,
  MeResponse,
  NoteView,
  PublicUser,
  Role,
  SlotView,
} from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

// The client keeps the active token in module scope so every request picks it
// up without threading it through each call. The auth context owns its value.
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = opts;

  const url = new URL(`${API_BASE_URL}/api${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (err) {
    throw new ApiError(
      0,
      'Cannot reach the backend API. Is the server running?',
      'network_error',
      err,
    );
  }

  if (res.status === 401) {
    onUnauthorized?.();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const envelope = payload?.error ?? {};
    throw new ApiError(
      res.status,
      envelope.message ?? res.statusText ?? 'Request failed',
      envelope.code ?? 'error',
      envelope.details,
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers — one function per documented route.
// ---------------------------------------------------------------------------

export const api = {
  // --- auth / identity ---
  login(email: string, password: string) {
    return request<{ token: string; user: PublicUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },
  me() {
    return request<MeResponse>('/users/me');
  },

  // --- doctors & slots ---
  doctors(filters?: { specialty?: string; clinicId?: string }) {
    return request<{ doctors: DoctorView[] }>('/doctors', { query: filters });
  },
  doctorSlots(doctorId: string, status?: 'open' | 'booked') {
    return request<{ doctorId: string; slots: SlotView[] }>(
      `/doctors/${doctorId}/slots`,
      { query: { status } },
    );
  },
  createSlot(doctorId: string, startsAt: string, durationMin: number) {
    return request<{ slot: SlotView }>(`/doctors/${doctorId}/slots`, {
      method: 'POST',
      body: { startsAt, durationMin },
    });
  },
  setSlotStatus(slotId: string, status: 'open' | 'booked') {
    return request<{ slot: SlotView }>(`/slots/${slotId}`, {
      method: 'PATCH',
      body: { status },
    });
  },

  // --- appointments ---
  appointments(status?: AppointmentStatus) {
    return request<{ appointments: AppointmentView[] }>('/appointments', {
      query: { status },
    });
  },
  appointment(id: string) {
    return request<{ appointment: AppointmentView }>(`/appointments/${id}`);
  },
  bookAppointment(input: { doctorId: string; slotId: string; reason: string }) {
    return request<{ appointment: AppointmentView }>('/appointments', {
      method: 'POST',
      body: input,
    });
  },
  patchAppointment(
    id: string,
    body: {
      status?: AppointmentStatus;
      doctorId?: string;
      slotId?: string;
      reason?: string;
    },
  ) {
    return request<{ appointment: AppointmentView }>(`/appointments/${id}`, {
      method: 'PATCH',
      body,
    });
  },
  appointmentNotes(id: string) {
    return request<{ notes: NoteView[] }>(`/appointments/${id}/notes`);
  },
  addNote(id: string, body: string) {
    return request<{ note: NoteView }>(`/appointments/${id}/notes`, {
      method: 'POST',
      body: { body },
    });
  },

  // --- clinics (admin) ---
  clinics() {
    return request<{ clinics: Clinic[] }>('/clinics');
  },
  createClinic(name: string, address: string) {
    return request<{ clinic: Clinic }>('/clinics', {
      method: 'POST',
      body: { name, address },
    });
  },
  updateClinic(id: string, data: { name?: string; address?: string }) {
    return request<{ clinic: Clinic }>(`/clinics/${id}`, {
      method: 'PATCH',
      body: data,
    });
  },
  deleteClinic(id: string) {
    return request<void>(`/clinics/${id}`, { method: 'DELETE' });
  },

  // --- admin: users & audit ---
  adminUsers(role?: Role) {
    return request<{ users: PublicUser[] }>('/admin/users', { query: { role } });
  },
  createUser(input: CreateUserInput) {
    return request<{ user: PublicUser; profile: DoctorView | null }>(
      '/admin/users',
      { method: 'POST', body: input },
    );
  },
  audit(limit = 200) {
    return request<{ entries: AuditEntry[] }>('/admin/audit', {
      query: { limit: String(limit) },
    });
  },
};

export type CreateUserInput =
  | { role: 'doctor'; name: string; email: string; password: string; specialty: string; clinicId: string }
  | { role: 'staff'; name: string; email: string; password: string }
  | { role: 'patient'; name: string; email: string; password: string; mrn: string; dob: string }
  | { role: 'admin'; name: string; email: string; password: string };
