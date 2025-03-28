plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

repositories {
    mavenCentral()
}

android {
    namespace = "com.helloworldreact"
    compileSdk = 34

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {}
