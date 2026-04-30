#!/usr/bin/env node
/**
 * CLI tool để tạo user account
 * Dùng: node scripts/create-user.js <email> <name> <password> [role]
 * Ví dụ:
 *   node scripts/create-user.js admin@moodbiz.vn "Admin" "MatKhauManh123" admin
 *   node scripts/create-user.js user@moodbiz.vn "Nguyen Van A" "MatKhau456"
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const path   = require('path');

const [,, email, name, password, role = 'member'] = process.argv;

if (!email || !name || !password) {
  console.error('❌ Thiếu tham số!');
  console.error('Dùng: node scripts/create-user.js <email> <name> <password> [role]');
  console.error('role có thể là: admin | member  (mặc định: member)');
  process.exit(1);
}

if (!['admin', 'member'].includes(role)) {
  console.error('❌ role phải là "admin" hoặc "member"');
  process.exit(1);
}

async function main() {
  // Khởi tạo DB (dùng lại schema)
  const { initializeDatabase } = require(path.join(__dirname, '..', 'db', 'schema'));
  await initializeDatabase();

  const { addUser, getUserByEmail } = require(path.join(__dirname, '..', 'db', 'rankings'));

  // Kiểm tra email đã tồn tại chưa
  const existing = await getUserByEmail(email);
  if (existing) {
    console.error(`❌ Email "${email}" đã tồn tại trong database`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await addUser(email, name, passwordHash, role);

  console.log('✅ Tạo user thành công!');
  console.log('─'.repeat(40));
  console.log(`  ID    : ${user.id}`);
  console.log(`  Email : ${user.email}`);
  console.log(`  Tên   : ${user.name}`);
  console.log(`  Role  : ${user.role}`);
  console.log('─'.repeat(40));
  console.log('Người dùng có thể đăng nhập tại https://rank.moodbiz.vn');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
