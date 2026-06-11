const { execSync } = require('child_process');
const fs = require('fs');

let success = false;
let maxTries = 30;

while (!success && maxTries > 0) {
  try {
    console.log('Running build...');
    execSync('npm run build', { stdio: 'pipe' });
    success = true;
    console.log('Build succeeded!');
  } catch (error) {
    const output = error.stdout.toString() + error.stderr.toString();
    const match = output.match(/src[\\/]components[\\/]family-app\.tsx:(\d+):\d+\nExpected ',', got ';'/);
    if (match) {
      const lineNumber = parseInt(match[1], 10);
      console.log('Fixing line:', lineNumber);
      const lines = fs.readFileSync('src/components/family-app.tsx', 'utf8').split('\n');
      if (lines[lineNumber - 1].includes('</div>;')) {
        lines[lineNumber - 1] = lines[lineNumber - 1].replace('</div>;', '</div>\r\n  );');
        fs.writeFileSync('src/components/family-app.tsx', lines.join('\n'));
      } else if (lines[lineNumber - 1].includes('};')) {
        lines[lineNumber - 1] = lines[lineNumber - 1].replace('};', '}\r\n  );');
        fs.writeFileSync('src/components/family-app.tsx', lines.join('\n'));
      } else {
        console.log('Unexpected line content at ' + lineNumber + ': ' + lines[lineNumber-1]);
        break;
      }
    } else {
      const expMatch = output.match(/src[\\/]components[\\/]family-app\.tsx:(\d+):\d+\nExpression expected/);
      if (expMatch) {
         const lineNumber = parseInt(expMatch[1], 10);
         console.log('Fixing expression expected at line:', lineNumber);
         const lines = fs.readFileSync('src/components/family-app.tsx', 'utf8').split('\n');
         if (lines[lineNumber - 1].includes(');')) {
           lines[lineNumber - 1] = lines[lineNumber - 1].replace(');', '</div>;');
           fs.writeFileSync('src/components/family-app.tsx', lines.join('\n'));
         } else {
            console.log('Unexpected line content at ' + lineNumber + ': ' + lines[lineNumber-1]);
            break;
         }
      } else {
         console.log('Unknown error:', output);
         break;
      }
    }
    maxTries--;
  }
}
