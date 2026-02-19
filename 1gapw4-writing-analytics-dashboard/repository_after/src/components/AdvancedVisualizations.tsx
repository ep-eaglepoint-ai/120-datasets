'use client';

import { useMemo } from 'react';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { AnalyticsResult, StylisticEvolution, ProductivityMetrics } from '@/lib/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AdvancedVisualizationsProps {
  analytics: AnalyticsResult | null;
  stylisticEvolution?: StylisticEvolution | null;
  productivityMetrics?: ProductivityMetrics | null;
}

export default function AdvancedVisualizations({
  analytics,
  stylisticEvolution,
  productivityMetrics,
}: AdvancedVisualizationsProps) {
  // Sentence Length Histogram (Requirement #15)
  const sentenceLengthHistogramData = useMemo(() => {
    if (!analytics?.styleMetrics?.rhythmPatterns) return null;

    const patterns = analytics.styleMetrics.rhythmPatterns;
    const bins = [
      { label: '1-5', min: 1, max: 5, count: 0 },
      { label: '6-10', min: 6, max: 10, count: 0 },
      { label: '11-15', min: 11, max: 15, count: 0 },
      { label: '16-20', min: 16, max: 20, count: 0 },
      { label: '21-25', min: 21, max: 25, count: 0 },
      { label: '26-30', min: 26, max: 30, count: 0 },
      { label: '31+', min: 31, max: Infinity, count: 0 },
    ];

    patterns.forEach((length: number) => {
      const bin = bins.find(b => length >= b.min && length <= b.max);
      if (bin) bin.count++;
    });

    return {
      labels: bins.map(b => b.label),
      datasets: [{
        label: 'Sentence Count',
        data: bins.map(b => b.count),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      }],
    };
  }, [analytics]);

  // Stylistic Fingerprint Radar (Requirement #15)
  const stylisticFingerprintData = useMemo(() => {
    if (!analytics?.stylisticFingerprint) return null;

    const fp = analytics.stylisticFingerprint;
    
    return {
      labels: [
        'Short Sentences',
        'Medium Sentences',
        'Long Sentences',
        'Variation',
        'Punctuation Use',
        'Function Words',
      ],
      datasets: [{
        label: 'Stylistic Profile',
        data: [
          fp.sentenceCadence.shortSentenceRatio * 100,
          fp.sentenceCadence.mediumSentenceRatio * 100,
          fp.sentenceCadence.longSentenceRatio * 100,
          Math.min(100, fp.sentenceCadence.variationScore * 50),
          Math.min(100, (Object.values(fp.punctuationProfile) as number[]).reduce((a, b) => a + b, 0) * 500),
          Math.min(100, (Object.values(fp.functionWordProfile) as number[]).reduce((a, b) => a + b, 0) * 200),
        ],
        backgroundColor: 'rgba(168, 85, 247, 0.3)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(168, 85, 247)',
      }],
    };
  }, [analytics]);

  // Sentiment Distribution Pie Chart
  const sentimentDistributionData = useMemo(() => {
    if (!analytics?.sentiment?.sentenceLevel) return null;

    const sentences = analytics.sentiment.sentenceLevel;
    const positive = sentences.filter(s => s.polarity === 'positive').length;
    const neutral = sentences.filter(s => s.polarity === 'neutral').length;
    const negative = sentences.filter(s => s.polarity === 'negative').length;

    return {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [{
        data: [positive, neutral, negative],
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)',
          'rgba(156, 163, 175, 0.7)',
          'rgba(239, 68, 68, 0.7)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(156, 163, 175)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 1,
      }],
    };
  }, [analytics]);

  // Topic Weight Chart
  const topicWeightData = useMemo(() => {
    if (!analytics?.topicAnalysis?.dominantTopics) return null;

    const topics = analytics.topicAnalysis.dominantTopics;

    return {
      labels: topics.map(t => t.topic),
      datasets: [{
        label: 'Topic Weight',
        data: topics.map(t => t.weight * 100),
        backgroundColor: [
          'rgba(59, 130, 246, 0.6)',
          'rgba(168, 85, 247, 0.6)',
          'rgba(236, 72, 153, 0.6)',
          'rgba(251, 146, 60, 0.6)',
          'rgba(34, 197, 94, 0.6)',
        ],
        borderWidth: 1,
      }],
    };
  }, [analytics]);

  // Complexity Evolution Chart (Requirement #13)
  const complexityEvolutionData = useMemo(() => {
    if (!stylisticEvolution?.complexityEvolution || stylisticEvolution.complexityEvolution.length === 0) return null;

    return {
      labels: stylisticEvolution.complexityEvolution.map(c => c.date),
      datasets: [
        {
          label: 'Avg Sentence Length',
          data: stylisticEvolution.complexityEvolution.map(c => c.avgSentenceLength),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Readability',
          data: stylisticEvolution.complexityEvolution.map(c => c.readability),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: false,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    };
  }, [stylisticEvolution]);

  // Vocabulary Evolution Chart (Requirement #13)
  const vocabularyEvolutionData = useMemo(() => {
    if (!stylisticEvolution?.vocabularyEvolution || stylisticEvolution.vocabularyEvolution.length === 0) return null;

    return {
      labels: stylisticEvolution.vocabularyEvolution.map(v => v.date),
      datasets: [
        {
          label: 'Type-Token Ratio',
          data: stylisticEvolution.vocabularyEvolution.map(v => v.ttr * 100),
          borderColor: 'rgb(251, 146, 60)',
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [stylisticEvolution]);

  // Productivity Streak Chart (Requirement #3)
  const productivityChartData = useMemo(() => {
    if (!productivityMetrics?.dailyWordCounts || productivityMetrics.dailyWordCounts.length === 0) return null;

    return {
      labels: productivityMetrics.dailyWordCounts.map(d => d.date),
      datasets: [{
        label: 'Daily Words',
        data: productivityMetrics.dailyWordCounts.map(d => d.wordCount),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.3)',
        fill: true,
        tension: 0.4,
      }],
    };
  }, [productivityMetrics]);

  // Grammar Metrics Radar
  const grammarRadarData = useMemo(() => {
    if (!analytics?.grammarMetrics) return null;

    const gm = analytics.grammarMetrics;
    const verbTotal = (gm.verbFormDistribution.past || 0) + 
                     (gm.verbFormDistribution.present || 0) + 
                     (gm.verbFormDistribution.future || 0) || 1;

    return {
      labels: [
        'Tense Consistency',
        'Past Tense',
        'Present Tense',
        'Future Tense',
        'Modifier Density',
      ],
      datasets: [{
        label: 'Grammar Profile',
        data: [
          gm.tenseConsistency * 100,
          ((gm.verbFormDistribution.past || 0) / verbTotal) * 100,
          ((gm.verbFormDistribution.present || 0) / verbTotal) * 100,
          ((gm.verbFormDistribution.future || 0) / verbTotal) * 100,
          Math.min(100, gm.modifierDensity * 500),
        ],
        backgroundColor: 'rgba(236, 72, 153, 0.3)',
        borderColor: 'rgb(236, 72, 153)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(236, 72, 153)',
      }],
    };
  }, [analytics]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
    },
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
      },
    },
    plugins: {
      legend: { position: 'top' as const },
    },
  };

  const dualAxisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { display: true, text: 'Sentence Length' },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: { display: true, text: 'Readability' },
        grid: { drawOnChartArea: false },
      },
    },
  };

  if (!analytics) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500 text-center py-8">Select a document to view advanced visualizations</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sentence Length Histogram */}
      {sentenceLengthHistogramData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Sentence Length Distribution</h3>
          <div className="h-64">
            <Bar data={sentenceLengthHistogramData} options={chartOptions} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Distribution of sentence lengths in words. Varied sentence lengths indicate dynamic writing.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stylistic Fingerprint Radar */}
        {stylisticFingerprintData && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">🎨 Stylistic Fingerprint</h3>
            <div className="h-64">
              <Radar data={stylisticFingerprintData} options={radarOptions} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Your unique writing signature based on sentence patterns and word usage.
            </p>
          </div>
        )}

        {/* Sentiment Distribution */}
        {sentimentDistributionData && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">😊 Sentiment Distribution</h3>
            <div className="h-64">
              <Doughnut data={sentimentDistributionData} options={chartOptions} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Breakdown of emotional tone across sentences in your text.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Topic Weights */}
        {topicWeightData && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">📌 Dominant Topics</h3>
            <div className="h-64">
              <Bar data={topicWeightData} options={chartOptions} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Main themes and subjects detected in your writing.
            </p>
          </div>
        )}

        {/* Grammar Radar */}
        {grammarRadarData && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">📝 Grammar Profile</h3>
            <div className="h-64">
              <Radar data={grammarRadarData} options={radarOptions} />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Analysis of tense usage and modifier patterns.
            </p>
          </div>
        )}
      </div>

      {/* Complexity Evolution */}
      {complexityEvolutionData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">📈 Complexity Evolution Over Time</h3>
          <div className="h-64">
            <Line data={complexityEvolutionData} options={dualAxisOptions} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Track how your writing complexity and readability change over time.
          </p>
        </div>
      )}

      {/* Vocabulary Evolution */}
      {vocabularyEvolutionData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">📚 Vocabulary Evolution</h3>
          <div className="h-64">
            <Line data={vocabularyEvolutionData} options={chartOptions} />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Your vocabulary diversity trends over time. Higher TTR indicates more varied word choice.
          </p>
        </div>
      )}

      {/* Productivity Chart */}
      {productivityChartData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">🔥 Writing Productivity</h3>
          <div className="h-64">
            <Line data={productivityChartData} options={chartOptions} />
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{productivityMetrics?.currentStreak || 0}</div>
              <div className="text-xs text-gray-500">Current Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{productivityMetrics?.longestStreak || 0}</div>
              <div className="text-xs text-gray-500">Longest Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(productivityMetrics?.consistencyScore ? productivityMetrics.consistencyScore * 100 : 0)}%
              </div>
              <div className="text-xs text-gray-500">Consistency</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {productivityMetrics?.volumeGrowthRate ? productivityMetrics.volumeGrowthRate.toFixed(1) : 0}%
              </div>
              <div className="text-xs text-gray-500">Growth Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Repetition Analysis */}
      {analytics.repetitionAnalysis && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">🔄 Repetition Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Repeated Phrases */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Repeated Phrases</h4>
              {analytics.repetitionAnalysis.repeatedPhrases.length > 0 ? (
                <ul className="space-y-2">
                  {analytics.repetitionAnalysis.repeatedPhrases.slice(0, 5).map((p, i) => (
                    <li key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">"{p.phrase}"</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        p.isDeliberate ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {p.count}x {p.isDeliberate ? '(deliberate)' : '(check)'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No significant repetitions found</p>
              )}
            </div>

            {/* Filler Words */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Filler Words</h4>
              {analytics.repetitionAnalysis.fillerWords.length > 0 ? (
                <ul className="space-y-2">
                  {analytics.repetitionAnalysis.fillerWords.slice(0, 5).map((f, i) => (
                    <li key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">"{f.word}"</span>
                      <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-700">
                        {f.count}x ({(f.density * 100).toFixed(2)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No filler words detected</p>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Structural Redundancy</span>
              <span className={`font-medium ${
                analytics.repetitionAnalysis.structuralRedundancy > 0.3 ? 'text-red-600' : 'text-green-600'
              }`}>
                {(analytics.repetitionAnalysis.structuralRedundancy * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
