-- =============================================
-- 休憩3回対応マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. 既存カラムをリネーム（break_start → break1_start, break_end → break1_end）
ALTER TABLE attendances RENAME COLUMN break_start TO break1_start;
ALTER TABLE attendances RENAME COLUMN break_end TO break1_end;

-- 2. 休憩2・3のカラムを追加
ALTER TABLE attendances ADD COLUMN break2_start timestamptz;
ALTER TABLE attendances ADD COLUMN break2_end timestamptz;
ALTER TABLE attendances ADD COLUMN break3_start timestamptz;
ALTER TABLE attendances ADD COLUMN break3_end timestamptz;

-- 3. 勤務時間計算トリガーを更新（3回休憩対応）
CREATE OR REPLACE FUNCTION calculate_work_minutes()
RETURNS TRIGGER AS $$
DECLARE
  total_break integer := 0;
BEGIN
  IF NEW.clock_in IS NOT NULL AND NEW.clock_out IS NOT NULL THEN
    -- 総勤務時間（分）
    NEW.work_minutes := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 60;

    -- 休憩1
    IF NEW.break1_start IS NOT NULL AND NEW.break1_end IS NOT NULL THEN
      total_break := total_break + EXTRACT(EPOCH FROM (NEW.break1_end - NEW.break1_start)) / 60;
    END IF;

    -- 休憩2
    IF NEW.break2_start IS NOT NULL AND NEW.break2_end IS NOT NULL THEN
      total_break := total_break + EXTRACT(EPOCH FROM (NEW.break2_end - NEW.break2_start)) / 60;
    END IF;

    -- 休憩3
    IF NEW.break3_start IS NOT NULL AND NEW.break3_end IS NOT NULL THEN
      total_break := total_break + EXTRACT(EPOCH FROM (NEW.break3_end - NEW.break3_start)) / 60;
    END IF;

    NEW.break_minutes := total_break;
    NEW.work_minutes := NEW.work_minutes - total_break;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
