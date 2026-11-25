-- Bảng điểm mẫu dùng chung cho bản demo Campus LMS.
CREATE DATABASE IF NOT EXISTS lms CHARACTER SET utf8mb4;
USE lms;

CREATE TABLE IF NOT EXISTS demo_grades (
    course_code VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    score DECIMAL(3,1) NOT NULL,
    CONSTRAINT chk_demo_grades_score CHECK (score BETWEEN 0 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
