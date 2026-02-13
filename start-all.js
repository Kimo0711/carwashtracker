const { spawn } = require('child_process');

console.log('🚀 Starting Car Wash Dashboard...');
const nextApp = spawn('npm', ['run', 'start'], { stdio: 'inherit', shell: true });

console.log('🤖 Starting Telegram Bot...');
const bot = spawn('node', ['bot.js'], { stdio: 'inherit', shell: true });

nextApp.on('close', (code) => {
    console.log(`Dashboard exited with code ${code}`);
    process.exit(code);
});

bot.on('close', (code) => {
    console.log(`Bot exited with code ${code}`);
    process.exit(code);
});
