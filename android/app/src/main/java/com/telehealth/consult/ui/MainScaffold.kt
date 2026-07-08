package com.telehealth.consult.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.telehealth.consult.data.model.PublicUser
import com.telehealth.consult.data.model.Role
import com.telehealth.consult.ui.common.LocalContainer

private data class TabItem(val route: String, val label: String, val icon: ImageVector)

private fun tabsFor(role: Role): List<TabItem> = when (role) {
    Role.PATIENT -> listOf(
        TabItem(Routes.PATIENT_DOCTORS, "Find Care", Icons.Filled.MedicalServices),
        TabItem(Routes.PATIENT_APPOINTMENTS, "Appointments", Icons.AutoMirrored.Filled.EventNote),
    )
    Role.DOCTOR -> listOf(
        TabItem(Routes.DOCTOR_SCHEDULE, "My Schedule", Icons.Filled.CalendarMonth),
    )
    Role.STAFF -> listOf(
        TabItem(Routes.STAFF_APPOINTMENTS, "Appointments", Icons.AutoMirrored.Filled.ListAlt),
        TabItem(Routes.STAFF_SLOTS, "Slots", Icons.Filled.EventAvailable),
    )
    Role.ADMIN -> listOf(
        TabItem(Routes.ADMIN_CLINICS, "Clinics", Icons.Filled.LocalHospital),
        TabItem(Routes.ADMIN_USERS, "Users", Icons.Filled.Group),
        TabItem(Routes.ADMIN_AUDIT, "Audit", Icons.Filled.History),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScaffold(user: PublicUser) {
    val container = LocalContainer.current
    val navController = rememberNavController()
    val tabs = tabsFor(user.role)
    val startRoute = tabs.first().route

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(titleFor(user.role)) },
                actions = {
                    IconButton(onClick = { container.repository.logout() }) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Log out")
                    }
                },
            )
        },
        bottomBar = {
            if (tabs.size > 1) {
                NavigationBar {
                    tabs.forEach { tab ->
                        val selected =
                            currentDestination?.hierarchy?.any { it.route == tab.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        AppNavHost(
            navController = navController,
            startRoute = startRoute,
            user = user,
            modifier = Modifier.padding(padding),
        )
    }
}

private fun titleFor(role: Role): String = when (role) {
    Role.PATIENT -> "Telehealth · Patient"
    Role.DOCTOR -> "Telehealth · Doctor"
    Role.STAFF -> "Telehealth · Coordinator"
    Role.ADMIN -> "Telehealth · Admin"
}
