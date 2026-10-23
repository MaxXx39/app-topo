import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Module « noyau » : calculs du récepteur Emlid en Kotlin pur (NMEA, MN95 / RAN95, règle de prise de point),
// repris d'Emlid Stock avec leurs tests, sans Android, testés automatiquement.
plugins {
    kotlin("jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
