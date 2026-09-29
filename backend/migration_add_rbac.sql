-- ============================================================
-- FILE: migration_add_rbac.sql
-- PURPOSE: Add RBAC tables and columns (SAFE, NON-DESTRUCTIVE)
-- RUN: mysql -u root -p bill_scanner < migration_add_rbac.sql
-- ============================================================

USE bill_scanner;

-- ============================================================
-- 1. USERS TABLE (new — does not affect existing tables)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(100) NOT NULL,
    role            ENUM('admin','super_admin','clerk') NOT NULL,
    category_group  ENUM('all','adfm_1','adfm_2') DEFAULT 'all',
    created_by      VARCHAR(50)  DEFAULT NULL,
    is_active       TINYINT(1)   DEFAULT 1,
    designation     VARCHAR(100) DEFAULT NULL,
    phone           VARCHAR(20)  DEFAULT NULL,
    email           VARCHAR(100) DEFAULT NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    last_login      TIMESTAMP    NULL DEFAULT NULL,
    INDEX idx_users_role       (role),
    INDEX idx_users_active     (is_active),
    INDEX idx_users_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. EXTEND bills TABLE (only adds columns, no data loss)
-- ============================================================
-- Check and add each column individually (MySQL-safe pattern)

-- category
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND COLUMN_NAME  = 'category'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE bills ADD COLUMN category VARCHAR(150) DEFAULT NULL',
    'SELECT "category column already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_by
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND COLUMN_NAME  = 'created_by'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE bills ADD COLUMN created_by VARCHAR(50) DEFAULT "admin"',
    'SELECT "created_by column already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_by_role
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND COLUMN_NAME  = 'created_by_role'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE bills ADD COLUMN created_by_role VARCHAR(20) DEFAULT "admin"',
    'SELECT "created_by_role column already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- category_group
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND COLUMN_NAME  = 'category_group'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE bills ADD COLUMN category_group VARCHAR(20) DEFAULT "all"',
    'SELECT "category_group column already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 3. INDEXES on new bills columns (for fast role filtering)
-- ============================================================
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND INDEX_NAME   = 'idx_bills_created_by'
);
SET @sql := IF(@idx_exists = 0,
    'CREATE INDEX idx_bills_created_by ON bills(created_by)',
    'SELECT "idx_bills_created_by already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'bill_scanner'
      AND TABLE_NAME   = 'bills'
      AND INDEX_NAME   = 'idx_bills_category_group'
);
SET @sql := IF(@idx_exists = 0,
    'CREATE INDEX idx_bills_category_group ON bills(category_group)',
    'SELECT "idx_bills_category_group already exists" AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 4. BACKFILL existing bills with safe defaults
--    (so they remain visible to admin only)
-- ============================================================
UPDATE bills 
SET 
    created_by      = COALESCE(created_by, 'admin'),
    created_by_role = COALESCE(created_by_role, 'admin'),
    category_group  = COALESCE(category_group, 'all')
WHERE created_by IS NULL 
   OR created_by_role IS NULL 
   OR category_group IS NULL;

-- ============================================================
-- 5. SEED the admin user in the users table
--    (admin login is still hardcoded, this is only for reference)
-- ============================================================
INSERT INTO users 
    (username, password_hash, full_name, role, category_group, designation)
VALUES
    ('admin',
     'ADMIN_HARDCODED_NO_HASH',
     'System Administrator',
     'admin',
     'all',
     'System Administrator')
ON DUPLICATE KEY UPDATE 
    full_name = 'System Administrator';

-- ============================================================
-- 6. VERIFY
-- ============================================================
SELECT '✅ Migration complete' AS status;
SELECT COUNT(*) AS users_count FROM users;
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'bill_scanner'
  AND TABLE_NAME   = 'bills'
  AND COLUMN_NAME IN ('category','created_by','created_by_role','category_group');