module.exports = {
  name: 'dyuksa-app',
  slug: 'dyuksa-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',

  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.anonymous.dyuksaapp',
    infoPlist: {
      NSCameraUsageDescription: 'DYUKSA needs camera access to attach photos to tasks and notes.',
      NSPhotoLibraryUsageDescription: 'DYUKSA needs photo library access to attach images to tasks and notes.',
      NSPhotoLibraryAddUsageDescription: 'DYUKSA needs permission to save photos.',
      NSSpeechRecognitionUsageDescription: 'Allow DYUKSA to use speech recognition for voice search.',
      NSMicrophoneUsageDescription: 'Allow DYUKSA to use the microphone for voice search.',
    },
  },

  android: {
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    package: 'com.anonymous.dyuksaapp',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECORD_AUDIO',
    ],
  },

  web: {
    favicon: './assets/favicon.png',
  },

  plugins: [
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#3B72EE',
        sounds: [],
        androidMode: 'default',
        androidCollapsedTitle: 'DYUKSA',
      },
    ],
    '@react-native-community/datetimepicker',
  ],

  extra: {
    apiIp: process.env.EXPO_PUBLIC_API_IP || '',
    apiPort: process.env.EXPO_PUBLIC_API_PORT || '8000',
    centralPort: process.env.EXPO_PUBLIC_CENTRAL_PORT || '8001',
    webPort: process.env.EXPO_PUBLIC_WEB_PORT || '3001',
    env: process.env.EXPO_PUBLIC_ENV || 'local',
  },
};