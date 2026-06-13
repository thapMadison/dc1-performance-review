/* ═══════════════════════════════════════════════════════════════
   CONFIG — fill in your Firebase project values (see README.md)
═══════════════════════════════════════════════════════════════ */

// Firebase console → Project settings → General → Your apps → SDK setup and configuration
export const firebaseConfig = {
  apiKey: 'AIzaSyA3DYLOwCpH5gRBbUFjNrGs1ObRs-jJrqQ',
  authDomain: 'dc1-tool.firebaseapp.com',
  databaseURL: 'https://dc1-tool-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'dc1-tool',
  storageBucket: 'dc1-tool.firebasestorage.app',
  messagingSenderId: '27467886077',
  appId: '1:27467886077:web:dca43db08fd94ff7d3bd94',
};

// Azure AD tenant for Microsoft sign-in: 'common' allows any work account;
// use your directory (tenant) ID to restrict to the company tenant.
export const MS_TENANT = 'fa190090-4fc1-416a-bd41-a480b5dad5b7';

// App Check — reCAPTCHA v3 site key (public, an toàn để commit).
// Firebase Console → App Check → Apps → đăng ký web app này với provider
// reCAPTCHA v3 → copy "site key" vào đây. Để trống nếu chưa bật App Check.
export const RECAPTCHA_SITE_KEY = '6LfwAfMsAAAAALaOyFaWAgofFAjLJEOYkM8BwLwz';

// Labels shown across the app
export const APP_CYCLE = 'Q2 2026';
export const APP_CYCLE_YEAR = '2026';
export const APP_DEADLINE = '31/07/2026';
