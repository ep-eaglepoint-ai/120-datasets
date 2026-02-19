'use client';

import { AnalyticsResult } from '@/lib/types';

interface UncertaintyIndicatorProps {
  analytics: AnalyticsResult | null;
}

export default function UncertaintyIndicator({ analytics }: UncertaintyIndicatorProps) {
  if (!analytics || !analytics.uncertaintyIndicators) {
    return null;
  }

  const ui = analytics.uncertaintyIndicators;
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 border-green-300';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (confidence >= 0.4) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Moderate Confidence';
    if (confidence >= 0.4) return 'Low Confidence';
    return 'Very Low Confidence';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span>🎯</span> Analytical Confidence & Uncertainty
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className={`p-3 rounded border ${getConfidenceColor(ui.sentimentConfidence)}`}>
          <div className="text-xs font-medium mb-1">Sentiment Analysis</div>
          <div className="text-2xl font-bold">{(ui.sentimentConfidence * 100).toFixed(0)}%</div>
          <div className="text-xs mt-1">{getConfidenceLabel(ui.sentimentConfidence)}</div>
        </div>

        <div className={`p-3 rounded border ${getConfidenceColor(ui.readabilityConfidence)}`}>
          <div className="text-xs font-medium mb-1">Readability Metrics</div>
          <div className="text-2xl font-bold">{(ui.readabilityConfidence * 100).toFixed(0)}%</div>
          <div className="text-xs mt-1">{getConfidenceLabel(ui.readabilityConfidence)}</div>
        </div>

        <div className={`p-3 rounded border ${getConfidenceColor(ui.topicConfidence)}`}>
          <div className="text-xs font-medium mb-1">Topic Analysis</div>
          <div className="text-2xl font-bold">{(ui.topicConfidence * 100).toFixed(0)}%</div>
          <div className="text-xs mt-1">{getConfidenceLabel(ui.topicConfidence)}</div>
        </div>

        <div className={`p-3 rounded border ${getConfidenceColor(ui.overallReliability)}`}>
          <div className="text-xs font-medium mb-1">Overall Reliability</div>
          <div className="text-2xl font-bold">{(ui.overallReliability * 100).toFixed(0)}%</div>
          <div className="text-xs mt-1">{getConfidenceLabel(ui.overallReliability)}</div>
        </div>
      </div>

      {ui.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3">
          <div className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <span>⚠️</span> Analytical Warnings
          </div>
          <ul className="text-sm text-amber-800 space-y-1">
            {ui.warnings.map((warning, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3">
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-2">Understanding Confidence Scores:</p>
          <ul className="space-y-1 text-xs">
            <li><strong>High (80%+):</strong> Results are reliable and based on sufficient data.</li>
            <li><strong>Moderate (60-80%):</strong> Results are generally reliable but may have some limitations.</li>
            <li><strong>Low (40-60%):</strong> Results should be interpreted with caution due to limited data or high variability.</li>
            <li><strong>Very Low (&lt;40%):</strong> Results may be unreliable. Consider adding more content or reviewing the analysis.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
