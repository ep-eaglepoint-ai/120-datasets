'use client';

import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Document, AnalyticsResult, DailyTrend } from '@/lib/types';
import { calculateDailyTrends } from '@/lib/advancedAnalysis';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeSeriesChartsProps {
  documents: Document[];
  analytics: Map<string, AnalyticsResult>;
}

export default function TimeSeriesCharts({ documents, analytics }: TimeSeriesChartsProps) {
  const dailyTrends = useMemo(() => {
    const docsWithAnalytics = documents.map(doc => ({
      content: doc.content,
      createdAt: doc.createdAt,
      analytics: analytics.get(doc.id),
    }));
    return calculateDailyTrends(docsWithAnalytics);
  }, [documents, analytics]);

  const vocabularyGrowth = useMemo(() => {
    const sortedDocs = [...documents].sort((a, b) => a.createdAt - b.createdAt);
    const cumulativeVocab = new Set<string>();
    const growth: { date: string; uniqueWords: number; totalWords: number }[] = [];

    sortedDocs.forEach(doc => {
      const docAnalytics = analytics.get(doc.id);
      if (docAnalytics) {
        const words = doc.content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        words.forEach(word => cumulativeVocab.add(word));
        growth.push({
          date: new Date(doc.createdAt).toLocaleDateString(),
          uniqueWords: cumulativeVocab.size,
          totalWords: growth.length > 0 
            ? growth[growth.length - 1].totalWords + docAnalytics.wordCount 
            : docAnalytics.wordCount,
        });
      }
    });

    return growth;
  }, [documents, analytics]);

  const sentimentTimelineData = useMemo(() => {
    if (dailyTrends.length === 0) return null;

    return {
      labels: dailyTrends.map(t => t.date),
      datasets: [
        {
          label: 'Average Sentiment',
          data: dailyTrends.map(t => t.avgSentiment),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [dailyTrends]);

  const wordCountTimelineData = useMemo(() => {
    if (dailyTrends.length === 0) return null;

    return {
      labels: dailyTrends.map(t => t.date),
      datasets: [
        {
          label: 'Daily Word Count',
          data: dailyTrends.map(t => t.wordCount),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [dailyTrends]);

  const readabilityTimelineData = useMemo(() => {
    if (dailyTrends.length === 0) return null;

    return {
      labels: dailyTrends.map(t => t.date),
      datasets: [
        {
          label: 'Average Readability (Flesch)',
          data: dailyTrends.map(t => t.avgReadability),
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [dailyTrends]);

  const vocabularyGrowthData = useMemo(() => {
    if (vocabularyGrowth.length === 0) return null;

    return {
      labels: vocabularyGrowth.map(v => v.date),
      datasets: [
        {
          label: 'Unique Words (Cumulative)',
          data: vocabularyGrowth.map(v => v.uniqueWords),
          borderColor: 'rgb(251, 146, 60)',
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Total Words (Cumulative)',
          data: vocabularyGrowth.map(v => v.totalWords),
          borderColor: 'rgb(236, 72, 153)',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          fill: false,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    };
  }, [vocabularyGrowth]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const vocabularyChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Unique Words',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Total Words',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500 text-center py-8">
          Add documents to see time-series visualizations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sentiment Timeline */}
      {sentimentTimelineData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">📈 Sentiment Timeline</h3>
          <Line data={sentimentTimelineData} options={chartOptions} />
          <p className="text-xs text-gray-500 mt-2">
            Track how your writing tone changes over time. Values above 0 indicate positive sentiment.
          </p>
        </div>
      )}

      {/* Word Count Timeline */}
      {wordCountTimelineData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">📝 Daily Writing Volume</h3>
          <Line data={wordCountTimelineData} options={chartOptions} />
          <p className="text-xs text-gray-500 mt-2">
            Monitor your daily writing productivity and identify patterns.
          </p>
        </div>
      )}

      {/* Readability Timeline */}
      {readabilityTimelineData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">📖 Readability Evolution</h3>
          <Line data={readabilityTimelineData} options={chartOptions} />
          <p className="text-xs text-gray-500 mt-2">
            See how your writing complexity changes. Higher scores mean easier to read.
          </p>
        </div>
      )}

      {/* Vocabulary Growth */}
      {vocabularyGrowthData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">📚 Vocabulary Growth</h3>
          <Line data={vocabularyGrowthData} options={vocabularyChartOptions} />
          <p className="text-xs text-gray-500 mt-2">
            Track your vocabulary expansion over time. A growing unique word count indicates vocabulary development.
          </p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">📊 Writing Statistics Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">
              {dailyTrends.length}
            </div>
            <div className="text-sm text-gray-600">Active Days</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {dailyTrends.reduce((sum, t) => sum + t.wordCount, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Words</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">
              {vocabularyGrowth.length > 0 ? vocabularyGrowth[vocabularyGrowth.length - 1].uniqueWords.toLocaleString() : 0}
            </div>
            <div className="text-sm text-gray-600">Unique Words</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-600">
              {dailyTrends.length > 0 
                ? Math.round(dailyTrends.reduce((sum, t) => sum + t.wordCount, 0) / dailyTrends.length)
                : 0}
            </div>
            <div className="text-sm text-gray-600">Avg Words/Day</div>
          </div>
        </div>
      </div>
    </div>
  );
}
