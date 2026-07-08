package com.telehealth.consult.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.telehealth.consult.data.model.PublicUser
import com.telehealth.consult.data.model.Role
import com.telehealth.consult.ui.admin.AdminAuditScreen
import com.telehealth.consult.ui.admin.AdminClinicsScreen
import com.telehealth.consult.ui.admin.AdminUsersScreen
import com.telehealth.consult.ui.appointment.AppointmentDetailScreen
import com.telehealth.consult.ui.doctor.DoctorScheduleScreen
import com.telehealth.consult.ui.patient.BookScreen
import com.telehealth.consult.ui.patient.BrowseDoctorsScreen
import com.telehealth.consult.ui.patient.PatientAppointmentsScreen
import com.telehealth.consult.ui.staff.StaffAppointmentsScreen
import com.telehealth.consult.ui.staff.StaffSlotsScreen

/**
 * Registers only the destinations the signed-in [user]'s role may reach — a
 * client-side complement to the server's RBAC. The shared appointment detail is
 * available to every role (the backend scopes what each may see/do there).
 */
@Composable
fun AppNavHost(
    navController: NavHostController,
    startRoute: String,
    user: PublicUser,
    modifier: Modifier = Modifier,
) {
    NavHost(navController = navController, startDestination = startRoute, modifier = modifier) {
        when (user.role) {
            Role.PATIENT -> {
                composable(Routes.PATIENT_DOCTORS) {
                    BrowseDoctorsScreen(
                        onBook = { doctorId -> navController.navigate(Routes.book(doctorId)) },
                    )
                }
                composable(Routes.PATIENT_APPOINTMENTS) {
                    PatientAppointmentsScreen(
                        onOpen = { id -> navController.navigate(Routes.appointment(id)) },
                    )
                }
                composable(
                    Routes.BOOK,
                    arguments = listOf(navArgument(Routes.ARG_DOCTOR_ID) { type = NavType.StringType }),
                ) { entry ->
                    BookScreen(
                        doctorId = entry.arguments?.getString(Routes.ARG_DOCTOR_ID).orEmpty(),
                        onBooked = { id ->
                            navController.navigate(Routes.appointment(id)) {
                                popUpTo(Routes.PATIENT_DOCTORS)
                            }
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
            }

            Role.DOCTOR -> {
                composable(Routes.DOCTOR_SCHEDULE) {
                    DoctorScheduleScreen(
                        onOpen = { id -> navController.navigate(Routes.appointment(id)) },
                    )
                }
            }

            Role.STAFF -> {
                composable(Routes.STAFF_APPOINTMENTS) {
                    StaffAppointmentsScreen(
                        onOpen = { id -> navController.navigate(Routes.appointment(id)) },
                    )
                }
                composable(Routes.STAFF_SLOTS) { StaffSlotsScreen() }
            }

            Role.ADMIN -> {
                composable(Routes.ADMIN_CLINICS) { AdminClinicsScreen() }
                composable(Routes.ADMIN_USERS) { AdminUsersScreen() }
                composable(Routes.ADMIN_AUDIT) { AdminAuditScreen() }
            }
        }

        // Shared detail — reachable by any role that can navigate to it.
        composable(
            Routes.APPOINTMENT_DETAIL,
            arguments = listOf(navArgument(Routes.ARG_APPOINTMENT_ID) { type = NavType.StringType }),
        ) { entry ->
            AppointmentDetailScreen(
                appointmentId = entry.arguments?.getString(Routes.ARG_APPOINTMENT_ID).orEmpty(),
                user = user,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
