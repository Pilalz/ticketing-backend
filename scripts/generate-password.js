const bcrypt = require('bcryptjs');

// Script untuk generate password hash
// Password: admin123

const generateHash = async () => {
  const password = 'admin123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nGunakan hash ini untuk update database:');
  console.log(`UPDATE users SET password = '${hash}' WHERE username = 'secretary';`);
  console.log(`UPDATE users SET password = '${hash}' WHERE username = 'director';`);
};

generateHash();
