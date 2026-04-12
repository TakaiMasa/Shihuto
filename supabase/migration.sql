-- =============================================
-- シフト・勤怠・給与管理システム
-- Supabase マイグレーション SQL（一括実行用）
-- 
-- Supabase ダッシュボード > SQL Editor に
-- このファイルの内容を全てコピーして実行してください
-- =============================================


-- ========================================
-- 1. テーブル作成
-- ========================================

-- stores（店舗）
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  has_transportation_fee boolean NOT NULL DEFAULT false,
  transportation_fee integer NOT NULL DEFAULT 0,
  base_day_of_week smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- profiles（スタッフプロフィール）
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'admin')),
  hourly_wage integer NOT NULL DEFAULT 1000,
  transportation_fee integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- shift_unavailable（出勤不可日）
CREATE TABLE shift_unavailable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unavailable_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, unavailable_date)
);

-- shifts（確定シフト）
CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id, shift_date)
);

-- attendances（勤怠記録）
CREATE TABLE attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  clock_in timestamptz,
  break_start timestamptz,
  break_end timestamptz,
  clock_out timestamptz,
  work_minutes integer,
  break_minutes integer,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id, work_date)
);

-- staff_transportation_fees（スタッフ別店舗交通費）
CREATE TABLE staff_transportation_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  fee integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);

-- salaries（給与）
CREATE TABLE salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year_month text NOT NULL,
  total_work_minutes integer NOT NULL DEFAULT 0,
  total_break_minutes integer NOT NULL DEFAULT 0,
  hourly_wage integer NOT NULL,
  work_days_shiki integer NOT NULL DEFAULT 0,
  transportation_fee_per_day integer NOT NULL DEFAULT 0,
  base_salary integer NOT NULL DEFAULT 0,
  transportation_total integer NOT NULL DEFAULT 0,
  total_salary integer NOT NULL DEFAULT 0,
  is_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year_month)
);


-- ========================================
-- 2. インデックス作成
-- ========================================

CREATE INDEX profiles_role_idx ON profiles(role);
CREATE INDEX shift_unavailable_date_idx ON shift_unavailable(unavailable_date);
CREATE INDEX shifts_date_idx ON shifts(shift_date);
CREATE INDEX shifts_user_id_idx ON shifts(user_id);
CREATE INDEX shifts_store_id_idx ON shifts(store_id);
CREATE INDEX attendances_work_date_idx ON attendances(work_date);
CREATE INDEX attendances_user_id_idx ON attendances(user_id);
CREATE INDEX attendances_store_id_idx ON attendances(store_id);
CREATE INDEX salaries_year_month_idx ON salaries(year_month);
CREATE INDEX salaries_user_id_idx ON salaries(user_id);


-- ========================================
-- 3. 初期データ（3店舗）
-- ========================================

-- base_day_of_week: 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
INSERT INTO stores (name, code, has_transportation_fee, base_day_of_week) VALUES
  ('麺屋 水', 'sui', false, 3),
  ('RAMEN MONDAY', 'monday', false, 1),
  ('RAMEN FRIDAY', 'friday', false, 5);


-- ========================================
-- 4. 管理者判定関数（SECURITY DEFINER）
-- ========================================

-- RLSをバイパスして管理者かどうかを判定する関数
-- profilesテーブルのRLSポリシーが自己参照する循環参照を回避するため、
-- SECURITY DEFINER で定義し、RLSチェックをスキップして直接参照する。
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ========================================
-- 5. RLS（行レベルセキュリティ）有効化 & ポリシー
-- ========================================

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_unavailable ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

-- stores: 全員閲覧可、管理者は編集可
CREATE POLICY "Everyone can view stores" ON stores FOR SELECT USING (true);
CREATE POLICY "Admins can manage stores" ON stores FOR ALL
  USING (public.is_admin());

-- profiles: 自分のみ閲覧可、管理者は全員を閲覧・編集可
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT
  USING (public.is_admin());
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- shift_unavailable: 自分の分を管理可、管理者は全員分を閲覧可
CREATE POLICY "Users can manage own unavailable" ON shift_unavailable FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all unavailable" ON shift_unavailable FOR SELECT
  USING (public.is_admin());

-- shifts: 全員閲覧可、管理者のみ編集可
CREATE POLICY "Everyone can view shifts" ON shifts FOR SELECT USING (true);
CREATE POLICY "Admins can manage shifts" ON shifts FOR ALL
  USING (public.is_admin());

-- attendances: 自分の分を管理可、管理者は全員分を管理可
CREATE POLICY "Users can manage own attendances" ON attendances FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all attendances" ON attendances FOR ALL
  USING (public.is_admin());

-- salaries: 自分の分のみ閲覧可、管理者は全員分を管理可
CREATE POLICY "Users can view own salaries" ON salaries FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all salaries" ON salaries FOR ALL
  USING (public.is_admin());

-- staff_transportation_fees: 自分の分を管理可、管理者は全員分を管理可
ALTER TABLE staff_transportation_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own transportation fees" ON staff_transportation_fees FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all transportation fees" ON staff_transportation_fees FOR ALL
  USING (public.is_admin());


-- ========================================
-- 6. 関数 & トリガー
-- ========================================

-- 6.1 勤務時間自動計算トリガー
CREATE OR REPLACE FUNCTION calculate_work_minutes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_in IS NOT NULL AND NEW.clock_out IS NOT NULL THEN
    -- 総勤務時間（分）
    NEW.work_minutes := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 60;

    -- 休憩時間（分）
    IF NEW.break_start IS NOT NULL AND NEW.break_end IS NOT NULL THEN
      NEW.break_minutes := EXTRACT(EPOCH FROM (NEW.break_end - NEW.break_start)) / 60;
      NEW.work_minutes := NEW.work_minutes - NEW.break_minutes;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_calculate_minutes
  BEFORE INSERT OR UPDATE ON attendances
  FOR EACH ROW
  EXECUTE FUNCTION calculate_work_minutes();

-- 6.2 updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_salaries_updated_at
  BEFORE UPDATE ON salaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6.3 プロフィール取得・自動作成関数（RLSバイパス）
CREATE OR REPLACE FUNCTION public.get_or_create_profile(
  p_user_id uuid,
  p_user_name text DEFAULT '未設定'
)
RETURNS SETOF profiles AS $$
BEGIN
  -- 存在しなければ作成
  INSERT INTO public.profiles (id, name, role, hourly_wage, transportation_fee)
  VALUES (p_user_id, p_user_name, 'staff', 1200, 0)
  ON CONFLICT (id) DO NOTHING;

  -- プロフィールを返す
  RETURN QUERY SELECT * FROM public.profiles WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.4 新規ユーザー登録時のプロフィール自動作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ========================================
-- 7. ビュー
-- ========================================

-- 7.1 月次勤怠サマリー
CREATE VIEW monthly_attendance_summary AS
SELECT
  a.user_id,
  p.name AS user_name,
  TO_CHAR(a.work_date, 'YYYY-MM') AS year_month,
  s.code AS store_code,
  s.name AS store_name,
  COUNT(*) AS work_days,
  SUM(a.work_minutes) AS total_work_minutes,
  SUM(a.break_minutes) AS total_break_minutes
FROM attendances a
JOIN profiles p ON a.user_id = p.id
JOIN stores s ON a.store_id = s.id
WHERE a.clock_out IS NOT NULL
GROUP BY a.user_id, p.name, TO_CHAR(a.work_date, 'YYYY-MM'), s.code, s.name;

-- 7.2 給与計算用ビュー
CREATE VIEW salary_calculation AS
SELECT
  p.id AS user_id,
  p.name AS user_name,
  p.hourly_wage,
  p.transportation_fee,
  m.year_month,
  COALESCE(sui.work_days, 0) AS sui_work_days,
  COALESCE(monday.work_days, 0) AS monday_work_days,
  COALESCE(friday.work_days, 0) AS friday_work_days,
  COALESCE(sui.total_work_minutes, 0) + COALESCE(monday.total_work_minutes, 0) + COALESCE(friday.total_work_minutes, 0) AS total_work_minutes,
  COALESCE(sui.total_break_minutes, 0) + COALESCE(monday.total_break_minutes, 0) + COALESCE(friday.total_break_minutes, 0) AS total_break_minutes
FROM profiles p
CROSS JOIN (
  SELECT DISTINCT TO_CHAR(work_date, 'YYYY-MM') AS year_month
  FROM attendances
) m
LEFT JOIN monthly_attendance_summary sui
  ON p.id = sui.user_id
  AND m.year_month = sui.year_month
  AND sui.store_code = 'sui'
LEFT JOIN monthly_attendance_summary monday
  ON p.id = monday.user_id
  AND m.year_month = monday.year_month
  AND monday.store_code = 'monday'
LEFT JOIN monthly_attendance_summary friday
  ON p.id = friday.user_id
  AND m.year_month = friday.year_month
  AND friday.store_code = 'friday'
WHERE p.is_active = true;


-- ========================================
-- 完了！
-- ========================================
-- 次のステップ:
-- 1. Supabase Dashboard > Authentication > Providers で Email を有効化
-- 2. Supabase Dashboard > Authentication > URL Configuration でサイトURLを設定
-- 3. 最初の管理者ユーザーを Authentication > Users から手動作成
--    （作成後、SQL Editor で以下を実行して管理者に変更）
--    UPDATE profiles SET role = 'admin' WHERE id = 'ここにユーザーのUUID';
