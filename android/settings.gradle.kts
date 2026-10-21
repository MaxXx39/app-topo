// Appli Android « Topo » : l'appli web (dossier src/ du dépôt) rangée dans un APK.
// Module :
// - app : l'application Android (fenêtre WebView qui affiche l'appli web, fichiers, dialogues).
// Plus tard : un module « noyau » pour le récepteur Emlid (lecture NMEA, conversion MN95 / RAN95),
// repris d'Emlid Stock.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Topo"
include(":app")
