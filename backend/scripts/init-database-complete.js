const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * 完整的数据库初始化脚本
 * 功能：
 * 1. 删除旧数据库（如果存在）
 * 2. 创建新数据库
 * 3. 执行基础schema
 * 4. 运行所有迁移脚本
 */
async function initDatabaseComplete() {
  let connection;

  try {
    console.log('========================================');
    console.log('   数据库完整初始化脚本');
    console.log('========================================\n');

    // 连接到 MySQL 服务器（不指定数据库）
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true  // 允许执行多条 SQL 语句
    });

    console.log('✅ 连接到 MySQL 服务器成功\n');

    const dbName = process.env.DB_NAME || 'campus_trading';

    // 询问是否删除旧数据库
    console.log(`⚠️  警告：将删除数据库 '${dbName}' 及其所有数据！`);
    console.log('   如果数据库不存在，将直接创建新数据库。\n');

    // 删除旧数据库（如果存在）
    try {
      await connection.query(`DROP DATABASE IF EXISTS ${dbName}`);
      console.log(`✅ 已删除旧数据库 '${dbName}'\n`);
    } catch (error) {
      console.log(`ℹ️  数据库 '${dbName}' 不存在，将创建新数据库\n`);
    }

    // 创建新数据库
    await connection.query(`CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 数据库 '${dbName}' 创建成功\n`);

    // 切换到新数据库
    await connection.query(`USE ${dbName}`);

    // 读取并执行 schema.sql
    console.log('📄 执行基础数据库结构...');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    let schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // 按分号分割 SQL 语句，然后过滤掉 CREATE DATABASE 和 USE 语句
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        if (!stmt) return false;
        const upperStmt = stmt.toUpperCase();
        // 过滤掉 CREATE DATABASE 和 USE 语句
        return !upperStmt.startsWith('CREATE DATABASE') && 
               !upperStmt.startsWith('USE ');
      })
      .map(stmt => stmt + ';') // 重新添加分号
      .join('\n');

    // 使用 multipleStatements 选项执行整个 SQL 文件
    // 这样可以确保语句按顺序执行
    try {
      await connection.query(statements);
      console.log('✅ 基础数据库结构创建成功\n');
    } catch (error) {
      // 如果是表或索引已存在的错误，可以忽略（因为使用了 IF NOT EXISTS）
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
          error.code === 'ER_DUP_KEYNAME' ||
          error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  部分表或索引已存在，继续执行...\n');
      } else {
        throw error;
      }
    }

    // 运行所有迁移脚本
    console.log('📦 运行数据库迁移脚本...\n');

    // 1. 添加 role 字段
    console.log('[1/5] 添加用户角色字段...');
    const roleMigrationPath = path.join(__dirname, '..', 'database', 'migration_add_role.sql');
    let roleMigrationSQL = fs.readFileSync(roleMigrationPath, 'utf8');
    // 移除 USE 语句（按分号分割后过滤）
    const roleStatements = roleMigrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        if (!stmt) return false;
        const upperStmt = stmt.toUpperCase();
        return !upperStmt.startsWith('USE ');
      })
      .map(stmt => stmt + ';')
      .join('\n');
    try {
      await connection.query(roleStatements);
      console.log('✅ 用户角色字段添加成功\n');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  role 字段已存在，跳过\n');
      } else {
        throw error;
      }
    }

    // 2. 添加 errands 表
    console.log('[2/5] 创建跑腿任务表...');
    const errandMigrationPath = path.join(__dirname, '..', 'database', 'migration_add_errands.sql');
    let errandMigrationSQL = fs.readFileSync(errandMigrationPath, 'utf8');
    // 移除 USE 语句（按分号分割后过滤）
    const errandStatements = errandMigrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        if (!stmt) return false;
        const upperStmt = stmt.toUpperCase();
        return !upperStmt.startsWith('USE ');
      })
      .map(stmt => stmt + ';')
      .join('\n');
    try {
      await connection.query(errandStatements);
      console.log('✅ 跑腿任务表创建成功\n');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('ℹ️  errands 表已存在，跳过\n');
      } else {
        throw error;
      }
    }

    // 3. 添加 conversations 和 messages 表
    console.log('[3/5] 创建对话功能表...');
    const conversationMigrationPath = path.join(__dirname, '..', 'database', 'migration_add_conversations.sql');
    let conversationMigrationSQL = fs.readFileSync(conversationMigrationPath, 'utf8');
    // 移除 USE 语句（按分号分割后过滤）
    const conversationStatements = conversationMigrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        if (!stmt) return false;
        const upperStmt = stmt.toUpperCase();
        return !upperStmt.startsWith('USE ');
      })
      .map(stmt => stmt + ';')
      .join('\n');
    try {
      await connection.query(conversationStatements);
      console.log('✅ 对话功能表创建成功\n');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  对话功能表已存在，跳过\n');
      } else {
        throw error;
      }
    }

    // 4. 添加用户头像字段
    console.log('[4/5] 添加用户头像字段...');
    const addAvatarScript = require('./add-user-avatar-field.js');
    try {
      await addAvatarScript();
      console.log('✅ 用户头像字段添加成功\n');
    } catch (error) {
      // 如果字段已存在，跳过
      if (error.message && (error.message.includes('已存在') || error.code === 'ER_DUP_FIELDNAME')) {
        console.log('ℹ️  用户头像字段已存在，跳过\n');
      } else {
        throw error;
      }
    }

    // 5. 添加商品购买相关字段
    console.log('[5/5] 添加商品购买相关字段...');
    const addBuyerColumnsScript = require('./add-item-buyer-columns.js');
    try {
      await addBuyerColumnsScript();
      console.log('✅ 商品购买相关字段添加成功\n');
    } catch (error) {
      // 如果字段已存在，跳过
      if (error.message && (error.message.includes('已存在') || error.code === 'ER_DUP_FIELDNAME')) {
        console.log('ℹ️  商品购买相关字段已存在，跳过\n');
      } else {
        throw error;
      }
    }

    console.log('========================================');
    console.log('   ✅ 数据库初始化完成！');
    console.log('========================================\n');
    console.log('数据库名称:', dbName);
    console.log('已创建的表:');
    console.log('  - users (用户表)');
    console.log('  - items (商品表)');
    console.log('  - errands (跑腿任务表)');
    console.log('  - conversations (会话表)');
    console.log('  - messages (消息表)');
    console.log('\n提示：可以运行 npm run create-admin 创建管理员账户\n');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.error('完整错误信息:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

// 只有直接运行此文件时才执行初始化
if (require.main === module) {
  initDatabaseComplete();
}

module.exports = initDatabaseComplete;

