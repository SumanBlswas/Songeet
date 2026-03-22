const {
  withMainActivity,
  withAndroidManifest,
  withProjectBuildGradle,
  withGradleProperties,
  withMainApplication,
  withDangerousMod,
} = require("@expo/config-plugins");

/**
 * MainActivity: Inject Dynamic Native Splash (Matches React Design)
 */
const withMainActivityCustomizations = (config) => {
  return withMainActivity(config, (config) => {
    if (config.modResults.language === "kt") {
      let content = config.modResults.contents;

      // 1. Add required imports for Native UI
      const imports = [
        "android.view.View",
        "android.view.Gravity",
        "android.view.ViewGroup",
        "android.widget.FrameLayout",
        "android.widget.LinearLayout",
        "android.widget.TextView",
        "android.graphics.Color",
        "android.graphics.Typeface",
        "android.graphics.drawable.GradientDrawable",
        "android.content.Context",
        "android.util.TypedValue",
      ];

      imports.forEach((imp) => {
        if (!content.includes(imp)) {
          content = content.replace(
            "import com.facebook.react.ReactActivity",
            `import ${imp}\nimport com.facebook.react.ReactActivity`,
          );
        }
      });

      // Remove old companion object if it exists from previous builds
      content = content.replace(/companion object \{[\s\S]*?\}\s*\}/g, "");

      // 2. Inject Dynamic Native View Creation
      if (!content.includes("fun createSplashView")) {
        const lastBraceIndex = content.lastIndexOf("}");
        const nativeSplashCode = `
  private fun createSplashView(context: Context): View {
      val root = FrameLayout(context).apply {
          tag = "songeet_custom_splash" // Safely tag the view for later removal
          setBackgroundColor(Color.parseColor("#000000"))
          layoutParams = FrameLayout.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT, 
              ViewGroup.LayoutParams.MATCH_PARENT
          )
      }

      val content = LinearLayout(context).apply {
          orientation = LinearLayout.VERTICAL
          gravity = Gravity.CENTER
          layoutParams = FrameLayout.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT, 
              ViewGroup.LayoutParams.MATCH_PARENT
          )
      }

      // Read saved language from SharedPreferences
      val prefs = context.getSharedPreferences("songeet_prefs", Context.MODE_PRIVATE)
      val lang = prefs.getString("user_language", "english") ?: "english"

      val translations = mapOf(
          "english" to "Songeet",
          "bengali" to "সঙ্গীত",
          "hindi" to "संगीत",
          "marathi" to "संगीत",
          "telugu" to "సంగీతం",
          "tamil" to "சங்கீத்"
      )
      val brandName = translations[lang] ?: "Songeet"

      val logoText = TextView(context).apply {
          text = brandName
          setTextColor(Color.WHITE)
          setTextSize(TypedValue.COMPLEX_UNIT_DIP, 48f)
          typeface = Typeface.create("serif", Typeface.BOLD)
          gravity = Gravity.CENTER
          layoutParams = LinearLayout.LayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              ViewGroup.LayoutParams.WRAP_CONTENT
          )
      }

      val divider = View(context).apply {
          val widthPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 40f, resources.displayMetrics).toInt()
          val heightPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 3f, resources.displayMetrics).toInt()
          layoutParams = LinearLayout.LayoutParams(widthPx, heightPx).apply {
              topMargin = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 15f, resources.displayMetrics).toInt()
              bottomMargin = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 15f, resources.displayMetrics).toInt()
          }
          background = GradientDrawable().apply {
              setColor(Color.parseColor("#7D8C69"))
              cornerRadius = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 2f, resources.displayMetrics)
          }
      }

      val tagline = TextView(context).apply {
          text = "PREMIUM INDIAN MUSIC"
          setTextColor(Color.parseColor("#66FFFFFF"))
          setTextSize(TypedValue.COMPLEX_UNIT_DIP, 10f)
          typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
          letterSpacing = 0.4f
          gravity = Gravity.CENTER
          layoutParams = LinearLayout.LayoutParams(
              ViewGroup.LayoutParams.WRAP_CONTENT,
              ViewGroup.LayoutParams.WRAP_CONTENT
          )
      }

      content.addView(logoText)
      content.addView(divider)
      content.addView(tagline)
      root.addView(content)
      
      return root
  }
`;
        const nextBraceIndex = content.lastIndexOf("}");
        content =
          content.slice(0, nextBraceIndex) +
          nativeSplashCode +
          content.slice(nextBraceIndex);
      }

      // 3. Inject invokeDefaultOnBackPressed (Safely)
      if (!content.includes("moveTaskToBack(false)")) {
        if (content.includes("fun invokeDefaultOnBackPressed()")) {
          const backSearch =
            /override fun invokeDefaultOnBackPressed\(\) \{[\s\S]*?\}/;
          const backReplacement = `override fun invokeDefaultOnBackPressed() {
      if (android.os.Build.VERSION.SDK_INT <= android.os.Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }`;
          content = content.replace(backSearch, backReplacement);
        } else {
          const lastBraceIndex = content.lastIndexOf("}");
          const backButtonCode = `
  override fun invokeDefaultOnBackPressed() {
      if (android.os.Build.VERSION.SDK_INT <= android.os.Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
`;
          content =
            content.slice(0, lastBraceIndex) +
            backButtonCode +
            content.slice(lastBraceIndex);
        }
      }

      // 4. Inject Splash showing into onCreate safely with AUTO-DISMISS
      if (!content.includes("val customSplash = createSplashView(this)")) {
        const onCreateSearch = "super.onCreate(null)";
        const onCreateReplacement = `super.onCreate(null)
    
    // Request 120Hz
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
      val params = window.attributes
      params.preferredRefreshRate = 120f
      window.attributes = params
    }

    // Show Native Dynamic Splash
    val customSplash = createSplashView(this)
    addContentView(
        customSplash, 
        ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    )

    // AUTO-DISMISS: Remove splash after 2 seconds (bulletproof, no React bridge needed)
    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
        (customSplash.parent as? ViewGroup)?.removeView(customSplash)
    }, 2000)`;
        content = content.replace(onCreateSearch, onCreateReplacement);
      }

      config.modResults.contents = content;
    }
    return config;
  });
};

/**
 * AndroidManifest: Inject application attributes
 */
const withAndroidManifestCustomizations = (config) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    mainApplication.$["android:requestLegacyExternalStorage"] = "true";
    mainApplication.$["android:enableOnBackInvokedCallback"] = "false";

    return config;
  });
};

/**
 * Project Build Gradle: Lock AGP, Kotlin, and SDK versions
 */
const withProjectBuildGradleCustomizations = (config) => {
  return withProjectBuildGradle(config, (config) => {
    let content = config.modResults.contents;

    // 1. Lock Versions in buildscript
    if (!content.includes('buildToolsVersion = "35.0.0"')) {
      content = content.replace(
        /ext \{/,
        `ext {
    buildToolsVersion = "35.0.0"
    minSdkVersion = 24
    compileSdkVersion = 35
    targetSdkVersion = 35
  }`,
      );
    }

    if (!content.includes("com.android.tools.build:gradle:8.7.2")) {
      content = content.replace(
        /classpath\(['"]com\.android\.tools\.build:gradle['"]\)/,
        "classpath('com.android.tools.build:gradle:8.7.2')",
      );
      content = content.replace(
        /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\)/,
        "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21')",
      );
    }

    // 2. Force variants matching in allprojects
    if (!content.includes("resolutionStrategy {")) {
      const allProjectsSearch = "allprojects {";
      const allProjectsReplacement = `allprojects {
  configurations.all {
    resolutionStrategy {
      force "com.android.tools.build:gradle:8.7.2"
      force "org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21"
    }
  }`;
      content = content.replace(allProjectsSearch, allProjectsReplacement);
    }

    config.modResults.contents = content;
    return config;
  });
};

/**
 * Gradle Properties: Inject BuildConfig and compatibility flags
 */
const withGradlePropertiesCustomizations = (config) => {
  return withGradleProperties(config, (config) => {
    config.modResults.push(
      {
        type: "property",
        key: "android.defaults.buildfeatures.buildconfig",
        value: "true",
      },
      {
        type: "property",
        key: "android.suppressUnsupportedCompileSdk",
        value: "36,35,34",
      },
      {
        type: "property",
        key: "android.experimental.allowVisibleAgpVersionAttribute",
        value: "true",
      },
      { type: "property", key: "android.nonTransitiveRClass", value: "false" },
      { type: "property", key: "newArchEnabled", value: "true" },
      {
        type: "property",
        key: "systemProp.org.gradle.internal.http.connectionTimeout",
        value: "120000",
      },
      {
        type: "property",
        key: "systemProp.org.gradle.internal.http.socketTimeout",
        value: "120000",
      },
    );
    return config;
  });
};

/**
 * Resources: Provide dummy logo + force black theme for splash
 */
const withSplashResources = (config) => {
  const fs = require("fs");
  const path = require("path");

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // 1. Provide an XML drawable for splashscreen_logo (PNG crashes AAPT2)
      const drawablePath = path.join(
        projectRoot,
        "android/app/src/main/res/drawable",
      );
      const logoPath = path.join(drawablePath, "splashscreen_logo.xml");
      // Remove old PNG if it exists
      const oldPngPath = path.join(drawablePath, "splashscreen_logo.png");
      if (fs.existsSync(oldPngPath)) {
        fs.unlinkSync(oldPngPath);
      }
      const xmlDrawable = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#000000"/>
</shape>`;
      if (!fs.existsSync(drawablePath)) {
        fs.mkdirSync(drawablePath, { recursive: true });
      }
      fs.writeFileSync(logoPath, xmlDrawable);

      // 2. Force ALL splash backgrounds to black in styles.xml
      const stylesPaths = [
        path.join(projectRoot, "android/app/src/main/res/values/styles.xml"),
        path.join(projectRoot, "android/app/src/main/res/values-v23/styles.xml"),
        path.join(projectRoot, "android/app/src/main/res/values-v31/styles.xml"),
      ];

      for (const stylesPath of stylesPaths) {
        if (fs.existsSync(stylesPath)) {
          let content = fs.readFileSync(stylesPath, "utf8");
          // Force windowBackground to black
          content = content.replace(
            /<item name="android:windowBackground">.*?<\/item>/g,
            '<item name="android:windowBackground">@color/splashscreen_background</item>'
          );
          // Force splash background color to black
          content = content.replace(
            /<item name="windowSplashScreenBackground">.*?<\/item>/g,
            '<item name="windowSplashScreenBackground">@color/splashscreen_background</item>'
          );
          fs.writeFileSync(stylesPath, content);
        }
      }

      // 3. Force the splash background color resource to black
      const colorsPath = path.join(projectRoot, "android/app/src/main/res/values/colors.xml");
      if (fs.existsSync(colorsPath)) {
        let content = fs.readFileSync(colorsPath, "utf8");
        content = content.replace(
          /<color name="splashscreen_background">.*?<\/color>/,
          '<color name="splashscreen_background">#000000</color>'
        );
        fs.writeFileSync(colorsPath, content);
      }

      return config;
    },
  ]);
};

/**
 * MainApplication: Register the SongeetSyncModule
 */
const withMainApplicationCustomizations = (config) => {
  return withMainApplication(config, (config) => {
    let content = config.modResults.contents;

    if (!content.includes("SongeetSyncPackage")) {
      const packageSearch = "return packages";
      const packageReplacement = `packages.add(object : com.facebook.react.ReactPackage {
                override fun createNativeModules(reactContext: com.facebook.react.bridge.ReactApplicationContext): List<com.facebook.react.bridge.NativeModule> {
                    return listOf(com.suman.songeet.SongeetSyncModule(reactContext))
                }
                override fun createViewManagers(reactContext: com.facebook.react.bridge.ReactApplicationContext): List<com.facebook.react.uimanager.ViewManager<*, *>> {
                    return emptyList()
                }
            })
            return packages`;
      content = content.replace(packageSearch, packageReplacement);
    }

    config.modResults.contents = content;
    return config;
  });
};

/**
 * Create the SongeetSyncModule.kt file (Now UI-Thread & Type-Safe)
 */
const withSongeetSyncModule = (config) => {
  const fs = require("fs");
  const path = require("path");

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packagePath = path.join(
        projectRoot,
        "android/app/src/main/java/com/suman/songeet",
      );
      const filePath = path.join(packagePath, "SongeetSyncModule.kt");

      const moduleContent = `package com.suman.songeet

import android.content.Context
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SongeetSyncModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "SongeetSync"

    @ReactMethod
    fun saveLanguage(language: String) {
        val prefs = reactApplicationContext.getSharedPreferences("songeet_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("user_language", language).apply()
    }

    @ReactMethod
    fun hideSplash() {
        android.util.Log.d("SongeetSync", "hideSplash called from JS")
        
        // Use getCurrentActivity() as required by ReactContextBaseJavaModule
        val activity = getCurrentActivity() ?: return
        
        // Ensure UI updates happen on the main thread
        activity.runOnUiThread {
            // FIX: Correct generic type is <View>, not <Any>
            val splashView = activity.window.decorView.findViewWithTag<View>("songeet_custom_splash")
            
            if (splashView != null) {
                // Safely cast the parent to ViewGroup and remove the view
                (splashView.parent as? ViewGroup)?.removeView(splashView)
            }
        }
    }
}`;

      if (!fs.existsSync(packagePath)) {
        fs.mkdirSync(packagePath, { recursive: true });
      }
      fs.writeFileSync(filePath, moduleContent);

      return config;
    },
  ]);
};

module.exports = (config) => {
  config = withMainActivityCustomizations(config);
  config = withAndroidManifestCustomizations(config);
  config = withProjectBuildGradleCustomizations(config);
  config = withGradlePropertiesCustomizations(config);
  config = withMainApplicationCustomizations(config);
  config = withSongeetSyncModule(config);
  config = withSplashResources(config);
  return config;
};
