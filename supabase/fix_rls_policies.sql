-- =============================================
-- RLSポリシー修正マイグレーション
--
-- 問題: 管理者ポリシーがprofilesテーブルを自己参照しており、
-- RLSの循環参照により管理者が他ユーザーのデータを読み取れない。
--
-- 修正: SECURITY DEFINER関数 is_admin() を作成し、
-- 全ポリシーをこの関数に置き換える。
--
-- Supabase Dashboard > SQL Editor で実行してください。
-- =============================================


-- ========================================
-- 1. SECURITY DEFINER 関数の作成
-- ========================================

-- RLSをバイパスして管理者かどうかを判定する関数
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
-- 2. profiles テーブルのポリシー修正
-- ========================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (public.is_admin());


-- ========================================
-- 3. stores テーブルのポリシー修正
-- ========================================

DROP POLICY IF EXISTS "Admins can manage stores" ON stores;

CREATE POLICY "Admins can manage stores" ON stores
  FOR ALL USING (public.is_admin());


-- ========================================
-- 4. shift_unavailable テーブルのポリシー修正
-- ========================================

DROP POLICY IF EXISTS "Admins can view all unavailable" ON shift_unavailable;

CREATE POLICY "Admins can view all unavailable" ON shift_unavailable
  FOR SELECT USING (public.is_admin());


-- ========================================
-- 5. shifts テーブルのポリシー修正
-- ========================================

DROP POLICY IF EXISTS "Admins can manage shifts" ON shifts;

CREATE POLICY "Admins can manage shifts" ON shifts
  FOR ALL USING (public.is_admin());


-- ========================================
-- 6. attendances テーブルのポリシー修正
-- ========================================

DROP POLICY IF EXISTS "Admins can manage all attendances" ON attendances;

CREATE POLICY "Admins can manage all attendances" ON attendances
  FOR ALL USING (public.is_admin());


-- ========================================
-- 7. salaries テーブルのポリシー修正
-- ========================================

DROP POLICY IF EXISTS "Admins can manage all salaries" ON salaries;

CREATE POLICY "Admins can manage all salaries" ON salaries
  FOR ALL USING (public.is_admin());


-- ========================================
-- 完了！
-- ========================================
-- これにより、is_admin() 関数が SECURITY DEFINER で実行され、
-- RLSの循環参照問題が解消されます。
-- 管理者は全テーブルのデータを正しく読み書きできるようになります。
