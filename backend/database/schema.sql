-- Bảng điểm mẫu dùng chung cho bản demo Campus LMS.
CREATE DATABASE IF NOT EXISTS lms CHARACTER SET utf8mb4;
USE lms;

CREATE TABLE IF NOT EXISTS demo_grades (
    course_code VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    score DECIMAL(3,1) NOT NULL,
    CONSTRAINT chk_demo_grades_score CHECK (score BETWEEN 0 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Một dòng cho mỗi lần vào LMS qua Microsoft SSO.
CREATE TABLE IF NOT EXISTS login_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    token_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    user_oid CHAR(36) CHARACTER SET ascii NOT NULL,
    username VARCHAR(320),
    logged_in_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
    INDEX idx_login_history_user_time (user_oid, logged_in_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
