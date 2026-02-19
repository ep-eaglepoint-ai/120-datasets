'use client';

import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Document, AnalyticsResult } from '@/lib/types';

interface ComplexityHistogramProps {
  documents: Document[];
  analytics: Map<string, AnalyticsResult>;
}

export default function ComplexityHistogram({ documents, analytics }: ComplexityHistogramProps) {
  const complexityData = useMemo(() => {
    const bins = {
      'Very Simple (0-10)': 0,
      'Simple (10-15)': 0,
      'Moderate (15-20)': 0,
      'Complex (20-25)': 0,
      'Very Complex (25+)': 0,
    };

    documents.forEach(doc => {
      const docAnalytics = analytics.get(doc.id);
      if (docAnalytics) {
        const avgLength = docAnalytics.styleMetrics.avgSentenceLength;
        if (avgLength < 10) bins['Very Simple (0-10)']++;
        else if (avgLength < 15) bins['Simple (10-15)']++;
        else if (avgLength < 20) bins['Moderate (15-20)']++;
        else if (avgLength < 25) bins['Complex (20-25)']++;
        else bins['Very Complex (25+)']++;
      }
    });

    return bins;
  }, [documents, analytics]);

  const chartData = {
    labels: Object.keys(complexityData),
    datasets: [
      {
        label: 'Number of Documents',
        data: Object.values(complexityData),
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(251, 146, 60, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(168, 85, 247, 0.7)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(251, 146, 60)',
          'rgb(239, 68, 68)',
          'rgb(168, 85, 247)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Sentence Complexity Distribution',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
        title: {
          display: true,
          text: 'Number of Documents',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Average Sentence Length (words)',
        },
      },
    },
  };

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500 text-center py-8">
          Add documents to see complexity distribution
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <Bar data={chartData} options={chartOptions} />
      <div className="mt-4 bg-blue-50 p-4 rounded">
        <h4 className="font-semibold text-blue-900 mb-2">Interpretation Guide</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Very Simple (0-10 words):</strong> Punchy, direct style. Good for clarity.</li>
          <li><strong>Simple (10-15 words):</strong> Clear and accessible. Standard for most writing.</li>
          <li><strong>Moderate (15-20 words):</strong> Balanced complexity. Professional writing.</li>
          <li><strong>Complex (20-25 words):</strong> Sophisticated style. May challenge readers.</li>
          <li><strong>Very Complex (25+ words):</strong> Dense, academic style. Consider simplifying.</li>
        </ul>
      </div>
    </div>
  );
}
