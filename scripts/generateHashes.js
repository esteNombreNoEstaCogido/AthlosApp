const bcryptjs = require('bcryptjs');

(async () => {
  console.log('🔐 Generating password hashes for initial DB...\n');
  
  const passwords = {
    '1234': 'entrenador, tamara, pivon, sebas2, claudia, blanca',
    '6100': 'sebas'
  };
  
  for (const [pwd, users] of Object.entries(passwords)) {
    const hash = await bcryptjs.hash(pwd, await bcryptjs.genSalt(12));
    console.log(`Password: ${pwd}`);
    console.log(`Hash: ${hash}`);
    console.log(`Users: ${users}\n`);
  }
})();
