import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || ''
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
const explicitDbUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL || ''

// VITE_FIREBASE_DATABASE_URL이 누락되었더라도 projectId가 있으면 기본 URL 자동 유추
const autoDbUrl =
  explicitDbUrl.trim() ||
  (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : '')

const firebaseConfig = {
  apiKey: apiKey.trim(),
  authDomain: (
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    (projectId ? `${projectId}.firebaseapp.com` : '')
  ).trim(),
  databaseURL: autoDbUrl,
  projectId: projectId.trim(),
  storageBucket: (
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.firebasestorage.app` : '')
  ).trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
}

let app = null
let db = null
let initError = null

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  initError =
    'Firebase 환경 변수(VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID 등)가 Vercel에 설정되지 않았거나 재빌드가 필요합니다.'
  console.warn(initError)
} else {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    db = getDatabase(app, firebaseConfig.databaseURL || undefined)
  } catch (err) {
    initError = err?.message || 'Firebase 초기화 실패'
    console.warn('Firebase init error:', err)
  }
}

export { app, db, initError, firebaseConfig }
