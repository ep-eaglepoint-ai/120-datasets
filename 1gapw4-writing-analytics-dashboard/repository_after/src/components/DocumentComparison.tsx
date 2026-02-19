import React, { useState } from 'react';
import { Document, AnalyticsResult } from '../lib/types';

interface DocumentComparisonProps {
  documents: Document[];
  analytics: Map<string, AnalyticsResult>;
}

export default function DocumentComparison({ documents, analytics }: DocumentComparisonProps) {
  const [doc1Id, setDoc1Id] = useState<string>('');
  const [doc2Id, setDoc2Id] = useState<string>('');

  const doc1Analytics = doc1Id ? analytics.get(doc1Id) : null;
  const doc2Analytics = doc2Id ? analytics.get(doc2Id) : null;

  const calculateDifference = (val1: number | undefined, val2: number | undefined): string => {
    if (val1 === undefined || val2 === undefined) return 'N/A';
    const diff = Math.abs(val1 - val2);
    return diff.toFixed(2);
  };

  const calculatePercentageDiff = (val1: number | undefined, val2: number | undefined): string => {
    if (val1 === undefined || val2 === undefined || val1 === 0) return 'N/A';
    const diff = ((val2 - val1) / val1) * 100;
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Document Comparison</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document 1
          </label>
          <select
            value={doc1Id}
            onChange={(e) => setDoc1Id(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select document...</option>
            {documents.map(doc => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document 2
          </label>
          <select
            value={doc2Id}
            onChange={(e) => setDoc2Id(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select document...</option>
            {documents.map(doc => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {doc1Analytics && doc2Analytics && (
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document 1
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document 2
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % Change
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Word Count
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc1Analytics.wordCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc2Analytics.wordCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculateDifference(doc1Analytics.wordCount, doc2Analytics.wordCount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculatePercentageDiff(doc1Analytics.wordCount, doc2Analytics.wordCount)}
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Sentiment Score
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc1Analytics.sentiment.score.toFixed(2)} ({doc1Analytics.sentiment.polarity})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc2Analytics.sentiment.score.toFixed(2)} ({doc2Analytics.sentiment.polarity})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculateDifference(doc1Analytics.sentiment.score, doc2Analytics.sentiment.score)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Tone shift
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Flesch Reading Ease
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc1Analytics.readability.fleschReadingEase.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc2Analytics.readability.fleschReadingEase.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculateDifference(doc1Analytics.readability.fleschReadingEase, doc2Analytics.readability.fleschReadingEase)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculatePercentageDiff(doc1Analytics.readability.fleschReadingEase, doc2Analytics.readability.fleschReadingEase)}
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Type-Token Ratio
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc1Analytics.lexicalRichness.typeTokenRatio.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc2Analytics.lexicalRichness.typeTokenRatio.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculateDifference(doc1Analytics.lexicalRichness.typeTokenRatio, doc2Analytics.lexicalRichness.typeTokenRatio)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculatePercentageDiff(doc1Analytics.lexicalRichness.typeTokenRatio, doc2Analytics.lexicalRichness.typeTokenRatio)}
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Avg Sentence Length
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc1Analytics.styleMetrics.avgSentenceLength.toFixed(1)} words
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc2Analytics.styleMetrics.avgSentenceLength.toFixed(1)} words
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculateDifference(doc1Analytics.styleMetrics.avgSentenceLength, doc2Analytics.styleMetrics.avgSentenceLength)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculatePercentageDiff(doc1Analytics.styleMetrics.avgSentenceLength, doc2Analytics.styleMetrics.avgSentenceLength)}
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Passive Voice Count
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc1Analytics.styleMetrics.passiveVoiceCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc2Analytics.styleMetrics.passiveVoiceCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculateDifference(doc1Analytics.styleMetrics.passiveVoiceCount, doc2Analytics.styleMetrics.passiveVoiceCount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {calculatePercentageDiff(doc1Analytics.styleMetrics.passiveVoiceCount, doc2Analytics.styleMetrics.passiveVoiceCount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="text-lg font-semibold mb-2">Interpretation</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              <li>
                <strong>Vocabulary richness:</strong> {
                  doc1Analytics.lexicalRichness.typeTokenRatio > doc2Analytics.lexicalRichness.typeTokenRatio
                    ? 'Document 1 uses more diverse vocabulary'
                    : 'Document 2 uses more diverse vocabulary'
                }
              </li>
              <li>
                <strong>Readability:</strong> {
                  doc1Analytics.readability.fleschReadingEase > doc2Analytics.readability.fleschReadingEase
                    ? 'Document 1 is easier to read'
                    : 'Document 2 is easier to read'
                }
              </li>
              <li>
                <strong>Sentiment:</strong> {
                  Math.abs(doc1Analytics.sentiment.score - doc2Analytics.sentiment.score) < 0.1
                    ? 'Both documents have similar emotional tone'
                    : `Significant tone difference detected (${doc1Analytics.sentiment.polarity} vs ${doc2Analytics.sentiment.polarity})`
                }
              </li>
            </ul>
          </div>
        </div>
      )}

      {(!doc1Id || !doc2Id) && (
        <div className="text-center text-gray-500 py-8">
          Select two documents to compare their analytics
        </div>
      )}
    </div>
  );
}
