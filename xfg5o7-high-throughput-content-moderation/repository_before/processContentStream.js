function processContentStream(streamBatch, blocklistRules) {
  // Structural constraints keywords: outputLink, regionSet
  const processedEvents = [];
  const now = new Date(); 

  for (let i = 0; i < streamBatch.length; i++) {
    const event = streamBatch[i];
    
    const rawBody = event.body || "";
    const normalized = rawBody.replace(/[^\w\s]/gi, '').toLowerCase();
    
    let highestRisk = 0;
    let matchedCategories = [];
    let shouldBlock = false;

    for (let j = 0; j < blocklistRules.length; j++) {
      const rule = blocklistRules[j];
      
      if (!rule.isActive) continue;
      
      const ruleExpiry = new Date(rule.expiresAt); 
      if (ruleExpiry < now) continue;

      if (normalized.includes(rule.token.toLowerCase())) {
         
         if (rule.targetRegions.includes(event.region)) {
             shouldBlock = true;
             highestRisk = Math.max(highestRisk, rule.riskLevel);
             
             if (!matchedCategories.includes(rule.category)) {
                 matchedCategories.push(rule.category);
             }
         }
      }
    }

    if (shouldBlock) {
      processedEvents.push({
        eventId: event.id,
        timestamp: event.timestamp,
        riskScore: highestRisk,
        categories: matchedCategories.join(","),
        originalData: shallowClone(event) 
      });
    }
  }

  return processedEvents.sort((a, b) => b.riskScore - a.riskScore);
}

function preprocessRules(rules) {
  return rules;
}

function shallowClone(obj) {
  const clone = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = obj[key];
    }
  }
  return clone;
}

module.exports = { processContentStream, preprocessRules, shallowClone };
