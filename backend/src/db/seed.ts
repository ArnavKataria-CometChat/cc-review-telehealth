import { config } from '../config';
import { hashPassword } from '../auth/password';
import {
  Appointment,
  Clinic,
  Doctor,
  Patient,
  Slot,
  User,
} from '../domain/types';
import { audit } from '../services/audit';
import { genId, resetStore, store } from './store';

// Deterministic-ish demo dataset so the app is usable the moment it boots.
// All accounts share SEED_PASSWORD (see README). This runs in-process at
// startup; there is no external database in the Phase A baseline.

function addUser(
  role: User['role'],
  name: string,
  email: string,
): User {
  const user: User = {
    id: genId('user'),
    role,
    name,
    email,
    passwordHash: hashPassword(config.seedPassword),
  };
  store.users.set(user.id, user);
  return user;
}

function isoIn(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
}

export function seed(): {
  accounts: { role: string; email: string }[];
} {
  resetStore();

  // Clinics
  const downtown: Clinic = {
    id: genId('clinic'),
    name: 'Downtown Care Clinic',
    address: '100 Main St, Springfield',
  };
  const riverside: Clinic = {
    id: genId('clinic'),
    name: 'Riverside Health',
    address: '42 River Rd, Springfield',
  };
  store.clinics.set(downtown.id, downtown);
  store.clinics.set(riverside.id, riverside);

  // Admin & staff
  const admin = addUser('admin', 'Ada Admin', 'admin@telehealth.test');
  const staff = addUser('staff', 'Sam Staff', 'staff@telehealth.test');

  // Doctors (user + doctor profile)
  const drHouseUser = addUser('doctor', 'Dr. Gregory House', 'house@telehealth.test');
  const drGreyUser = addUser('doctor', 'Dr. Meredith Grey', 'grey@telehealth.test');
  const drHouse: Doctor = {
    userId: drHouseUser.id,
    specialty: 'Diagnostics',
    clinicId: downtown.id,
  };
  const drGrey: Doctor = {
    userId: drGreyUser.id,
    specialty: 'General Surgery',
    clinicId: riverside.id,
  };
  store.doctors.set(drHouse.userId, drHouse);
  store.doctors.set(drGrey.userId, drGrey);

  // Patients (user + patient profile)
  const patAUser = addUser('patient', 'Pat Patient', 'patient@telehealth.test');
  const patBUser = addUser('patient', 'Robin Rivers', 'robin@telehealth.test');
  const patA: Patient = { userId: patAUser.id, mrn: 'MRN-1001', dob: '1990-05-14' };
  const patB: Patient = { userId: patBUser.id, mrn: 'MRN-1002', dob: '1985-11-02' };
  store.patients.set(patA.userId, patA);
  store.patients.set(patB.userId, patB);

  // Slots
  const mkSlot = (doctorId: string, hours: number): Slot => {
    const slot: Slot = {
      id: genId('slot'),
      doctorId,
      startsAt: isoIn(hours),
      durationMin: 30,
      status: 'open',
    };
    store.slots.set(slot.id, slot);
    return slot;
  };
  const houseSlot1 = mkSlot(drHouse.userId, 24);
  mkSlot(drHouse.userId, 26);
  mkSlot(drGrey.userId, 48);
  mkSlot(drGrey.userId, 50);

  // One pre-booked appointment so the doctor/patient views aren't empty.
  const now = new Date().toISOString();
  houseSlot1.status = 'booked';
  store.slots.set(houseSlot1.id, houseSlot1);
  const appt: Appointment = {
    id: genId('appt'),
    patientId: patA.userId,
    doctorId: drHouse.userId,
    slotId: houseSlot1.id,
    status: 'scheduled',
    reason: 'Persistent headaches, follow-up',
    createdAt: now,
    updatedAt: now,
  };
  store.appointments.set(appt.id, appt);

  audit(null, 'system.seed', 'store', 'seeded demo dataset');

  return {
    accounts: [
      { role: 'admin', email: admin.email },
      { role: 'staff', email: staff.email },
      { role: 'doctor', email: drHouseUser.email },
      { role: 'doctor', email: drGreyUser.email },
      { role: 'patient', email: patAUser.email },
      { role: 'patient', email: patBUser.email },
    ],
  };
}

// Allow `npm run seed` to preview the dataset.
if (require.main === module) {
  const { accounts } = seed();
  // eslint-disable-next-line no-console
  console.log('Seeded accounts (password = SEED_PASSWORD):');
  // eslint-disable-next-line no-console
  console.table(accounts);
}
