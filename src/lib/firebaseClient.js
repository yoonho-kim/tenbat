import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

// Firebase 프로젝트 환경 변수
// .env 또는 Vercel 환경 변수에서 읽어옵니다.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForDevelopment1234567890',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'aqua-verse-demo.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://aqua-verse-demo-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'aqua-verse-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'aqua-verse-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef1234567890',
}

let app = null
let db = null

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  db = getDatabase(app)
} catch (err) {
  console.warn('Firebase init error (check your Firebase configuration):', err)
}

export { app, db }
