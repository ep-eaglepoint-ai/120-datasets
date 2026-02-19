const path = require('path');
const fs = require('fs');

const getTargetPath = () => {
  return process.env.TARGET_PATH || './repository_after';
};

const TARGET_PATH = getTargetPath();

const readSourceFiles = () => {
  const files = [];
  const searchDirs = [
    path.join(TARGET_PATH, 'src'),
    path.join(TARGET_PATH, 'components'),
    TARGET_PATH
  ];
  
  searchDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const dirFiles = fs.readdirSync(dir, { recursive: true })
        .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
        .map(file => path.join(dir, file));
      files.push(...dirFiles);
    }
  });
  
  return files.map(file => ({
    path: file,
    content: fs.readFileSync(file, 'utf8')
  }));
};

const findService = () => {
  const possiblePaths = [
    path.join(TARGET_PATH, 'src/services/songService.ts'),
    path.join(TARGET_PATH, 'src/lib/songService.ts'),
    path.join(TARGET_PATH, 'lib/songService.ts'),
    path.join(TARGET_PATH, 'services/songService.ts')
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
};

describe('Structural Tests - Code Architecture', () => {
  beforeAll(() => {
    // Clear require cache to prevent Docker persistence issues
    Object.keys(require.cache).forEach(key => {
      if (key.includes('SongList') || key.includes('songService')) {
        delete require.cache[key];
      }
    });
  });
  
  test('TC10: Uses ES module imports instead of require', () => {
    const sourceFiles = readSourceFiles();
    
    sourceFiles.forEach(file => {
      expect(file.content).not.toMatch(/const\s+.*=\s+require\(/);
      expect(file.content).not.toMatch(/require\(['"`][^'"`]+['"`]\)/);
      
      if (file.content.includes('axios') || file.content.includes('react')) {
        expect(file.content).toMatch(/import.*from/);
      }
    });
  });

  test('TC11: Removes all console statements', () => {
    const sourceFiles = readSourceFiles();
    
    sourceFiles.forEach(file => {
      expect(file.content).not.toMatch(/console\.(log|error)/);
    });
  });

  test('TC12: API service with TypeScript types', () => {
    const servicePath = findService();
    expect(servicePath).toBeTruthy();
    
    if (servicePath) {
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      
      expect(serviceContent).toMatch(/import.*axios/);
      expect(serviceContent).toMatch(/export.*fetchSongs/);
      expect(serviceContent).toMatch(/:\s*(Promise<|Song\[\]|AbortSignal)/);
    }
  });

  test('TC13: API decoupling and React patterns', () => {
    const sourceFiles = readSourceFiles();
    const componentFile = sourceFiles.find(f => f.path.includes('SongList'));
    
    if (componentFile) {
      expect(componentFile.content).toMatch(/useState|useEffect|useCallback/);
      expect(componentFile.content).not.toMatch(/\._id/);
    }
  });

  test('TC14: Functional component with hooks', () => {
    const sourceFiles = readSourceFiles();
    const componentFile = sourceFiles.find(f => f.path.includes('SongList'));
    
    if (componentFile) {
      expect(componentFile.content).not.toMatch(/class.*extends.*Component/);
      expect(componentFile.content).not.toMatch(/render\(\)/);
      expect(componentFile.content).toMatch(/const.*SongList.*=.*\(/);
    }
  });
});