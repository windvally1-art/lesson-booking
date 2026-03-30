import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// service_role key: RLS 우회, 백엔드 전용
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 유저 JWT로 RLS를 그대로 적용할 클라이언트 팩토리
export function supabaseForUser(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}
