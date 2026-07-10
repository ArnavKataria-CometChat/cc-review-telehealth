pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // CometChat UI Kit v6 + Chat/Calls SDKs (Phase B).
        maven { url = uri("https://dl.cloudsmith.io/public/cometchat/cometchat/maven/") }
    }
}

rootProject.name = "TelehealthConsult"
include(":app")
