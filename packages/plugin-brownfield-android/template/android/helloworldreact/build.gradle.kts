plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("com.callstack.react.brownfield")
    `maven-publish`
}

repositories {
    mavenCentral()
}

val appProject = project(":app")
val appBuildDir: Directory = appProject.layout.buildDirectory.get()
val moduleBuildDir: Directory = layout.buildDirectory.get()
val autolinkingJavaSources = "generated/autolinking/src/main/java"

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

    buildTypes {
        release {
            buildConfigField("boolean", "IS_NEW_ARCHITECTURE_ENABLED", properties["newArchEnabled"].toString())
            buildConfigField("boolean", "IS_HERMES_ENABLED", properties["hermesEnabled"].toString())
        }
    }

    sourceSets {
        getByName("main") {
            assets.srcDirs("$appBuildDir/generated/assets/createBundleReleaseJsAndAssets")
            res.srcDirs("$appBuildDir/generated/res/createBundleReleaseJsAndAssets")
            java.srcDirs("$moduleBuildDir/$autolinkingJavaSources")
        }
    }
}

publishing {
    publications {
        create<MavenPublication>("mavenAar") {
            groupId = "com.helloworldreact"
            artifactId = "helloworld"
            version = "0.0.1-local"
            artifact("$moduleBuildDir/outputs/aar/helloworldreact-release.aar")

            pom {
                withXml {
                    asNode().appendNode("dependencies").apply {
                        configurations.getByName("api").allDependencies.forEach { dependency ->
                            appendNode("dependency").apply {
                                appendNode("groupId", dependency.group)
                                appendNode("artifactId", dependency.name)
                                appendNode("version", dependency.version)
                                appendNode("scope", "compile")
                            }
                        }
                    }
                }
            }
        }
    }

    repositories {
        mavenLocal() // Publishes to the local Maven repository (~/.m2/repository)
    }
}

dependencies {
    api("com.facebook.react:react-android:0.77.0-rc.2")
    api("com.facebook.react:hermes-android:0.77.0-rc.2")
}

tasks.register<Copy>("copyAutolinkingSources") {
    dependsOn(":app:generateAutolinkingPackageList")
    from("$appBuildDir/$autolinkingJavaSources")
    into("$moduleBuildDir/$autolinkingJavaSources")
}

tasks.named("preBuild").configure{
    dependsOn("copyAutolinkingSources")
    val buildType = when {
        gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) } -> "Release"
        else -> "Debug"
    }
    if (buildType == "Release") {
        dependsOn(":app:createBundleReleaseJsAndAssets")
    }
}
