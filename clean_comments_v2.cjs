const fs = require('fs');
const path = require('path');

function processPath(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  
  if (stat.isDirectory()) {
    if (path.basename(targetPath) === 'node_modules' || 
        path.basename(targetPath) === 'dist' || 
        path.basename(targetPath) === '.git' || 
        path.basename(targetPath) === '.vscode' || 
        path.basename(targetPath) === '.codebuddy') {
      return;
    }
    fs.readdirSync(targetPath).forEach(f => {
      processPath(path.join(targetPath, f));
    });
  } else {
    if (targetPath.endsWith('.ts') || targetPath.endsWith('.tsx') || targetPath.endsWith('.md') || targetPath.endsWith('.js') || targetPath.endsWith('.json') || targetPath.endsWith('.html')) {
      cleanFile(targetPath);
    }
  }
}

const patterns = [
  // Claude Code
  { regex: /Inspired by Claude Code'?s?/gi, replacement: "Advanced enterprise architecture for" },
  { regex: /Claude Code-inspired/gi, replacement: "Enterprise-grade" },
  { regex: /Claude Code inspired/gi, replacement: "Enterprise-grade" },
  { regex: /Claude Code-style/gi, replacement: "Standard" },
  { regex: /\(Claude Code-style\)/gi, replacement: "" },
  { regex: /like Claude Code'?s?/gi, replacement: "natively" },
  { regex: /like Claude Code/gi, replacement: "natively" },
  { regex: /Claude Code parity/gi, replacement: "Enterprise parity" },
  { regex: /Claude Code compatibility/gi, replacement: "Standard compatibility" },
  { regex: /Claude Code convention/gi, replacement: "Standard convention" },
  { regex: /Claude Code/gi, replacement: "Native Engine" },
  
  // OpenClaw
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

function cleanFile(filePath) {
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
}

['src', 'cowork', 'docs', 'docs-generated-full', 'tests', 'README.md', 'package.json'].forEach(target => {
    processPath(target);
});

console.log(`Finished cleaning ${modifiedCount} files.`);
