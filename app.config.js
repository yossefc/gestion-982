module.exports = {
  expo: {
    name: "982",
    slug: "gestion-982",
    scheme: "gestion982",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo-982.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/images/logo-982.png",
      resizeMode: "contain",
      backgroundColor: "#4B5320"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.gestion982.app",
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || "./GoogleService-Info.plist",
      entitlements: {
        "com.apple.developer.applesignin": ["Default"]
      },
      infoPlist: {
        NSLocalNetworkUsageDescription: "האפליקציה זקוקה לגישה לרשת המקומית לצורך זיהוי חיבור האינטרנט.",
        NSBonjourServices: ["_http._tcp"],
        LSApplicationQueriesSchemes: ["whatsapp"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo-982.png",
        backgroundColor: "#4B5320"
      },
      package: "com.gestion982.app",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json"
    },
    web: {
      favicon: "./assets/images/logo-982.png"
    },
    extra: {
      eas: {
        projectId: "4633734e-d2ea-41e0-8dcb-ed92ed636beb"
      }
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    updates: {
      url: "https://u.expo.dev/4633734e-d2ea-41e0-8dcb-ed92ed636beb",
      fallbackToBundledUpdate: true
    },
    plugins: [
      "expo-font",
      "expo-updates",
      "expo-apple-authentication"
    ],
    jsEngine: "hermes",
    packagerOpts: {
      sourceExts: ["js", "json", "ts", "tsx"],
      assetExts: ["ttf", "png", "jpg"]
    },
    owner: "yossef1111"
  }
};
