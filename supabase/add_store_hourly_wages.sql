-- =============================================
-- 店舗別時給対応マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- staff_store_hourly_wages（スタッフ別・店舗別時給）
CREATE TABLE IF NOT EXISTS staff_store_hourly_wages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  hourly_wage integer NOT NULL DEFAULT 1000 CHECK (hourly_wage >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);

CREATE INDEX IF NOT EXISTS staff_store_hourly_wages_user_id_idx
  ON staff_store_hourly_wages(user_id);
CREATE INDEX IF NOT EXISTS staff_store_hourly_wages_store_id_idx
  ON staff_store_hourly_wages(store_id);

-- 既存スタッフの現在の時給を、全店舗の初期値としてコピー
INSERT INTO staff_store_hourly_wages (user_id, store_id, hourly_wage)
SELECT profiles.id, stores.id, profiles.hourly_wage
FROM profiles
CROSS JOIN stores
ON CONFLICT (user_id, store_id) DO NOTHING;

-- RLS
ALTER TABLE staff_store_hourly_wages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own store hourly wages" ON staff_store_hourly_wages;
DROP POLICY IF EXISTS "Admins can manage all store hourly wages" ON staff_store_hourly_wages;

CREATE POLICY "Users can view own store hourly wages" ON staff_store_hourly_wages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all store hourly wages" ON staff_store_hourly_wages
  FOR ALL USING (public.is_admin());

-- 2026年以降の Supabase Data API 設定に備えて明示的に権限付与
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_store_hourly_wages TO authenticated;

-- updated_at
DROP TRIGGER IF EXISTS update_staff_store_hourly_wages_updated_at ON staff_store_hourly_wages;
CREATE TRIGGER update_staff_store_hourly_wages_updated_at
  BEFORE UPDATE ON staff_store_hourly_wages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
