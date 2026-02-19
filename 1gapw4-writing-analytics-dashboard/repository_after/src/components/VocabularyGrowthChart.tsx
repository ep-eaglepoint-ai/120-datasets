'use client';

import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Document, AnalyticsResult } from '@/lib/types';

interface VocabularyGrowthChartProps {
  documents: Document[];
  analytics: Map<string, AnalyticsResult>;
}

export default function VocabularyGrowthChart({ documents, analytics }: VocabularyGrowthChartProps) {
  const vocabularyGrowth = useMemo(() => {
    const sortedDocs = [...documents].sort((a, b) => a.createdAt - b.createdAt);
    const cumulativeVocab = new Set<string>();
    const growth: { date: string; uniqueWords: number; totalWords: number; ttr: number }[] = [];

    sortedDocs.forEach(doc => {
      const docAnalytics = analytics.get(doc.id);
      if (docAnalytics) {
        const words = doc.content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        words.forEach(word => cumulativeVocab.add(word));
        
        const totalWords = growth.length > 0 
          ? growth[growth.length - 1].totalWords + docAnalytics.wordCount 
          : docAnalytics.wordCount;
        
        growth.push({
          date: new Date(doc.createdAt).toLocaleDateString(),
          uniqueWords: cumulativeVocab.size,
          totalWords,
          ttr: cumulativeVocab.size / totalWords,
        });
      }
    });

    return growth;
  }, [documents, analytics]);

  const chartData = useMemo(() => {
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
      title: {
        display: true,
        text: 'Vocabulary Growth Over Time',
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

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500 text-center py-8">
          Add documents to see vocabulary growth
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <Line data={chartData} options={chartOptions} />
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-orange-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-orange-600">
            {vocabularyGrowth[vocabularyGrowth.length - 1]?.uniqueWords.toLocaleString() || 0}
          </div>
          <div className="text-sm text-gray-600">Total Unique Words</div>
        </div>
        <div className="bg-pink-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-pink-600">
            {vocabularyGrowth[vocabularyGrowth.length - 1]?.totalWords.toLocaleString() || 0}
          </div>
          <div className="text-sm text-gray-600">Total Words Written</div>
        </div>
        <div className="bg-purple-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-purple-600">
            {(vocabularyGrowth[vocabularyGrowth.length - 1]?.ttr * 100).toFixed(1) || 0}%
          </div>
          <div className="text-sm text-gray-600">Overall TTR</div>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Track your vocabulary expansion over time. A growing unique word count indicates vocabulary development.
      </p>
    </div>
  );
}
