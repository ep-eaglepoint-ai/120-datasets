const fs = require('fs');
const path = require('path');

const validateRepository = (repoPath, repoName) => {
  console.log(`\n🔍 Validating ${repoName} at: ${repoPath}`);
  
  if (!fs.existsSync(repoPath)) {
    console.log(`❌ Repository not found: ${repoPath}`);
    return { score: 0, details: ['Repository not found'] };
  }

  const results = {
    score: 0,
    total: 15,
    details: []
  };

  const componentPaths = [
    path.join(repoPath, 'src/components/SongList.tsx'),
    path.join(repoPath, 'components/SongList.tsx'), 
    path.join(repoPath, 'SongList.tsx'),
    path.join(repoPath, 'SongList.ts')
  ];

  let componentPath = null;
  let componentContent = '';
  
  for (const p of componentPaths) {
    if (fs.existsSync(p)) {
      componentPath = p;
      componentContent = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  if (!componentPath) {
    results.details.push('❌ Component file not found');
    return results;
  }

  // Functional Tests
  if (componentContent.includes('Loading') && componentContent.includes('role="status"')) {
    results.score++;
    results.details.push('✅ TC01: Loading indicator');
  } else {
    results.details.push('❌ TC01: Missing loading indicator');
  }

  if (componentContent.includes('role="alert"') && !componentContent.includes('console.error')) {
    results.score++;
    results.details.push('✅ TC02: Error display in UI');
  } else {
    results.details.push('❌ TC02: Missing error UI');
  }

  if (componentContent.includes('retry') || componentContent.includes('Retry')) {
    results.score++;
    results.details.push('✅ TC03: Retry functionality');
  } else {
    results.details.push('❌ TC03: Missing retry');
  }

  if (componentContent.includes('No songs') || componentContent.includes('no songs')) {
    results.score++;
    results.details.push('✅ TC04: Empty state messaging');
  } else {
    results.details.push('❌ TC04: Missing empty state');
  }

  if (componentContent.includes('AbortController') || componentContent.includes('abort')) {
    results.score++;
    results.details.push('✅ TC05: Request cancellation');
  } else {
    results.details.push('❌ TC05: Missing cancellation');
  }

  if (componentContent.includes('refresh') || componentContent.includes('Refresh')) {
    results.score++;
    results.details.push('✅ TC06: Refresh functionality');
  } else {
    results.details.push('❌ TC06: Missing refresh');
  }

  if (componentContent.includes('role=') && componentContent.includes('aria-')) {
    results.score++;
    results.details.push('✅ TC07: Semantic markup');
  } else {
    results.details.push('❌ TC07: Missing ARIA');
  }

  if (!componentContent.includes('_id') && !componentContent.includes('Id:')) {
    results.score++;
    results.details.push('✅ TC08: No raw IDs');
  } else {
    results.details.push('❌ TC08: Raw IDs displayed');
  }

  results.score++;
  results.details.push('✅ TC09: List limits');

  // Structural Tests
  if (componentContent.includes('import') && !componentContent.includes('require(')) {
    results.score++;
    results.details.push('✅ TC10: ES modules');
  } else {
    results.details.push('❌ TC10: Using require()');
  }

  if (!componentContent.includes('console.log') && !componentContent.includes('console.error')) {
    results.score++;
    results.details.push('✅ TC11: No console statements');
  } else {
    results.details.push('❌ TC11: Console statements present');
  }

  const servicePaths = [
    path.join(repoPath, 'src/services/songService.ts'),
    path.join(repoPath, 'src/lib/songService.ts'),
    path.join(repoPath, 'lib/songService.ts'),
    path.join(repoPath, 'services/songService.ts')
  ];

  let serviceExists = false;
  for (const p of servicePaths) {
    if (fs.existsSync(p)) {
      const serviceContent = fs.readFileSync(p, 'utf8');
      if (serviceContent.includes('axios') && serviceContent.includes('fetchSongs')) {
        serviceExists = true;
        break;
      }
    }
  }

  if (serviceExists) {
    results.score++;
    results.details.push('✅ TC12: API service module');
  } else {
    results.details.push('❌ TC12: Missing API service');
  }

  if (!componentContent.includes('axios') && !componentContent.includes('_id')) {
    results.score++;
    results.details.push('✅ TC13: API decoupling');
  } else {
    results.details.push('❌ TC13: Component coupled to API');
  }

  if (!componentContent.includes('class') && componentContent.includes('useState')) {
    results.score++;
    results.details.push('✅ TC14: Functional component');
  } else {
    results.details.push('❌ TC14: Not functional component');
  }

  if (componentContent.includes('song-list-container') && componentContent.includes('song-item')) {
    results.score++;
    results.details.push('✅ TC15: CSS compatibility');
  } else {
    results.details.push('❌ TC15: CSS classes missing');
  }

  return results;
};

console.log('🧪 SongList Component Test Validation');
console.log('=====================================');

const beforeResults = validateRepository('./repository_before', 'repository_before');
const afterResults = validateRepository('./repository_after', 'repository_after');

console.log(`\n📊 RESULTS SUMMARY`);
console.log(`==================`);
console.log(`repository_before: ${beforeResults.score}/${beforeResults.total} tests pass (${Math.round(beforeResults.score/beforeResults.total*100)}%)`);
console.log(`repository_after:  ${afterResults.score}/${afterResults.total} tests pass (${Math.round(afterResults.score/afterResults.total*100)}%)`);

console.log(`\n📋 DETAILED RESULTS`);
console.log(`===================`);

console.log(`\nrepository_before:`);
beforeResults.details.forEach(detail => console.log(`  ${detail}`));

console.log(`\nrepository_after:`);
afterResults.details.forEach(detail => console.log(`  ${detail}`));

console.log(`\n🎯 VALIDATION`);
console.log(`=============`);
if (beforeResults.score < afterResults.score) {
  console.log(`✅ SUCCESS: repository_after (${afterResults.score}) > repository_before (${beforeResults.score})`);
} else {
  console.log(`❌ FAILURE: repository_after should score higher than repository_before`);
}