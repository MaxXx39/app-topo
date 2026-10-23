import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Module « app » : l'application Android « Topo ».
plugins {
    id("com.android.application")
    kotlin("android")
}

// Numéro de version de l'appli web (package.json), affiché aussi dans l'onglet Projet.
val versionAppliWeb = Regex("\"version\"\\s*:\\s*\"([^\"]+)\"")
    .find(rootProject.file("../package.json").readText())?.groupValues?.get(1) ?: "0"

// Numéro de fabrication GitHub (1 en local). Il augmente à chaque fois,
// ce qui permet d'installer une mise à jour par-dessus l'ancienne.
val numeroFabrication = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1

android {
    namespace = "ch.apptopo"
    compileSdk = 35

    defaultConfig {
        applicationId = "ch.apptopo"
        minSdk = 26
        targetSdk = 35
        versionCode = numeroFabrication
        versionName = "$versionAppliWeb ($numeroFabrication)"
    }

    // Clé de signature fixe, gardée dans le dépôt : toutes les versions sont signées pareil,
    // donc Android accepte de mettre à jour l'appli sans la désinstaller (les projets restent).
    signingConfigs {
        getByName("debug") {
            storeFile = file("cle-signature.jks")
            storePassword = "apptopo"
            keyAlias = "apptopo"
            keyPassword = "apptopo"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

// L'appli web doit être fabriquée avant (« npm run build:android » à la racine du dépôt) :
// sinon l'APK serait vide. Message clair plutôt qu'une appli blanche.
val verifierAppliWeb by tasks.registering {
    val index = file("src/main/assets/app-topo/index.html")
    doLast {
        if (!index.exists()) {
            throw GradleException("Appli web absente : lancer d'abord « npm run build:android » à la racine du dépôt.")
        }
    }
}
tasks.named("preBuild") { dependsOn(verifierAppliWeb) }

dependencies {
    implementation(project(":noyau"))
    // Connexion au compte Google de l'appli, pour Google Drive (partage des projets, accord de
    // l'utilisateur du 23.10.2026) : outil officiel de Google, déjà présent sur les tablettes Android.
    implementation("com.google.android.gms:play-services-auth:21.2.0")
}
