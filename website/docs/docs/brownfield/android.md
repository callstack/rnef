# Adding React Native to Android app

React Native Enterprise Framework helps you package your React Native code into files that your iOS and Android apps can use. For Android, it creates an `.aar` file that you can easily add to your app.

To add React Native to your Android app, we'll package your React Native code into an AAR. This way, you don't need to set up Node.js in your main app. Here's how to do it:

## 1. Create a New Android Library Module

First, we'll create a new Android library module in your React Native project. This module will contain your React Native UI and provide APIs for loading it in your native Android app.

1. Open your React Native project's `android` folder in Android Studio
1. Go to File → New Module → Android Library
   ![Create new module in Android Studio](/create_module.png)
1. After the sync completes, run your React Native app to make sure everything works
1. Test the build by running `./gradlew assembleRelease` in the android directory

## 2. Set Up the Fat AAR Gradle Plugin

We need a special Gradle plugin to create a "fat" AAR that includes all dependencies. We'll use the `brownfield-gradle-plugin` plugin from Callstack.

1. Add the gradle plugin dependency to your `android/build.gradle`:

   ```gradle title="android/build.gradle" {3-10,15}
   buildscript {
       repositories {
           google()
           mavenCentral()
       }
       dependencies {
           classpath("com.callstack.react:brownfield-gradle-plugin:0.2.0")
       }
   }
   ```

1. Add the plugin to your `rnbrownfield/build.gradle.kts`:

   ```gradle title="rnbrownfield/build.gradle.kts" {4}
   plugins {
       id("com.android.library")
       id("org.jetbrains.kotlin.android")
       id("com.callstack.react.brownfield")
   }
   ```

1. Run `./gradlew assembleRelease` to verify the setup
   ![Verify AAR plugin setup](/verify_aar_plugin_setup.png)

## 3. Add React Native Dependencies

Add the required React Native dependencies to your `rnbrownfield/build.gradle.kts`:

```gradle title="rnbrownfield/build.gradle.kts" {2-3}
dependencies {
    api("com.facebook.react:react-android:0.77.0")
    api("com.facebook.react:hermes-android:0.77.0")
}
```

After adding these, sync your project and run `./gradlew assembleRelease` to verify everything works.

## 4. Create the React Native Host Manager

Create a new file called `ReactNativeHostManager.kt` in your `rnbrownfield` module:

```kotlin
import android.app.Application
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.PackageList
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

class ReactNativeHostManager {
    companion object {
        val shared: ReactNativeHostManager by lazy { ReactNativeHostManager() }
        private var reactNativeHost: ReactNativeHost? = null
    }

    fun getReactNativeHost(): ReactNativeHost? {
        return reactNativeHost
    }

    fun initialize(application: Application) {
        if (reactNativeHost == null) {
            SoLoader.init(application, OpenSourceMergedSoMapping)
            reactNativeHost = object : DefaultReactNativeHost(application) {
                override fun getUseDeveloperSupport(): Boolean {
                    return BuildConfig.DEBUG
                }

                override fun getPackages(): MutableList<ReactPackage> {
                    return PackageList(application).packages
                }

                override fun getJSMainModuleName(): String {
                    return "index"
                }

                override fun getBundleAssetName(): String {
                    return "index.android.bundle"
                }

                override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
                override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
            }
        }
    }
}
```

Update your `rnbrownfield/build.gradle.kts` to use Java 17:

```gradle title="rnbrownfield/build.gradle.kts" {3-4,7}
android {
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
```

Add build configuration fields:

```gradle title="rnbrownfield/build.gradle.kts" {4-5}
android {
    buildTypes {
        release {
            buildConfigField("boolean", "IS_NEW_ARCHITECTURE_ENABLED", properties["newArchEnabled"].toString())
            buildConfigField("boolean", "IS_HERMES_ENABLED", properties["hermesEnabled"].toString())
        }
    }
}
```

Set up autolinking:

```gradle title="rnbrownfield/build.gradle.kts" {1-4,7-11,14-22}
val appProject = project(":app")
val appBuildDir: Directory = appProject.layout.buildDirectory.get()
val moduleBuildDir: Directory = layout.buildDirectory.get()
val autolinkingJavaSources = "generated/autolinking/src/main/java"

android {
    sourceSets {
        getByName("main") {
            java.srcDirs("$moduleBuildDir/$autolinkingJavaSources")
        }
    }
}

tasks.register<Copy>("copyAutolinkingSources") {
    dependsOn(":app:generateAutolinkingPackageList")
    from("$appBuildDir/$autolinkingJavaSources")
    into("$moduleBuildDir/$autolinkingJavaSources")
}

tasks.named("preBuild").configure {
    dependsOn("copyAutolinkingSources")
}
```

## 5. Include the JavaScript Bundle

Update your `rnbrownfield/build.gradle.kts` to include the JS bundle in the AAR:

```gradle title="rnbrownfield/build.gradle.kts" {4,12-18}
android {
    sourceSets {
        getByName("main") {
            assets.srcDirs("$appBuildDir/generated/assets/createBundleReleaseJsAndAssets")
            java.srcDirs("$moduleBuildDir/$autolinkingJavaSources")
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn("copyAutolinkingSources")
    val buildType = when {
        gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) } -> "Release"
        else -> "Debug"
    }
    if (buildType == "Release") {
        dependsOn(":app:createBundleReleaseJsAndAssets")
    }
}
```

## 6. Create the React Native Entry Point

Create a new file called `RNViewFactory.kt` to wrap your React Native UI in a `FrameLayout`:

```kotlin title="RNViewFactory.kt"
import android.content.Context
import android.os.Bundle
import android.widget.FrameLayout
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactRootView

object RNViewFactory {
    fun createFrameLayout(
        context: Context,
        params: Bundle? = null,
    ): FrameLayout {
        val reactView = ReactRootView(context)
        val reactNativeHost = ReactNativeHostManager.shared.getReactNativeHost()
        val instanceManager: ReactInstanceManager? = reactNativeHost?.reactInstanceManager
        reactView.startReactApplication(
            instanceManager,
            "BrownfieldTest",
            params,
        )
        return reactView
    }
}
```

## 7. Configure Maven Publishing

Add the Maven publish plugin to your `rnbrownfield/build.gradle.kts`:

```gradle title="rnbrownfield/build.gradle.kts" {5}
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("com.callstack.react.brownfield")
    `maven-publish`
}
```

Configure the publishing settings:

```gradle title="rnbrownfield/build.gradle.kts"
publishing {
    publications {
        create<MavenPublication>("mavenAar") {
            groupId = "com.callstack"
            artifactId = "rnbrownfield"
            version = "0.0.1-local"
            artifact("$moduleBuildDir/outputs/aar/rnbrownfield-release.aar")

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
        mavenLocal() // Publishes to the local Maven repository (~/.m2/repository by default)
    }
}
```

## 8. Set up RNEF for AAR generation

1. Add `@rnef/plugin-brownfield-android` to your dependencies
1. Update your `rnef.config.mjs`:

   ```js title="rnef.config.mjs"
   import { pluginBrownfieldAndroid } from '@rnef/plugin-brownfield-android';

   export default {
     plugins: [pluginBrownfieldAndroid()],
   };
   ```

1. Run this command to generate the final AAR:

   ```sh title="Terminal"
   rnef package:aar --variant Release --module-name rnbrownfield
   ```

1. Once the AAR is created, publish it to local Maven registry to be consumable by the native app:

   ```sh title="Terminal"
   rnef publish-local:aar --module-name rnbrownfield
   ```

## 9. Add the AAR to Your Android App

> Note: You'll need an existing Android app or create a new one in Android Studio.

1. Add the dependency to your app's `build.gradle.kts`:

   ```gradle title="build.gradle.kts" {2}
   dependencies {
       implementation("com.callstack:rnbrownfield:0.0.1-local")
   }
   ```

1. Initialize React Native in your `MainActivity`:

   ```kotlin
   class MainActivity : AppCompatActivity() {
       override fun onCreate(savedInstanceState: Bundle?) {
           super.onCreate(savedInstanceState)
           ReactNativeHostManager.shared.initialize(this.application)
           // ... rest of your onCreate code
       }
   }
   ```

## 10. Show the React Native UI

Create a new `RNAppFragment.kt`:

```kotlin
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.callstack.rnbrownfield.RNViewFactory

class RNAppFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View? =
        this.context?.let {
            RNViewFactory.createFrameLayout(it)
        }
}
```

Add a button to your `activity_main.xml`:

```xml
<Button
    android:id="@+id/show_rn_app_btn"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="Show RN App"
    app:layout_constraintBottom_toBottomOf="parent"
    app:layout_constraintEnd_toEndOf="parent"
    app:layout_constraintStart_toStartOf="parent"
    app:layout_constraintTop_toTopOf="parent" />
```

Add a fragment container:

```xml
<FrameLayout
    android:id="@+id/fragmentContainer"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

Update your `MainActivity` to show the fragment:

```kotlin {2,8-13}
class MainActivity : AppCompatActivity() {
    private lateinit var showRNAppBtn: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ReactNativeHostManager.shared.initialize(this.application)

        showRNAppBtn = findViewById(R.id.show_rn_app_btn)
        showRNAppBtn.setOnClickListener {
            supportFragmentManager
                .beginTransaction()
                .replace(R.id.fragmentContainer, RNAppFragment())
                .commit()
        }
    }
}
```

Now you can run your app and test the React Native integration!
