import { Document, AnalyticsResult } from './types';

export function exportToCSV(documents: Document[], analytics: Map<string, AnalyticsResult>): string {
  const headers = [
    'Document ID',
    'Title',
    'Created At',
    'Updated At',
    'Project',
    'Category',
    'Tags',
    'Word Count',
    'Character Count',
    'Sentence Count',
    'Paragraph Count',
    'Sentiment Score',
    'Sentiment Polarity',
    'Sentiment Intensity',
    'Sentiment Volatility',
    'Sentiment Confidence',
    'Flesch Reading Ease',
    'Flesch-Kincaid Grade',
    'Gunning Fog',
    'SMOG Index',
    'Readability Confidence',
    'Type-Token Ratio',
    'Moving Average TTR',
    'Hapax Legomena',
    'Vocabulary Diversity',
    'Repetition Rate',
    'Rare Word Usage',
    'Avg Sentence Length',
    'Avg Word Length',
    'Passive Voice Count',
    'Punctuation Density',
    'Clause Depth',
    'Syntactic Variation',
    'Rhythm Pattern Average',
    'Deliberate Repetition Count',
    'Accidental Repetition Count',
    'Filler Words Count',
    'Structural Redundancy',
    'Main Topics',
    'Topic Confidence',
    'Overall Reliability',
    'Warnings Count',
  ];

  const rows = documents.map(doc => {
    const analyticsData = analytics.get(doc.id);
    if (!analyticsData) {
      return [
        doc.id,
        doc.title,
        new Date(doc.createdAt).toISOString(),
        new Date(doc.updatedAt).toISOString(),
        doc.project || '',
        doc.category || '',
        doc.tags?.join(';') || '',
        '0',
        '0',
        '0',
        '0',
        '0',
        'neutral',
        '0',
        '0',
        '0',
        '1',
        '0',
        '0',
        '0',
        '0',
        '1',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '',
        '1',
        '1',
        '0',

    const sentimentLabel = analyticsData.sentiment.polarity;
    const deliberateCount = analyticsData.repetitionAnalysis?.repeatedPhrases.filter(p => p.isDeliberate).length || 0;
    const accidentalCount = analyticsData.repetitionAnalysis?.repeatedPhrases.filter(p => !p.isDeliberate).length || 0;
    const mainTopics = analyticsData.topicAnalysis?.dominantTopics.map(t => t.topic).join(';') || '';

    return [
      doc.id,
      doc.title,
      new Date(doc.createdAt).toISOString(),
      new Date(doc.updatedAt).toISOString(),
      doc.project || '',
      doc.category || '',
      doc.tags?.join(';') || '',
      analyticsData.wordCount.toString(),
      analyticsData.characterCount.toString(),
      analyticsData.sentenceCount.toString(),
      analyticsData.paragraphCount.toString(),
      analyticsData.sentiment.score.toFixed(3),
      sentimentLabel,
      analyticsData.sentiment.polarity,
      analyticsData.sentiment.intensity.toFixed(3),
      analyticsData.sentiment.volatility?.toFixed(4) || '0',
      analyticsData.uncertaintyIndicators?.sentimentConfidence.toFixed(4) || '1',
      analyticsData.readability.fleschReadingEase.toFixed(2),
      analyticsData.readability.fleschKincaidGrade.toFixed(2),
      analyticsData.readability.gunningFog.toFixed(2),
      analyticsData.readability.smogIndex.toFixed(2),
      analyticsData.uncertaintyIndicators?.readabilityConfidence.toFixed(4) || '1',
      analyticsData.lexicalRichness.typeTokenRatio.toFixed(4),
      analyticsData.lexicalRichness.movingAverageTTR?.toFixed(4) || '0',
      analyticsData.lexicalRichness.hapaxLegomena.toString(),
      analyticsData.lexicalRichness.vocabularyDiversity?.toFixed(4) || '0',
      analyticsData.lexicalRichness.repetitionRate?.toFixed(4) || '0',
      analyticsData.lexicalRichness.rareWordUsage?.toFixed(4) || '0',
      analyticsData.styleMetrics.avgSentenceLength.toFixed(2),
      analyticsData.styleMetrics.avgWordLength.toFixed(2),
      analyticsData.styleMetrics.passiveVoiceCount?.toString() || '0',
      analyticsData.styleMetrics.punctuationDensity?.toFixed(4) || '0',
      analyticsData.styleMetrics.clauseDepth?.toFixed(2) || '0',
      analyticsData.styleMetrics.syntacticVariation?.toFixed(4) || '0',
      (analyticsData.styleMetrics.rhythmPatterns?.length 
        ? (analyticsData.styleMetrics.rhythmPatterns.reduce((a: number, b: number) => a + b, 0) / analyticsData.styleMetrics.rhythmPatterns.length).toFixed(4)
        : '0'),
      deliberateCount.toString(),
      accidentalCount.toString(),
      analyticsData.repetitionAnalysis?.fillerWords.length?.toString() || '0',
      analyticsData.repetitionAnalysis?.structuralRedundancy?.toFixed(4) || '0',
      mainTopics,
      analyticsData.uncertaintyIndicators?.topicConfidence.toFixed(4) || '1',
      analyticsData.uncertaintyIndicators?.overallReliability.toFixed(4) || '1',
      analyticsData.uncertaintyIndicators?.warnings?.length.toString() || '0',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

export function downloadCSV(content: string, filename: string = 'writing-analytics.csv') {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
