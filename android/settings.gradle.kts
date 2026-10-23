// Appli Android « Topo » : l'appli web (dossier src/ du dépôt) rangée dans un APK.
// Modules :
// - noyau : calculs du récepteur Emlid (lecture NMEA, conversion MN95 / RAN95, règle de prise
//   de point), en Kotlin pur, repris d'Emlid Stock, testables sans téléphone.
// - app : l'application Android (fenêtre WebView qui affiche l'appli web, fichiers, dialogues,
//   Bluetooth du récepteur).
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
include(":noyau")
include(":app")
