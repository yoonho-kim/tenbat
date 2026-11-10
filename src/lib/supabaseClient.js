import { createClient } from '@supabase/supabase-js'

// Supabase 프로젝트 URL과 anon key를 여기에 설정하세요
// .env 파일에서 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 읽습니다
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
