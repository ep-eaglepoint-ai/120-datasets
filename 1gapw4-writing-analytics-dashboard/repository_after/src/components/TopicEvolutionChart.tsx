'use client';

import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Document, AnalyticsResult } from '@/lib/types';

interface TopicEvolutionChartProps {
  documents: Document[];
  analytics: Map<string, AnalyticsResult>;
}

export default function TopicEvolutionChart({ documents, analytics }: TopicEvolutionChartProps) {
  const topicEvolution = useMemo(() => {
    const sortedDocs = [...documents].sort((a, b) => a.createdAt - b.createdAt);
    const topicsByDate: { [date: string]: { [topic: string]: number } } = {};
    const allTopics = new Set<string>();

    sortedDocs.forEach(doc => {
      const docAnalytics = analytics.get(doc.id);
      if (docAnalytics?.topicAnalysis?.dominantTopics) {
        const date = new Date(doc.createdAt).toLocaleDateString();
        if (!topicsByDate[date]) {
          topicsByDate[date] = {};
        }

        docAnalytics.topicAnalysis.dominantTopics.forEach(t => {
          allTopics.add(t.topic);
          topicsByDate[date][t.topic] = (topicsByDate[date][t.topic] || 0) + t.weight;
        });
      }
    });

    return { topicsByDate, allTopics: Array.from(allTopics).slice(0, 5) };
  }, [documents, analytics]);

  const chartData = useMemo(() => {
    if (Object.keys(topicEvolution.topicsByDate).length === 0) return null;

    const dates = Object.keys(topicEvolution.topicsByDate).sort();
    const colors = [
      'rgb(59, 130, 246)',
      'rgb(34, 197, 94)',
      'rgb(251, 146, 60)',
      'rgb(168, 85, 247)',
      'rgb(236, 72, 153)',
    ];

    const datasets = topicEvolution.allTopics.map((topic, idx) => ({
      label: topic,
      data: dates.map(date => topicEvolution.topicsByDate[date][topic] || 0),
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
      fill: false,
      tension: 0.4,
    }));

    return {
      labels: dates,
      datasets,
    };
  }, [topicEvolution]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Topic Evolution Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Topic Weight',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
        },
      },
    },
  };

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500 text-center py-8">
          Add documents to see topic evolution
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <Line data={chartData} options={chartOptions} />
      <div className="mt-4 bg-indigo-50 p-4 rounded">
        <h4 className="font-semibold text-indigo-900 mb-2">Topic Drift Analysis</h4>
        <p className="text-sm text-indigo-800">
          This chart shows how your writing topics change over time. Rising lines indicate increasing focus on a topic,
          while declining lines show decreasing emphasis. Sudden shifts may indicate thematic transitions in your work.
        </p>
      </div>
    </div>
  );
}
