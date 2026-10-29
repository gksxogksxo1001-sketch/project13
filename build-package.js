/**
 * build-package.js — 과제 BR-B 제출용 실행 묶음(ZIP) 생성 스크립트 (비밀번호 없음 · BRB-C22)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ZIP_NAME = 'project13_submission_package.zip';
const targetZip = path.resolve(__dirname, ZIP_NAME);

if (fs.existsSync(targetZip)) {
  fs.unlinkSync(targetZip);
}

console.log('📦 Creating project13 submission zip package...');
const psCommand = `$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path 'index.html', 'style.css', 'app.js', 'verify-app.js', 'README.md', 'package.json', '.env.example', 'data', 'doc' -DestinationPath '${ZIP_NAME}' -Force`;

try {
  execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
  const stat = fs.statSync(targetZip);
  console.log(`✅ Successfully created ${ZIP_NAME} (${(stat.size / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('❌ ZIP creation failed:', err);
  process.exit(1);
}
