const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git' && f !== '.vscode' && f !== '.codebuddy') {
        walkDir(dirPath, callback);
      }
    } else {
      if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.md') || f.endsWith('.js')) {
        callback(dirPath);
      }
    }
  });
}

const patterns = [
  // Claude Code mentions
  { regex: /Inspired by Claude Code'?s?/gi, replacement: "Advanced enterprise architecture for" },
  { regex: /Claude Code-inspired/gi, replacement: "Enterprise-grade" },
  { regex: /Claude Code inspired/gi, replacement: "Enterprise-grade" },
  { regex: /Claude Code-style/gi, replacement: "Standard" },
  { regex: /like Claude Code'?s?/gi, replacement: "natively" },
  { regex: /like Claude Code/gi, replacement: "natively" },
  { regex: /Claude Code parity/gi, replacement: "Enterprise parity" },
  { regex: /Claude Code compatibility/gi, replacement: "Standard compatibility" },
  { regex: /Claude Code convention/gi, replacement: "Standard convention" },
  { regex: /Claude Code/gi, replacement: "Native Engine" }, // Catch remaining, might need manual check but safe for comments

  // OpenClaw mentions
  { regex: /Inspired by OpenClaw'?s?/gi, replacement: "Advanced enterprise architecture for" },
  { regex: /OpenClaw-inspired/gi, replacement: "Enterprise-grade" },
  { regex: /OpenClaw inspired/gi, replacement: "Enterprise-grade" },
  { regex: /OpenClaw-aligned/gi, replacement: "Enterprise-aligned" },
  { regex: /OpenClaw alignment/gi, replacement: "Enterprise alignment" },
  { regex: /OpenClaw native/gi, replacement: "Native" },
  { regex: /OpenClaw format/gi, replacement: "Standard format" },
  { regex: /OpenClaw pattern/gi, replacement: "Standard pattern" },
  { regex: /OpenClaw metadata/gi, replacement: "Standard metadata" },
  { regex: /OpenClaw/gi, replacement: "Native Engine" }
];

let modifiedCount = 0;

['src', 'cowork', 'docs', 'README.md'].forEach(dir => {
    walkDir(dir, function(filePath) {
      let content = fs.readFileSync(filePath, 'utf8');
      let original = content;
      
      for (let p of patterns) {
        content = content.replace(p.regex, p.replacement);
      }
      
      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Cleaned:', filePath);
        modifiedCount++;
      }
    });
});

console.log(`Finished cleaning ${modifiedCount} files.`);
