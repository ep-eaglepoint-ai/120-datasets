const path = require('path');
const repoPath = process.env.REPO_PATH || 'repository_after';
const { processContentStream } = require(path.join('..', repoPath, 'processContentStream'));

function runBenchmark() {
  console.log("Starting Benchmark...");

  const rules = [];
  for (let i = 0; i < 50000; i++) {
    rules.push({
      token: `token${i}`,
      category: `cat${i % 10}`,
      riskLevel: Math.floor(Math.random() * 10),
      isActive: true,
      expiresAt: '2099-01-01',
      targetRegions: ['US', 'EU'],
    });
  }

  const events = [];
  for (let i = 0; i < 10000; i++) {
    events.push({
      id: `evt-${i}`,
      body: `This is a message containing token${Math.floor(Math.random() * 50000)} and maybe some other stuff.`,
      region: (i % 2 === 0) ? 'US' : 'EU',
      timestamp: Date.now(),
    });
  }

  processContentStream(events.slice(0, 100), rules.slice(0, 1000));

  const start = Date.now();
  const result = processContentStream(events, rules);
  const end = Date.now();

  const duration = end - start;
  console.log(`Processed 10,000 events vs 50,000 rules in ${duration}ms`);
  console.log(`Results length: ${result.length}`);

  if (duration < 250) {
    console.log("Performance SLA PASSED (< 250ms)");
  } else {
    console.log("Performance SLA FAILED (> 250ms)");
  }

  const overlapRules = [
    { token: 'super', category: 'a', riskLevel: 1, isActive: true, expiresAt: '2099-01-01', targetRegions: ['US'] },
    { token: 'man', category: 'b', riskLevel: 2, isActive: true, expiresAt: '2099-01-01', targetRegions: ['US'] },
    { token: 'superman', category: 'c', riskLevel: 3, isActive: true, expiresAt: '2099-01-01', targetRegions: ['US'] },
  ];
  const overlapEvents = [{ id: 'e1', body: 'superman', region: 'US', timestamp: 123 }];
  const overlapResult = processContentStream(overlapEvents, overlapRules);
  
  console.log("Overlap Result Categories:", overlapResult[0].categories);
  const cats = overlapResult[0].categories.split(',');
  if (cats.includes('a') && cats.includes('b') && cats.includes('c') && overlapResult[0].riskScore === 3) {
    console.log("Overlap Detection: PASSED");
  } else {
    console.log("Overlap Detection: FAILED");
  }

  const normEvents = [{ id: 'e2', body: 'S.U!PERMAN', region: 'US', timestamp: 124 }];
  const normResult = processContentStream(normEvents, overlapRules);
  console.log("Norm input: 'S.U!PERMAN' should become 'superman' after normalization");
  console.log("Norm result:", normResult);
  const normCats = normResult.length > 0 ? normResult[0].categories.split(',') : [];
  if (normResult.length > 0 && normCats.includes('a') && normCats.includes('b') && normCats.includes('c')) {
    console.log("Normalization check: PASSED");
  } else {
      console.log("Normalization check: FAILED");
      if (normResult.length > 0) {
          console.log("Result:", normResult[0]);
      } else {
          console.log("No match found");
      }
  }
}

runBenchmark();
