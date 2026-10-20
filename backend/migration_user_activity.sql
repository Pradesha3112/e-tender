-- ============================================================
-- FILE: migration_user_activity.sql
-- PURPOSE: Create user_activity table for login/logout tracking
-- RUN: mysql -u root -p bill_scanner < migration_user_activity.sql
-- ============================================================

USE bill_scanner;

-- ============================================================
-- 1. USER ACTIVITY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_activity (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL,
    full_name       VARCHAR(100) DEFAULT NULL,
    role            VARCHAR(20)  NOT NULL,
    category_group  VARCHAR(20)  NOT NULL,
    login_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    logout_at       TIMESTAMP    NULL DEFAULT NULL,
    is_active       TINYINT(1)   DEFAULT 1,
    INDEX idx_activity_username  (username),
    INDEX idx_activity_login_at  (login_at),
    INDEX idx_activity_active    (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. VERIFY
-- ============================================================
SELECT '✅ user_activity table created' AS status;
SHOW COLUMNS FROM user_activity;