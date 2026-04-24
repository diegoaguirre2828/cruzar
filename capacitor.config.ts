import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.cruzar.ios',
  appName: 'Cruzar',
  webDir: 'public',
  server: {
    url: 'https://cruzar.app',
    cleartext: false,
    allowNavigation: [
      'cruzar.app',
      '*.cruzar.app',
      'cruzaapp.vercel.app',
      '*.supabase.co',
      'api.stripe.com',
      'js.stripe.com',
      'checkout.stripe.com',
      '*.cbp.gov',
    ],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0f172a',
    scheme: 'Cruzar',
    appendUserAgent: 'CruzarIOS/1.0',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
}

export default config
