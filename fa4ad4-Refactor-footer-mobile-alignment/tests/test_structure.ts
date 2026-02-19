import fs from 'fs';
import path from 'path';

// --- Test Runner Configuration ---
const CONFIG = {
  maxLinesFooter: 100, // Strict limit to enforce refactoring (Before: 100, After: 99)
};

class TestRunner {
  private total = 0;
  private passed = 0;
  private failed = 0;
  private results: { name: string; status: 'PASS' | 'FAIL'; error?: string }[] = [];

  async run(name: string, testFn: () => void | Promise<void>) {
    this.total++;
      process.stdout.write(`running '${name}' ... `);
    try {
      await testFn();
      this.passed++;
      console.log(`[PASS] ${name}`);
      this.results.push({ name, status: 'PASS' });
    } catch (error: any) {
      this.failed++;
      console.log(`[FAIL] ${name}`);
      console.log(`  └─ ${error.message}`);
      this.results.push({ name, status: 'FAIL', error: error.message });
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    
    this.results.forEach((res, index) => {
        const icon = res.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} [${index + 1}/${this.total}] ${res.name}`);
    });

    console.log('-'.repeat(50));
    console.log(`Total: ${this.total} | Passed: ${this.passed} | Failed: ${this.failed}`);
    console.log(`Success Rate: ${((this.passed / this.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    if (this.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

// --- Setup ---
const REPO = process.env.REPO || 'repository_after';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPO_PATH = path.join(PROJECT_ROOT, REPO, 'demo-app');

console.log(`\n🔍 Starting Structural Validation for: ${REPO}`);
console.log(`📂 Path: ${REPO_PATH}\n`);

const runner = new TestRunner();

// --- Tests ---

async function main() {
  const isBefore = REPO.includes('repository_before');

  if (isBefore) {
     // --- TESTS FOR REPOSITORY_BEFORE (Should FAIL - missing TypeScript migration) ---

     await runner.run('Structure: TypeScript Configuration', () => {
         // This should FAIL in before (no tsconfig)
         const requiredFiles = ['tsconfig.json', 'vite.config.ts', 'tailwind.config.ts'];
         const missing = requiredFiles.filter(f => !fs.existsSync(path.join(REPO_PATH, f)));
         
         if (missing.length > 0) {
           throw new Error(`Missing TypeScript config files: ${missing.join(', ')}. Project must be fully TypeScript.`);
         }
     });

     await runner.run('Structure: No JavaScript Source Files', () => {
         // This should FAIL in before (has .jsx files)
         const srcDir = path.join(REPO_PATH, 'src');
         if (!fs.existsSync(srcDir)) throw new Error('src directory missing');

         const findJsFiles = (dir: string): string[] => {
           let results: string[] = [];
           const list = fs.readdirSync(dir);
           for (const file of list) {
             const filePath = path.join(dir, file);
             const stat = fs.statSync(filePath);
             if (stat && stat.isDirectory()) {
               results = results.concat(findJsFiles(filePath));
             } else {
               if (file.endsWith('.js') || file.endsWith('.jsx')) {
                 results.push(filePath);
               }
             }
           }
           return results;
         };

         const jsFiles = findJsFiles(srcDir);
         if (jsFiles.length > 0) {
           const relativePaths = jsFiles.map(p => path.relative(REPO_PATH, p));
           throw new Error(`Found Legacy JavaScript files: ${relativePaths.join(', ')}. Migration to .ts/.tsx is incomplete.`);
         }
     });

     await runner.run('Dependencies: TypeScript Installed', () => {
         // This should FAIL in before (no typescript dependency)
         const pkgPath = path.join(REPO_PATH, 'package.json');
         if (!fs.existsSync(pkgPath)) throw new Error('package.json missing');
         
         const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
         const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
         
         if (!allDeps['typescript']) {
             throw new Error('Dependency "typescript" is missing.');
         }
     });

     await runner.run('Refactor Quality: Footer Component (TSX)', () => {
         // This should FAIL in before (Footer.jsx, not Footer.tsx)
         const footerTsx = path.join(REPO_PATH, 'src/components/Footer.tsx');
         if (!fs.existsSync(footerTsx)) throw new Error('Footer.tsx not found. Must be converted to TypeScript.');

         const content = fs.readFileSync(footerTsx, 'utf-8');
         const lineCount = content.split('\n').length;
         
         if (lineCount >= CONFIG.maxLinesFooter) {
             throw new Error(`Footer component is too long (${lineCount} lines). Goal is < ${CONFIG.maxLinesFooter} lines.`);
         }
     });

  } else {
      // --- TESTS FOR REPOSITORY_AFTER (Should confirm it is REFACTORED) ---

      await runner.run('Structure: TypeScript Configuration', () => {
        // Assert strictly that we are a TypeScript project
        const requiredFiles = ['tsconfig.json', 'vite.config.ts', 'tailwind.config.ts'];
        const missing = requiredFiles.filter(f => !fs.existsSync(path.join(REPO_PATH, f)));
        
        if (missing.length > 0) {
          throw new Error(`Missing TypeScript config files: ${missing.join(', ')}. Project must be fully TypeScript.`);
        }
      });

      await runner.run('Structure: No JavaScript Source Files', () => {
        const srcDir = path.join(REPO_PATH, 'src');
        if (!fs.existsSync(srcDir)) throw new Error('src directory missing');

        const findJsFiles = (dir: string): string[] => {
          let results: string[] = [];
          const list = fs.readdirSync(dir);
          for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
              results = results.concat(findJsFiles(filePath));
            } else {
              if (file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(filePath);
              }
            }
          }
          return results;
        };

        const jsFiles = findJsFiles(srcDir);
        if (jsFiles.length > 0) {
          const relativePaths = jsFiles.map(p => path.relative(REPO_PATH, p));
          throw new Error(`Found Legacy JavaScript files: ${relativePaths.join(', ')}. Migration to .ts/.tsx is incomplete.`);
        }
      });

      await runner.run('Dependencies: TypeScript Installed', () => {
        const pkgPath = path.join(REPO_PATH, 'package.json');
        if (!fs.existsSync(pkgPath)) throw new Error('package.json missing');
        
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (!allDeps['typescript']) {
            throw new Error('Dependency "typescript" is missing.');
        }
      });

      await runner.run('Refactor Quality: Footer Component Length', () => {
        const footerTsx = path.join(REPO_PATH, 'src/components/Footer.tsx');
        if (!fs.existsSync(footerTsx)) throw new Error('Footer.tsx not found');

        const content = fs.readFileSync(footerTsx, 'utf-8');
        const lineCount = content.split('\n').length;
        
        if (lineCount >= CONFIG.maxLinesFooter) {
            throw new Error(`Footer component is too long (${lineCount} lines). Goal is < ${CONFIG.maxLinesFooter} lines.`);
        }
      });
  }

  runner.printSummary();
}

main().catch(console.error);
