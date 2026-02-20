const { spawn } = require('child_process');

console.log('🚀 Starting Car Wash Dashboard...');
const nextApp = spawn('npm', ['run', 'start'], { stdio: 'inherit', shell: true });

nextApp.on('close', (code) => {
    console.log(`Dashboard exited with code ${code}`);
    process.exit(code);
});
