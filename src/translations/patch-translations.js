#!/usr/bin/env node
// patch-translations.js
// Run once to add the "logout" key to every translation file.
// Usage: node patch-translations.js  (from the project root / translations folder)

const fs   = require('fs');
const path = require('path');

// Adjust this to point at your translations directory
const TRANS_DIR = path.resolve(__dirname);

const logoutMap = {
  en: 'Logout',
  hi: 'लॉग आउट',
  mr: 'लॉग आउट',
  kn: 'ಲಾಗ್ ಔಟ್',
  ta: 'வெளியேறு',
  ml: 'ലോഗ് ഔട്ട്',
  ja: 'ログアウト',
  zh: '退出登录',
  ar: 'تسجيل الخروج',
  fr: 'Déconnexion',
  de: 'Abmelden',
  es: 'Cerrar sesión',
};

Object.entries(logoutMap).forEach(([lang, value]) => {
  const filePath = path.join(TRANS_DIR, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${lang}.json not found — skipped`);
    return;
  }
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (obj.logout) {
    console.log(`✅  ${lang}.json already has "logout" — skipped`);
    return;
  }
  obj.logout = value;
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  console.log(`✔   ${lang}.json — added "logout": "${value}"`);
});

console.log('\nDone.');