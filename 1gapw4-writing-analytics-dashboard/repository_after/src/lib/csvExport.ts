// ============================================================================
// REQUIREMENT #22: Enhanced CSV Export with Longitudinal Data
// ============================================================================

import { Document, AnalyticsResult, ProductivityMetrics, StylisticEvolution, TopicAnalysis } from './types';

interface ExportOptions {
  includeBasicMetrics: boolean;
  includeSentiment: boolean;
  includeReadability: boolean;
  includeLexical: boolean;
  includeStyle: boolean;
  includeGrammar: boolean;
  includeTopics: boolean;
  includeRepetition: boolean;
  includeFingerprint: boolean;
  includeUncertainty: boolean;
  includeLongitudinal: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeBasicMetrics: true,
  includeSentiment: true,
  includeReadability: true,
  includeLexical: true,
  includeStyle: true,
  includeGrammar: true,
  includeTopics: true,
  includeRepetition: true,
  includeFingerprint: true,
  includeUncertainty: true,
  includeLongitudinal: true,
};

// Export single document analytics to CSV
export function exportDocumentAnalyticsCSV(
  doc: Document,
  analytics: AnalyticsResult,
  options: Partial<ExportOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rows: string[][] = [];
  
  // Header row
  rows.push(['Metric Category', 'Metric Name', 'Value', 'Interpretation']);
  
  // Basic metrics
  if (opts.includeBasicMetrics) {
    rows.push(['Basic', 'Document ID', doc.id, '']);
    rows.push(['Basic', 'Title', doc.title, '']);
    rows.push(['Basic', 'Word Count', analytics.wordCount.toString(), getLengthInterpretation(analytics.wordCount)]);
    rows.push(['Basic', 'Character Count', analytics.characterCount.toString(), '']);
    rows.push(['Basic', 'Sentence Count', analytics.sentenceCount.toString(), '']);
    rows.push(['Basic', 'Paragraph Count', analytics.paragraphCount.toString(), '']);
    rows.push(['Basic', 'Created At', new Date(doc.createdAt).toISOString(), '']);
    rows.push(['Basic', 'Genre', doc.genre || 'Not specified', '']);
  }
  
  // Sentiment metrics
  if (opts.includeSentiment) {
    rows.push(['Sentiment', 'Overall Score', analytics.sentiment.score.toFixed(3), getSentimentInterpretation(analytics.sentiment.score)]);
    rows.push(['Sentiment', 'Polarity', analytics.sentiment.polarity, '']);
    rows.push(['Sentiment', 'Intensity', analytics.sentiment.intensity.toFixed(3), getIntensityInterpretation(analytics.sentiment.intensity)]);
    rows.push(['Sentiment', 'Volatility', (analytics.sentiment.volatility || 0).toFixed(3), getVolatilityInterpretation(analytics.sentiment.volatility || 0)]);
    rows.push(['Sentiment', 'Polarity Shifts', (analytics.sentiment.polarityShifts?.length || 0).toString(), '']);
    rows.push(['Sentiment', 'Mood Patterns', (analytics.sentiment.moodPatterns || []).join('; '), '']);
  }
  
  // Readability metrics
  if (opts.includeReadability) {
    rows.push(['Readability', 'Flesch Reading Ease', analytics.readability.fleschReadingEase.toFixed(1), getReadabilityInterpretation(analytics.readability.fleschReadingEase)]);
    rows.push(['Readability', 'Flesch-Kincaid Grade', analytics.readability.fleschKincaidGrade.toFixed(1), `Grade ${Math.round(analytics.readability.fleschKincaidGrade)} reading level`]);
    rows.push(['Readability', 'Gunning Fog Index', analytics.readability.gunningFog.toFixed(1), '']);
    rows.push(['Readability', 'SMOG Index', analytics.readability.smogIndex.toFixed(1), '']);
    rows.push(['Readability', 'Sentence Complexity', (analytics.readability.sentenceComplexity || 0).toFixed(2), '']);
    rows.push(['Readability', 'Fragment Count', (analytics.readability.fragmentCount || 0).toString(), '']);
    rows.push(['Readability', 'Technical Term Density', ((analytics.readability.technicalTermDensity || 0) * 100).toFixed(2) + '%', '']);
  }
  
  // Lexical richness
  if (opts.includeLexical) {
    rows.push(['Lexical', 'Type-Token Ratio', analytics.lexicalRichness.typeTokenRatio.toFixed(3), getTTRInterpretation(analytics.lexicalRichness.typeTokenRatio)]);
    rows.push(['Lexical', 'Hapax Legomena', analytics.lexicalRichness.hapaxLegomena.toString(), 'Words appearing only once']);
    rows.push(['Lexical', 'Vocabulary Diversity', analytics.lexicalRichness.vocabularyDiversity.toFixed(3), '']);
    rows.push(['Lexical', 'Repetition Rate', ((analytics.lexicalRichness.repetitionRate || 0) * 100).toFixed(2) + '%', '']);
    rows.push(['Lexical', 'Rare Word Usage', ((analytics.lexicalRichness.rareWordUsage || 0) * 100).toFixed(2) + '%', '']);
  }
  
  // Style metrics
  if (opts.includeStyle) {
    rows.push(['Style', 'Avg Sentence Length', analytics.styleMetrics.avgSentenceLength.toFixed(1), getSentenceLengthInterpretation(analytics.styleMetrics.avgSentenceLength)]);
    rows.push(['Style', 'Avg Word Length', analytics.styleMetrics.avgWordLength.toFixed(2), '']);
    rows.push(['Style', 'Passive Voice Count', analytics.styleMetrics.passiveVoiceCount.toString(), '']);
    rows.push(['Style', 'Punctuation Density', analytics.styleMetrics.punctuationDensity.toFixed(3), '']);
    rows.push(['Style', 'Clause Depth', (analytics.styleMetrics.clauseDepth || 0).toFixed(2), '']);
    rows.push(['Style', 'Coordination Frequency', (analytics.styleMetrics.coordinationFrequency || 0).toFixed(2), '']);
    rows.push(['Style', 'Syntactic Variation', (analytics.styleMetrics.syntacticVariation || 0).toFixed(2), '']);
  }
  
  // Grammar metrics
  if (opts.includeGrammar && analytics.grammarMetrics) {
    rows.push(['Grammar', 'Tense Consistency', (analytics.grammarMetrics.tenseConsistency * 100).toFixed(1) + '%', getTenseConsistencyInterpretation(analytics.grammarMetrics.tenseConsistency)]);
    rows.push(['Grammar', 'Modifier Density', (analytics.grammarMetrics.modifierDensity * 100).toFixed(2) + '%', '']);
    
    const verbForms = analytics.grammarMetrics.verbFormDistribution;
    rows.push(['Grammar', 'Past Tense Verbs', (verbForms.past || 0).toString(), '']);
    rows.push(['Grammar', 'Present Tense Verbs', (verbForms.present || 0).toString(), '']);
    rows.push(['Grammar', 'Future Tense Verbs', (verbForms.future || 0).toString(), '']);
    
    const topPronouns = Object.entries(analytics.grammarMetrics.pronounUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p, c]) => `${p}(${c})`)
      .join(', ');
    rows.push(['Grammar', 'Top Pronouns', topPronouns, '']);
  }
  
  // Topic analysis
  if (opts.includeTopics && analytics.topicAnalysis) {
    const topics = analytics.topicAnalysis.dominantTopics.slice(0, 5);
    topics.forEach((t, i) => {
      rows.push(['Topics', `Topic ${i + 1}`, t.topic, `Weight: ${(t.weight * 100).toFixed(1)}%, Keywords: ${t.keywords.slice(0, 3).join(', ')}`]);
    });
    
    const topNGrams = analytics.topicAnalysis.nGrams.slice(0, 5);
    topNGrams.forEach((ng, i) => {
      rows.push(['Topics', `N-Gram ${i + 1}`, ng.phrase, `Count: ${ng.count}`]);
    });
  }
  
  // Repetition analysis
  if (opts.includeRepetition && analytics.repetitionAnalysis) {
    rows.push(['Repetition', 'Structural Redundancy', (analytics.repetitionAnalysis.structuralRedundancy * 100).toFixed(1) + '%', '']);
    
    const topFillers = analytics.repetitionAnalysis.fillerWords.slice(0, 5);
    topFillers.forEach(f => {
      rows.push(['Repetition', `Filler: ${f.word}`, f.count.toString(), `Density: ${(f.density * 100).toFixed(2)}%`]);
    });
    
    const topRepeated = analytics.repetitionAnalysis.repeatedPhrases.slice(0, 5);
    topRepeated.forEach(p => {
      rows.push(['Repetition', `Phrase: "${p.phrase}"`, p.count.toString(), p.isDeliberate ? 'Likely deliberate' : 'May be accidental']);
    });
  }
  
  // Stylistic fingerprint
  if (opts.includeFingerprint && analytics.stylisticFingerprint) {
    const fp = analytics.stylisticFingerprint;
    rows.push(['Fingerprint', 'Short Sentence Ratio', (fp.sentenceCadence.shortSentenceRatio * 100).toFixed(1) + '%', '']);
    rows.push(['Fingerprint', 'Medium Sentence Ratio', (fp.sentenceCadence.mediumSentenceRatio * 100).toFixed(1) + '%', '']);
    rows.push(['Fingerprint', 'Long Sentence Ratio', (fp.sentenceCadence.longSentenceRatio * 100).toFixed(1) + '%', '']);
    rows.push(['Fingerprint', 'Variation Score', fp.sentenceCadence.variationScore.toFixed(3), '']);
    
    const topPhrasing = fp.phrasingTendencies.slice(0, 3);
    topPhrasing.forEach(p => {
      rows.push(['Fingerprint', `Phrasing: "${p.pattern}"`, (p.frequency * 100).toFixed(1) + '%', '']);
    });
  }
  
  // Uncertainty indicators
  if (opts.includeUncertainty && analytics.uncertaintyIndicators) {
    const ui = analytics.uncertaintyIndicators;
    rows.push(['Confidence', 'Sentiment Confidence', (ui.sentimentConfidence * 100).toFixed(0) + '%', getConfidenceInterpretation(ui.sentimentConfidence)]);
    rows.push(['Confidence', 'Readability Confidence', (ui.readabilityConfidence * 100).toFixed(0) + '%', getConfidenceInterpretation(ui.readabilityConfidence)]);
    rows.push(['Confidence', 'Topic Confidence', (ui.topicConfidence * 100).toFixed(0) + '%', getConfidenceInterpretation(ui.topicConfidence)]);
    rows.push(['Confidence', 'Overall Reliability', (ui.overallReliability * 100).toFixed(0) + '%', getConfidenceInterpretation(ui.overallReliability)]);
    
    ui.warnings.forEach((w, i) => {
      rows.push(['Confidence', `Warning ${i + 1}`, w, '']);
    });
  }
  
  return convertToCSV(rows);
}

// Export longitudinal analytics report
export function exportLongitudinalReportCSV(
  documents: Document[],
  analytics: Map<string, AnalyticsResult>,
  productivityMetrics: ProductivityMetrics | null,
  stylisticEvolution: StylisticEvolution | null,
  topicAnalysis: TopicAnalysis | null
): string {
  const rows: string[][] = [];
  
  // ===== SECTION 1: Daily Writing Activity =====
  rows.push(['=== DAILY WRITING ACTIVITY ===', '', '', '', '', '']);
  rows.push(['Date', 'Word Count', 'Document Count', 'Cumulative Words', 'Streak Day', 'Notes']);
  
  if (productivityMetrics) {
    let cumulative = 0;
    let streakCount = 0;
    const sortedDaily = [...productivityMetrics.dailyWordCounts].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedDaily.forEach((day, index) => {
      cumulative += day.wordCount;
      
      // Check if this is part of a streak
      if (index === 0) {
        streakCount = 1;
      } else {
        const prevDate = new Date(sortedDaily[index - 1].date);
        const currDate = new Date(day.date);
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        streakCount = diffDays === 1 ? streakCount + 1 : 1;
      }
      
      rows.push([
        day.date,
        day.wordCount.toString(),
        day.documentCount.toString(),
        cumulative.toString(),
        streakCount.toString(),
        streakCount >= 7 ? 'Week streak!' : streakCount >= 3 ? 'Building momentum' : ''
      ]);
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 2: Productivity Summary =====
  rows.push(['=== PRODUCTIVITY SUMMARY ===', '', '', '', '', '']);
  rows.push(['Metric', 'Value', 'Interpretation', '', '', '']);
  
  if (productivityMetrics) {
    rows.push(['Current Streak', productivityMetrics.currentStreak.toString() + ' days', getStreakInterpretation(productivityMetrics.currentStreak), '', '', '']);
    rows.push(['Longest Streak', productivityMetrics.longestStreak.toString() + ' days', '', '', '', '']);
    rows.push(['Total Active Days', productivityMetrics.totalActiveDays.toString(), '', '', '', '']);
    rows.push(['Average Words/Day', Math.round(productivityMetrics.averageWordsPerDay).toString(), '', '', '', '']);
    rows.push(['Consistency Score', (productivityMetrics.consistencyScore * 100).toFixed(1) + '%', getConsistencyInterpretation(productivityMetrics.consistencyScore), '', '', '']);
    rows.push(['Volume Growth Rate', productivityMetrics.volumeGrowthRate.toFixed(1) + '%', getGrowthInterpretation(productivityMetrics.volumeGrowthRate), '', '', '']);
    rows.push(['Missed Days', productivityMetrics.missedDays.toString(), '', '', '', '']);
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 3: Tone Evolution =====
  rows.push(['=== TONE EVOLUTION ===', '', '', '', '', '']);
  rows.push(['Date', 'Sentiment Score', 'Polarity', 'Trend', '', '']);
  
  if (stylisticEvolution?.toneEvolution) {
    let prevScore = 0;
    stylisticEvolution.toneEvolution.forEach((t, i) => {
      const trend = i === 0 ? 'Baseline' : t.score > prevScore ? '↑ Improving' : t.score < prevScore ? '↓ Declining' : '→ Stable';
      rows.push([t.date, t.score.toFixed(3), t.polarity, trend, '', '']);
      prevScore = t.score;
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 4: Complexity Evolution =====
  rows.push(['=== COMPLEXITY EVOLUTION ===', '', '', '', '', '']);
  rows.push(['Date', 'Avg Sentence Length', 'Clause Depth', 'Readability', 'Trend', '']);
  
  if (stylisticEvolution?.complexityEvolution) {
    let prevReadability = 0;
    stylisticEvolution.complexityEvolution.forEach((c, i) => {
      const trend = i === 0 ? 'Baseline' : c.readability > prevReadability ? '↑ Easier' : c.readability < prevReadability ? '↓ Harder' : '→ Stable';
      rows.push([c.date, c.avgSentenceLength.toFixed(1), c.clauseDepth.toFixed(2), c.readability.toFixed(1), trend, '']);
      prevReadability = c.readability;
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 5: Vocabulary Evolution =====
  rows.push(['=== VOCABULARY EVOLUTION ===', '', '', '', '', '']);
  rows.push(['Date', 'Type-Token Ratio', 'Unique Words', 'Rare Word Usage', 'Trend', '']);
  
  if (stylisticEvolution?.vocabularyEvolution) {
    let prevTTR = 0;
    stylisticEvolution.vocabularyEvolution.forEach((v, i) => {
      const trend = i === 0 ? 'Baseline' : v.ttr > prevTTR ? '↑ More diverse' : v.ttr < prevTTR ? '↓ Less diverse' : '→ Stable';
      rows.push([v.date, v.ttr.toFixed(3), v.uniqueWords.toString(), (v.rareWordUsage * 100).toFixed(2) + '%', trend, '']);
      prevTTR = v.ttr;
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 6: Pacing Evolution =====
  rows.push(['=== PACING EVOLUTION ===', '', '', '', '', '']);
  rows.push(['Date', 'Rhythm Variation', 'Sentence Length StdDev', 'Style', '', '']);
  
  if (stylisticEvolution?.pacingEvolution) {
    stylisticEvolution.pacingEvolution.forEach(p => {
      const style = p.rhythmVariation > 10 ? 'Dynamic' : p.rhythmVariation > 5 ? 'Varied' : 'Consistent';
      rows.push([p.date, p.rhythmVariation.toFixed(2), p.sentenceLengthStdDev.toFixed(2), style, '', '']);
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 7: Topic Drift =====
  rows.push(['=== TOPIC DRIFT ===', '', '', '', '', '']);
  rows.push(['Date', 'Dominant Topic', 'Weight', 'Secondary Topics', '', '']);
  
  if (topicAnalysis?.topicDrift) {
    topicAnalysis.topicDrift.forEach(td => {
      const dominant = td.topics[0];
      const secondary = td.topics.slice(1, 3).map(t => t.topic).join(', ');
      rows.push([td.date, dominant?.topic || 'N/A', dominant ? (dominant.weight * 100).toFixed(1) + '%' : 'N/A', secondary, '', '']);
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 8: Thematic Shifts =====
  rows.push(['=== THEMATIC SHIFTS ===', '', '', '', '', '']);
  rows.push(['Date', 'From Topic', 'To Topic', 'Magnitude', 'Significance', '']);
  
  if (topicAnalysis?.thematicShifts) {
    topicAnalysis.thematicShifts.forEach(ts => {
      const significance = ts.magnitude > 0.3 ? 'Major shift' : ts.magnitude > 0.15 ? 'Moderate shift' : 'Minor shift';
      rows.push([ts.date, ts.fromTopic, ts.toTopic, ts.magnitude.toFixed(3), significance, '']);
    });
  }
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 9: Document-by-Document Summary =====
  rows.push(['=== DOCUMENT SUMMARY ===', '', '', '', '', '']);
  rows.push(['Date', 'Title', 'Words', 'Sentiment', 'Readability', 'Topics']);
  
  const sortedDocs = [...documents].sort((a, b) => a.createdAt - b.createdAt);
  sortedDocs.forEach(doc => {
    const a = analytics.get(doc.id);
    if (a) {
      const topics = a.topicAnalysis?.dominantTopics.slice(0, 2).map(t => t.topic).join(', ') || 'N/A';
      rows.push([
        new Date(doc.createdAt).toISOString().split('T')[0],
        doc.title,
        a.wordCount.toString(),
        `${a.sentiment.polarity} (${a.sentiment.score.toFixed(2)})`,
        a.readability.fleschReadingEase.toFixed(1),
        topics
      ]);
    }
  });
  
  rows.push(['', '', '', '', '', '']);
  
  // ===== SECTION 10: Overall Statistics =====
  rows.push(['=== OVERALL STATISTICS ===', '', '', '', '', '']);
  rows.push(['Metric', 'Value', '', '', '', '']);
  
  rows.push(['Total Documents', documents.length.toString(), '', '', '', '']);
  rows.push(['Sentiment Stability', stylisticEvolution ? (stylisticEvolution.sentimentStability * 100).toFixed(1) + '%' : 'N/A', '', '', '', '']);
  rows.push(['Thematic Focus Shift', stylisticEvolution ? stylisticEvolution.thematicFocusShift.toFixed(3) : 'N/A', '', '', '', '']);
  
  return convertToCSV(rows);
}

// Export visualization data for external tools
export function exportVisualizationDataCSV(
  productivityMetrics: ProductivityMetrics | null,
  stylisticEvolution: StylisticEvolution | null
): string {
  const rows: string[][] = [];
  
  // Time series data for charts
  rows.push(['=== VISUALIZATION DATA ===', '', '', '', '', '', '', '']);
  rows.push(['Date', 'Word Count', 'Sentiment', 'Readability', 'TTR', 'Clause Depth', 'Rhythm Variation', 'Polarity']);
  
  if (productivityMetrics && stylisticEvolution) {
    const dates = new Set<string>();
    productivityMetrics.dailyWordCounts.forEach(d => dates.add(d.date));
    stylisticEvolution.toneEvolution.forEach(t => dates.add(t.date));
    
    const sortedDates = Array.from(dates).sort();
    
    sortedDates.forEach(date => {
      const daily = productivityMetrics.dailyWordCounts.find(d => d.date === date);
      const tone = stylisticEvolution.toneEvolution.find(t => t.date === date);
      const complexity = stylisticEvolution.complexityEvolution.find(c => c.date === date);
      const vocab = stylisticEvolution.vocabularyEvolution.find(v => v.date === date);
      const pacing = stylisticEvolution.pacingEvolution.find(p => p.date === date);
      
      rows.push([
        date,
        daily?.wordCount.toString() || '',
        tone?.score.toFixed(3) || '',
        complexity?.readability.toFixed(1) || '',
        vocab?.ttr.toFixed(3) || '',
        complexity?.clauseDepth.toFixed(2) || '',
        pacing?.rhythmVariation.toFixed(2) || '',
        tone?.polarity || ''
      ]);
    });
  }
  
  return convertToCSV(rows);
}

// Helper to convert rows to CSV string
function convertToCSV(rows: string[][]): string {
  return rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const escaped = cell.replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`;
      }
      return escaped;
    }).join(',')
  ).join('\n');
}

// Interpretation helpers
function getLengthInterpretation(wordCount: number): string {
  if (wordCount < 100) return 'Micro text - metrics may be less reliable';
  if (wordCount < 500) return 'Short text';
  if (wordCount < 2000) return 'Medium length';
  if (wordCount < 5000) return 'Long text';
  return 'Extended text';
}

function getSentimentInterpretation(score: number): string {
  if (score < -0.5) return 'Strongly negative tone';
  if (score < -0.2) return 'Negative tone';
  if (score < 0.2) return 'Neutral tone';
  if (score < 0.5) return 'Positive tone';
  return 'Strongly positive tone';
}

function getIntensityInterpretation(intensity: number): string {
  if (intensity < 0.2) return 'Low emotional intensity';
  if (intensity < 0.5) return 'Moderate emotional intensity';
  return 'High emotional intensity';
}

function getVolatilityInterpretation(volatility: number): string {
  if (volatility < 0.2) return 'Stable emotional tone';
  if (volatility < 0.5) return 'Some emotional variation';
  return 'High emotional variation';
}

function getReadabilityInterpretation(score: number): string {
  if (score < 30) return 'Very difficult - College graduate level';
  if (score < 50) return 'Difficult - College level';
  if (score < 60) return 'Fairly difficult - High school senior level';
  if (score < 70) return 'Standard - 8th-9th grade level';
  if (score < 80) return 'Fairly easy - 7th grade level';
  if (score < 90) return 'Easy - 6th grade level';
  return 'Very easy - 5th grade level';
}

function getTTRInterpretation(ttr: number): string {
  if (ttr < 0.3) return 'Low vocabulary diversity';
  if (ttr < 0.5) return 'Moderate vocabulary diversity';
  if (ttr < 0.7) return 'Good vocabulary diversity';
  return 'High vocabulary diversity';
}

function getSentenceLengthInterpretation(avgLength: number): string {
  if (avgLength < 10) return 'Very short sentences - punchy style';
  if (avgLength < 15) return 'Short sentences - clear and direct';
  if (avgLength < 20) return 'Medium sentences - balanced';
  if (avgLength < 25) return 'Long sentences - complex style';
  return 'Very long sentences - may be difficult to read';
}

function getTenseConsistencyInterpretation(consistency: number): string {
  if (consistency > 0.8) return 'Very consistent tense usage';
  if (consistency > 0.6) return 'Mostly consistent tense usage';
  if (consistency > 0.4) return 'Mixed tense usage';
  return 'Inconsistent tense usage - may confuse readers';
}

function getConfidenceInterpretation(confidence: number): string {
  if (confidence > 0.8) return 'High confidence';
  if (confidence > 0.6) return 'Moderate confidence';
  if (confidence > 0.4) return 'Low confidence - interpret with caution';
  return 'Very low confidence - results may be unreliable';
}

function getStreakInterpretation(streak: number): string {
  if (streak === 0) return 'No active streak';
  if (streak < 3) return 'Building momentum';
  if (streak < 7) return 'Good consistency';
  if (streak < 14) return 'Strong habit forming';
  if (streak < 30) return 'Excellent discipline';
  return 'Outstanding commitment!';
}

function getConsistencyInterpretation(consistency: number): string {
  if (consistency > 0.8) return 'Very consistent writing habit';
  if (consistency > 0.6) return 'Good consistency';
  if (consistency > 0.4) return 'Moderate consistency';
  if (consistency > 0.2) return 'Irregular writing pattern';
  return 'Very irregular - consider establishing routine';
}

function getGrowthInterpretation(growth: number): string {
  if (growth > 50) return 'Significant volume increase';
  if (growth > 20) return 'Good growth';
  if (growth > 0) return 'Slight increase';
  if (growth > -20) return 'Slight decrease';
  return 'Significant volume decrease';
}
