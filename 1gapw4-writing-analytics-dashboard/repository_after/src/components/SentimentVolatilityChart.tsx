'use client';

import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Document, AnalyticsResult } from '@/lib/types';

interface SentimentVolatilityChartProps {
  documents: Document[];
  analytics: Map<string, AnalyticsResult>;
}

export default function SentimentVolatilityChart({ documents, analytics }: SentimentVolatilityChartProps) {
  const volatilityData = useMemo(() => {
    const sortedDocs = [...documents].sort((a, b) => a.createdAt - b.createdAt);
    const data: { date: string; volatility: number; sentiment: number; polarity: string }[] = [];

    sortedDocs.forEach(doc => {
      const docAnalytics = analytics.get(doc.id);
      if (docAnalytics) {
        data.push({
          date: new Date(doc.createdAt).toLocaleDateString(),
          volatility: docAnalytics.sentiment.volatility || 0,
          sentiment: docAnalytics.sentiment.score,
          polarity: docAnalytics.sentiment.polarity,
        });
      }
    });

    return data;
  }, [documents, analytics]);

  const chartData = useMemo(() => {
    if (volatilityData.length === 0) return null;

    return {
      labels: volatilityData.map(d => d.date),
      datasets: [
        {
          label: 'Sentiment Volatility',
          data: volatilityData.map(d => d.volatility),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Sentiment Score',
          data: volatilityData.map(d => d.sentiment),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: false,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    };
  }, [volatilityData]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Sentiment Volatility Over Time',
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Volatility',
        },
        min: 0,
        max: 1,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Sentiment Score',
        },
        min: -1,
        max: 1,
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
          Add documents to see sentiment volatility
        </p>
      </div>
    );
  }

  const avgVolatility = volatilityData.reduce((sum, d) => sum + d.volatility, 0) / volatilityData.length;
  const highVolatilityDocs = volatilityData.filter(d => d.volatility > 0.5).length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <Line data={chartData} options={chartOptions} />
      
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-red-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-red-600">
            {(avgVolatility * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Average Volatility</div>
        </div>
        <div className="bg-orange-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-orange-600">
            {highVolatilityDocs}
          </div>
          <div className="text-sm text-gray-600">High Volatility Documents</div>
        </div>
      </div>

      <div className="mt-4 bg-yellow-50 p-4 rounded">
        <h4 className="font-semibold text-yellow-900 mb-2">Understanding Volatility</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li><strong>Low Volatility (0-0.3):</strong> Consistent emotional tone throughout the document.</li>
          <li><strong>Moderate Volatility (0.3-0.5):</strong> Some emotional variation, natural for most writing.</li>
          <li><strong>High Volatility (0.5+):</strong> Significant emotional shifts. May indicate dramatic narrative or mixed messaging.</li>
        </ul>
      </div>
    </div>
  );
}
