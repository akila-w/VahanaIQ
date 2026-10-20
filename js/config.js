// VahanaIQ Platform Configuration
// -------------------------------------------------------------
// AI vehicle search goes through a serverless proxy (see /serverless) that
// holds the Gemini API key and model choice, so no key is ever in the browser.
export const APP_VERSION = "2.10.0";

export const config = {
  proxyUrl: "https://vahanaiq-search-71962876227.asia-south1.run.app"
};

// Google sign-in and sync (js/account.js). This web config is public by design: Firebase
// identifies the project with it, and firestore.rules decide who can read or write what.
export const firebaseConfig = {
  apiKey: "AIzaSyB7y80tXqmjxVf_jy9SOTo2x_yXWYhVquU",
  authDomain: "vahanaiq-sign-in.firebaseapp.com",
  projectId: "vahanaiq-sign-in",
  storageBucket: "vahanaiq-sign-in.firebasestorage.app",
  messagingSenderId: "376324722920",
  appId: "1:376324722920:web:c20f16fe322420ecfaf95d"
};

// Firebase's modular SDK, loaded from Google's CDN only when someone signs in
export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/12.19.0";
