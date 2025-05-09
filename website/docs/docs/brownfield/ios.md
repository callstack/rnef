# Adding React Native to iOS app

React Native Enterprise Framework helps you package your React Native code into files that your iOS and Android apps can use. For iOS, it creates a `.xcframework` file that you can easily add to your app.

To add React Native to your iOS app, we'll package your React Native code into an XCFramework. This way, you don't need to set up Node.js or CocoaPods in your main app. Here's how to do it:

## 1. Create a New Framework in React Native app's Xcode:

1. Open your React Native project's `ios/<project_name>.xcworkspace` in Xcode
1. Add a new target by clicking File > New > Target
1. Choose the `Framework` template
   ![Framework Target](/brownfield_framework_target.png)
1. Give your framework a unique name. You'll use this name when adding it to your main app
1. Right-click the framework folder and select `Convert to Group`. CocoaPods doesn't work properly with references.
   ![The menu that appears when user right clicks on the generated framework folder](/brownfield_convert_to_group.png). Perform this step for both `<FrameworkName>` and `<FrameworkName>Tests` folders.
1. Set these build settings for your framework:

   | Build Setting                    | Value | What it does                                                                                      |
   | -------------------------------- | ----- | ------------------------------------------------------------------------------------------------- |
   | Build Libraries for Distribution | YES   | Creates a module interface for Swift. Also checks if the framework works with your Xcode version. |
   | User Script Sandboxing           | NO    | Lets scripts modify files, which we need to create the JavaScript bundle.                         |
   | Skip Install                     | NO    | Makes sure Xcode creates the framework files we need.                                             |
   | Enable Module Verifier           | NO    | Skips testing the framework during build, which makes builds faster.                              |

## 2. Set Up CocoaPods:

1. Add your new framework to `ios/Podfile`:

   ```ruby title="Podfile"
   target '<project_name>' do
     # ...
     # Add these lines
     target '<framework_target_name>' do
       inherit! :complete
     end
   end
   ```

## 3. Add the Bundle Script:

1. In Xcode, click on your app target
1. Go to Build Phases
1. Find the `Bundle React Native code and images` step
1. Copy the script from there
1. Click on your framework target
1. Go to Build Phases
1. Click the + button and choose `New Run Script Phase`
1. Paste the script you copied
1. Name the phase `Bundle React Native code and images`
1. Add these files to the script's input files:
   - `$(SRCROOT)/.xcode.env.local`
   - `$(SRCROOT)/.xcode.env`

## 4. Create the Framework's Public Interface:

1. Create a new Swift file in your framework folder
1. You can use this template from [HelloWorldReact.swift](https://github.com/callstack/rnef/tree/main/packages/plugin-brownfield-ios/template/ios/HelloWorldReact/HelloWorldReact.swift) as a starting point

## 5. Create the XCFramework:

1. Add `@rnef/plugin-brownfield-ios` to your project (`npm install -D @rnef/plugin-brownfield-ios`)
1. Add this to your `rnef.config.mjs`:

   ```js title="rnef.config.mjs"
   import { pluginBrownfieldIos } from '@rnef/plugin-brownfield-ios';

   export default {
     plugins: [
       pluginBrownfieldIos(),
       // ...
     ],
   };
   ```

1. Open Terminal and run:

   ```sh title="Terminal"
   rnef package:ios --scheme <framework_target_name> --configuration Release
   ```

## 6. Add the Framework to Your App:

1. Drag the `.xcframework` file into your app's Xcode project
1. Also drag `ios/Pods/hermes-engine/destroot/Library/Frameworks/universal/hermes.xcframework` into your app
1. Add the `window` property to your `AppDelegate` or `SceneDelegate`:

   If using `AppDelegate`:

   ```swift title="AppDelegate.swift"
   @main
   class AppDelegate: UIResponder, UIApplicationDelegate {
       var window: UIWindow?

       func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
           window = UIWindow(frame: UIScreen.main.bounds)
           // ...
       }
   }
   ```

   If using `SceneDelegate`:

   ```swift title="SceneDelegate.swift"
   class SceneDelegate: UIResponder, UIWindowSceneDelegate {
       var window: UIWindow?

       func scene(
           _ scene: UIScene, willConnectTo _: UISceneSession,
           options _: UIScene.ConnectionOptions
       ) {
           guard let windowScene = (scene as? UIWindowScene) else { return }

           window = UIWindow(windowScene: windowScene)

           let customViewController = CustomViewController()

           window.rootViewController = customViewController
           window.makeKeyAndVisible()
       }
   }
   ```

1. Show the React Native view:

   ```swift title="MyViewController.swift"
   import UIKit
   import <framework_target_name>React

   class ViewController: UIViewController {
       override func viewDidLoad() {
           super.viewDidLoad()
           do {
               view = try PackageReactNativeManager().loadView(
                   moduleName: "TemplateTest",
                   initialProps: nil,
                   launchOptions: nil
               )
           } catch {
               #warning("TODO: Handle React Native loading failures")
           }
       }
   }
   ```
