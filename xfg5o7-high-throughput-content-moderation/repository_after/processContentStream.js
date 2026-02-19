
function preprocessRules(blocklistRules) {
  const currentTimestamp = Date.now();
  
  const root = {
    next: Object.create(null), 
    fail: null,
    output: null,
    outputLink: null,
  };

  for (let ruleIndex = 0; ruleIndex < blocklistRules.length; ruleIndex++) {
    const rule = blocklistRules[ruleIndex];
    if (!rule || !rule.isActive) continue;

    const expiryTimestamp =
      typeof rule.expiresAt === "number"
        ? rule.expiresAt
        : new Date(rule.expiresAt).getTime();

    if (expiryTimestamp < currentTimestamp) continue;

    const normalizedToken = (rule.token || "").toLowerCase();
    if (!normalizedToken) continue;

    const regionSet = new Set(rule.targetRegions);

    let currentNode = root;
    for (let charIndex = 0; charIndex < normalizedToken.length; charIndex++) {
      const character = normalizedToken[charIndex];
      if (!currentNode.next[character]) {
        currentNode.next[character] = {
          next: Object.create(null),
          fail: null,
          output: null,
          outputLink: null,
        };
      }
      currentNode = currentNode.next[character];
    }

    if (!currentNode.output) currentNode.output = [];
    currentNode.output.push({
      expiryTimestamp,
      regionSet,
      riskLevel: rule.riskLevel,
      category: rule.category,
    });
  }

  
  const nodeQueue = [];
  for (const character in root.next) {
    const firstLevelChild = root.next[character];
    firstLevelChild.fail = root;
    nodeQueue.push(firstLevelChild);
  }

  let queueHead = 0;
  while (queueHead < nodeQueue.length) {
    const currentNode = nodeQueue[queueHead++];
    for (const character in currentNode.next) {
      const childNode = currentNode.next[character];
      let failureNode = currentNode.fail;

      while (failureNode !== null && !failureNode.next[character]) {
        failureNode = failureNode.fail;
      }
      childNode.fail = failureNode ? failureNode.next[character] : root;


      childNode.outputLink =
        childNode.fail.output || childNode.fail.outputLink
          ? childNode.fail
          : null;
      nodeQueue.push(childNode);
    }
  }

  return { root, buildTime: currentTimestamp };
}


function shallowClone(event) {
  const clone = {};
  for (const key in event) {
    if (Object.prototype.hasOwnProperty.call(event, key)) {
      clone[key] = event[key];
    }
  }
  return clone;
}

function processContentStream(streamBatch, blocklistRulesOrAutomaton) {
  if (!streamBatch || streamBatch.length === 0) return [];

  let automatonRoot, automatonBuildTime;
  if (
    blocklistRulesOrAutomaton &&
    blocklistRulesOrAutomaton.root
  ) {
    automatonRoot = blocklistRulesOrAutomaton.root;
    automatonBuildTime = blocklistRulesOrAutomaton.buildTime;
  } else {
    const automaton = preprocessRules(blocklistRulesOrAutomaton);
    automatonRoot = automaton.root;
    automatonBuildTime = automaton.buildTime;
  }

  const currentTimestamp = Date.now();
  const flaggedEvents = [];
  const matchedCategoriesSet = new Set();

  const eventCount = streamBatch.length;
  for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
    const event = streamBatch[eventIndex];
    const eventBody = event.body || "";
    const eventRegion = event.region;

    let automatonState = automatonRoot;
    let isBlocked = false;
    let maximumRiskLevel = 0;
    matchedCategoriesSet.clear(); 

    const bodyLength = eventBody.length;
    for (let charIndex = 0; charIndex < bodyLength; charIndex++) {
      let character = eventBody[charIndex];
      const charCode = character.charCodeAt(0);

     
      if (charCode >= 65 && charCode <= 90) {
        character = String.fromCharCode(charCode + 32);
      } else if (
        (charCode >= 97 && charCode <= 122) || 
        (charCode >= 48 && charCode <= 57) || 
        charCode === 95 ||
        charCode === 32 || 
        (charCode >= 9 && charCode <= 13) 
      ) {
      } else {
        continue;
      }

     
      while (
        automatonState !== automatonRoot &&
        !automatonState.next[character]
      ) {
        automatonState = automatonState.fail;
      }
      automatonState = automatonState.next[character] || automatonRoot;

    
      let outputNode = automatonState;
      while (outputNode !== null) {
        if (outputNode.output) {
          for (
            let ruleIndex = 0, ruleCount = outputNode.output.length;
            ruleIndex < ruleCount;
            ruleIndex++
          ) {
            const ruleMetadata = outputNode.output[ruleIndex];

         
            if (ruleMetadata.expiryTimestamp < currentTimestamp) continue;

            if (ruleMetadata.regionSet.has(eventRegion)) {
              isBlocked = true;
              if (ruleMetadata.riskLevel > maximumRiskLevel) {
                maximumRiskLevel = ruleMetadata.riskLevel;
              }
              matchedCategoriesSet.add(ruleMetadata.category);
            }
          }
        }
        outputNode = outputNode.outputLink;
      }
    }

    if (isBlocked) {
      flaggedEvents.push({
        eventId: event.id,
        timestamp: event.timestamp,
        riskScore: maximumRiskLevel,
        categories: Array.from(matchedCategoriesSet).join(","),
        
        originalData: shallowClone(event),
      });
    }
  }

  return flaggedEvents.sort((a, b) => b.riskScore - a.riskScore);
}

module.exports = { processContentStream, preprocessRules, shallowClone };
