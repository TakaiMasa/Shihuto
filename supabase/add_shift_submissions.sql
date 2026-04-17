-- =============================================
-- shift_submissions テーブル追加
-- スタッフがシフトを提出したことを記録する
-- =============================================

-- shift_submissions（シフト提出記録）
CREATE TABLE IF NOT EXISTS shift_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year_month text NOT NULL,  -- 'YYYY-MM' 形式
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year_month)
);

-- RLS有効化
ALTER TABLE shift_submissions ENABLE ROW LEVEL SECURITY;

-- スタッフは自分のデータのみ読み書き可
CREATE POLICY "shift_submissions_self" ON shift_submissions
  FOR ALL USING (auth.uid() = user_id);

-- 管理者は全件読み取り可
CREATE POLICY "shift_submissions_admin_read" ON shift_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
