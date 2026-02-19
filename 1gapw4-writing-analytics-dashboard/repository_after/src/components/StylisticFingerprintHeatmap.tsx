'use client';

import { useMemo } from 'react';
import { Document, AnalyticsResult } from '@/lib/types';

interface StylisticFingerprintHeatmapProps {
  documents: Document[];
  analytics: Map<string, AnalyticsResult>;
}

export default function StylisticFingerprintHeatmap({ documents, analytics }: StylisticFingerprintHeatmapProps) {
  const heatmapData = useMemo(() => {
    const metrics = documents.map(doc => {
      const docAnalytics = analytics.get(doc.id);
      if (!docAnalytics || !docAnalytics.stylisticFingerprint) return null;

      const fp = docAnalytics.stylisticFingerprint;
      return {
        title: doc.title,
        shortSentenceRatio: fp.sentenceCadence.shortSentenceRatio,
        mediumSentenceRatio: fp.sentenceCadence.mediumSentenceRatio,
        longSentenceRatio: fp.sentenceCadence.longSentenceRatio,
        variationScore: fp.sentenceCadence.variationScore,
        functionWordDensity: Object.values(fp.functionWordProfile).reduce((a: number, b: number) => a + b, 0),
        punctuationDensity: Object.values(fp.punctuationProfile).reduce((a: number, b: number) => a + b, 0),
      };
    }).filter(Boolean);

    return metrics;
  }, [documents, analytics]);

  const getColorForValue = (value: number, max: number = 1): string => {
    const intensity = Math.min(value / max, 1);
    if (intensity < 0.2) return 'bg-blue-100';
    if (intensity < 0.4) return 'bg-blue-300';
    if (intensity < 0.6) return 'bg-blue-500';
    if (intensity < 0.8) return 'bg-blue-700';
    return 'bg-blue-900';
  };

  const getTextColorForValue = (value: number, max: number = 1): string => {
    const intensity = Math.min(value / max, 1);
    return intensity >= 0.6 ? 'text-white' : 'text-gray-900';
  };

  if (heatmapData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500 text-center py-8">
          Add documents to see stylistic fingerprint heatmap
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">📊 Stylistic Fingerprint Heatmap</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Document</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Short Sentences</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Medium Sentences</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Long Sentences</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Variation</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Function Words</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold">Punctuation</th>
            </tr>
          </thead>
          <tbody>
            {heatmapData.map((metric, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 text-sm font-medium">
                  {metric!.title.substring(0, 30)}{metric!.title.length > 30 ? '...' : ''}
                </td>
                <td className={`border border-gray-300 px-4 py-2 text-center text-sm ${getColorForValue(metric!.shortSentenceRatio)} ${getTextColorForValue(metric!.shortSentenceRatio)}`}>
                  {(metric!.shortSentenceRatio * 100).toFixed(0)}%
                </td>
                <td className={`border border-gray-300 px-4 py-2 text-center text-sm ${getColorForValue(metric!.mediumSentenceRatio)} ${getTextColorForValue(metric!.mediumSentenceRatio)}`}>
                  {(metric!.mediumSentenceRatio * 100).toFixed(0)}%
                </td>
                <td className={`border border-gray-300 px-4 py-2 text-center text-sm ${getColorForValue(metric!.longSentenceRatio)} ${getTextColorForValue(metric!.longSentenceRatio)}`}>
                  {(metric!.longSentenceRatio * 100).toFixed(0)}%
                </td>
                <td className={`border border-gray-300 px-4 py-2 text-center text-sm ${getColorForValue(metric!.variationScore, 2)} ${getTextColorForValue(metric!.variationScore, 2)}`}>
                  {metric!.variationScore.toFixed(2)}
                </td>
                <td className={`border border-gray-300 px-4 py-2 text-center text-sm ${getColorForValue(metric!.functionWordDensity, 0.5)} ${getTextColorForValue(metric!.functionWordDensity, 0.5)}`}>
                  {(metric!.functionWordDensity * 100).toFixed(1)}%
                </td>
                <td className={`border border-gray-300 px-4 py-2 text-center text-sm ${getColorForValue(metric!.punctuationDensity, 0.2)} ${getTextColorForValue(metric!.punctuationDensity, 0.2)}`}>
                  {(metric!.punctuationDensity * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-purple-50 p-4 rounded">
        <h4 className="font-semibold text-purple-900 mb-2">Understanding the Heatmap</h4>
        <div className="text-sm text-purple-800 space-y-1">
          <p><strong>Darker colors</strong> indicate higher values for each metric.</p>
          <p><strong>Sentence Distribution:</strong> Shows preference for short, medium, or long sentences.</p>
          <p><strong>Variation Score:</strong> Higher values indicate more diverse sentence lengths.</p>
          <p><strong>Function Words:</strong> Common words like "the", "a", "in" - higher density = simpler style.</p>
          <p><strong>Punctuation:</strong> Density of punctuation marks - affects rhythm and pacing.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="font-semibold">Color Scale:</span>
        <div className="flex gap-1">
          <div className="w-8 h-4 bg-blue-100 border border-gray-300"></div>
          <div className="w-8 h-4 bg-blue-300 border border-gray-300"></div>
          <div className="w-8 h-4 bg-blue-500 border border-gray-300"></div>
          <div className="w-8 h-4 bg-blue-700 border border-gray-300"></div>
          <div className="w-8 h-4 bg-blue-900 border border-gray-300"></div>
        </div>
        <span className="text-gray-600 ml-2">Low → High</span>
      </div>
    </div>
  );
}
