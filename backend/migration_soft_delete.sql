-- ============================================================
-- FILE: migration_soft_delete.sql
-- PURPOSE: Add soft-delete columns to bills table (SAFE)
-- RUN: mysql -u root -p bill_scanner < migration_soft_delete.sql
--      (or use SOURCE command inside MySQL)
-- ============================================================

USE bill_scanner;

-- ============================================================
-- 1. ADD SOFT DELETE COLUMNS (idempotent — safe to re-run)
-- ============================================================

-- is_deleted
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND COLUMN_NAME  = 'is_deleted'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE bills ADD COLUMN is_deleted TINYINT(1) DEFAULT 0',
    'SELECT "is_deleted column already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- deleted_at
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND COLUMN_NAME  = 'deleted_at'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE bills ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL',
    'SELECT "deleted_at column already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- deleted_by (username)
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND COLUMN_NAME  = 'deleted_by'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE bills ADD COLUMN deleted_by VARCHAR(50) DEFAULT NULL',
    'SELECT "deleted_by column already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- deleted_by_role
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND COLUMN_NAME  = 'deleted_by_role'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE bills ADD COLUMN deleted_by_role VARCHAR(20) DEFAULT NULL',
    'SELECT "deleted_by_role column already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. INDEX for fast recycle bin queries
-- ============================================================
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND INDEX_NAME   = 'idx_bills_is_deleted'
);
SET @sql := IF(@idx_exists = 0,
    'CREATE INDEX idx_bills_is_deleted ON bills(is_deleted)',
    'SELECT "idx_bills_is_deleted already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 3. BACKFILL — all existing bills are NOT deleted
-- ============================================================
UPDATE bills SET is_deleted = 0 WHERE is_deleted IS NULL;

-- ============================================================
-- 4. VERIFY
-- ============================================================
SELECT '✅ Soft-delete migration complete' AS status;
SELECT
    SUM(is_deleted = 0) AS active_bills,
    SUM(is_deleted = 1) AS deleted_bills,
    COUNT(*)            AS total_bills
FROM bills;

SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'bill_scanner'
  AND TABLE_NAME   = 'bills'
  AND COLUMN_NAME IN ('is_deleted','deleted_at','deleted_by','deleted_by_role');