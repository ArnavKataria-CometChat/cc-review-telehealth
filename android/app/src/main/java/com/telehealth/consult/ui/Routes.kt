package com.telehealth.consult.ui

/** Central route table. Detail routes take path args. */
object Routes {
    // patient
    const val PATIENT_DOCTORS = "patient/doctors"
    const val PATIENT_APPOINTMENTS = "patient/appointments"
    const val BOOK = "patient/book/{doctorId}"
    fun book(doctorId: String) = "patient/book/$doctorId"

    // doctor
    const val DOCTOR_SCHEDULE = "doctor/schedule"

    // staff
    const val STAFF_APPOINTMENTS = "staff/appointments"
    const val STAFF_SLOTS = "staff/slots"

    // admin
    const val ADMIN_CLINICS = "admin/clinics"
    const val ADMIN_USERS = "admin/users"
    const val ADMIN_AUDIT = "admin/audit"

    // shared
    const val APPOINTMENT_DETAIL = "appointment/{appointmentId}"
    fun appointment(id: String) = "appointment/$id"

    // Phase B: 1:1 secure chat + video/voice for an appointment (patient ↔ doctor).
    const val CONSULT_CHAT = "consult/{appointmentId}"
    fun consult(id: String) = "consult/$id"

    const val ARG_DOCTOR_ID = "doctorId"
    const val ARG_APPOINTMENT_ID = "appointmentId"
}
