const { query } = require('../config/db');

let ensuringUserColumnsPromise = null;

const ensureUserProfileColumns = async () => {
  if (ensuringUserColumnsPromise) {
    return ensuringUserColumnsPromise;
  }

  ensuringUserColumnsPromise = (async () => {
    try {
      const [phoneColumns] = await query("SHOW COLUMNS FROM users LIKE 'phone'");
      const [collegeColumns] = await query("SHOW COLUMNS FROM users LIKE 'college'");

      if (phoneColumns.length === 0) {
        await query(`
          ALTER TABLE users
          ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER password_hash
        `);
        console.log('✅ 已自动添加 users.phone 字段');
      }

      if (collegeColumns.length === 0) {
        await query(`
          ALTER TABLE users
          ADD COLUMN college VARCHAR(100) DEFAULT NULL AFTER phone
        `);
        console.log('✅ 已自动添加 users.college 字段');
      }
    } catch (error) {
      console.error('❌ 确保用户资料字段存在时出错:', error);
      throw error;
    }
  })().finally(() => {
    ensuringUserColumnsPromise = null;
  });

  return ensuringUserColumnsPromise;
};

module.exports = {
  ensureUserProfileColumns
};


