'use client';

import { useState, useMemo } from 'react';
import { Document, AnalyticsResult, LengthBand, Genre } from '@/lib/types';
import { getLengthBand } from '@/lib/comprehensiveAnalytics';

interface FilterCriteria {
  sentimentRange: [number, number];
  readabilityRange: [number, number];
  wordCountRange: [number, number];
  dateRange: [number | null, number | null];
  project: string;
  tags: string[];
  // Requirement #16: Advanced Filters
  genre: Genre | '';
  lengthBand: LengthBand | '';
  clauseDepthRange: [number, number];
  syntacticVariationRange: [number, number];
  topicCluster: string;
  volatilityRange: [number, number];
}

interface AdvancedFiltersProps {
  documents: Document[];
  analytics: Map<string, AnalyticsResult>;
  onFilterChange: (filteredDocs: Document[]) => void;
}

export default function AdvancedFilters({
  documents,
  analytics,
  onFilterChange,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({
    sentimentRange: [-1, 1],
    readabilityRange: [0, 100],
    wordCountRange: [0, 100000],
    dateRange: [null, null],
    project: '',
    tags: [],
    genre: '',
    lengthBand: '',
    clauseDepthRange: [0, 10],
    syntacticVariationRange: [0, 50],
    topicCluster: '',
    volatilityRange: [0, 1],
  });

  const allProjects = [...new Set(documents.map(d => d.project).filter(Boolean))];
  const allTags = [...new Set(documents.flatMap(d => d.tags || []))];
  const allGenres = [...new Set(documents.map(d => d.genre).filter(Boolean))] as Genre[];

  // Extract all topic clusters from analytics
  const allTopicClusters = useMemo(() => {
    const topics = new Set<string>();
    analytics.forEach(a => {
      a.topicAnalysis?.dominantTopics?.forEach(t => topics.add(t.topic));
    });
    return Array.from(topics);
  }, [analytics]);

  const applyFilters = () => {
    const filtered = documents.filter(doc => {
      const docAnalytics = analytics.get(doc.id);

      // Sentiment filter
      if (docAnalytics) {
        const sentiment = docAnalytics.sentiment.score;
        if (sentiment < filters.sentimentRange[0] || sentiment > filters.sentimentRange[1]) {
          return false;
        }

        // Readability filter
        const readability = docAnalytics.readability.fleschReadingEase;
        if (readability < filters.readabilityRange[0] || readability > filters.readabilityRange[1]) {
          return false;
        }

        // Word count filter
        const wordCount = docAnalytics.wordCount;
        if (wordCount < filters.wordCountRange[0] || wordCount > filters.wordCountRange[1]) {
          return false;
        }

        // Length band filter (Requirement #16)
        if (filters.lengthBand) {
          const docLengthBand = getLengthBand(wordCount);
          if (docLengthBand !== filters.lengthBand) {
            return false;
          }
        }

        // Clause depth filter (Requirement #16)
        const clauseDepth = docAnalytics.styleMetrics.clauseDepth || 1;
        if (clauseDepth < filters.clauseDepthRange[0] || clauseDepth > filters.clauseDepthRange[1]) {
          return false;
        }

        // Syntactic variation filter (Requirement #16)
        const syntacticVariation = docAnalytics.styleMetrics.syntacticVariation || 0;
        if (syntacticVariation < filters.syntacticVariationRange[0] || syntacticVariation > filters.syntacticVariationRange[1]) {
          return false;
        }

        // Topic cluster filter (Requirement #16)
        if (filters.topicCluster) {
          const docTopics = docAnalytics.topicAnalysis?.dominantTopics?.map(t => t.topic) || [];
          if (!docTopics.includes(filters.topicCluster)) {
            return false;
          }
        }

        // Volatility filter (Requirement #16)
        const volatility = docAnalytics.sentiment.volatility || 0;
        if (volatility < filters.volatilityRange[0] || volatility > filters.volatilityRange[1]) {
          return false;
        }
      }

      // Date filter
      if (filters.dateRange[0] && doc.createdAt < filters.dateRange[0]) {
        return false;
      }
      if (filters.dateRange[1] && doc.createdAt > filters.dateRange[1]) {
        return false;
      }

      // Project filter
      if (filters.project && doc.project !== filters.project) {
        return false;
      }

      // Genre filter (Requirement #16)
      if (filters.genre && doc.genre !== filters.genre) {
        return false;
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const docTags = doc.tags || [];
        if (!filters.tags.some(tag => docTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });

    onFilterChange(filtered);
  };

  const resetFilters = () => {
    setFilters({
      sentimentRange: [-1, 1],
      readabilityRange: [0, 100],
      wordCountRange: [0, 100000],
      dateRange: [null, null],
      project: '',
      tags: [],
      genre: '',
      lengthBand: '',
      clauseDepthRange: [0, 10],
      syntacticVariationRange: [0, 50],
      topicCluster: '',
      volatilityRange: [0, 1],
    });
    onFilterChange(documents);
  };

  const getSentimentLabel = (value: number): string => {
    if (value < -0.3) return 'Very Negative';
    if (value < 0) return 'Negative';
    if (value === 0) return 'Neutral';
    if (value < 0.3) return 'Positive';
    return 'Very Positive';
  };

  const getReadabilityLabel = (value: number): string => {
    if (value < 30) return 'Very Difficult';
    if (value < 50) return 'Difficult';
    if (value < 60) return 'Fairly Difficult';
    if (value < 70) return 'Standard';
    if (value < 80) return 'Fairly Easy';
    if (value < 90) return 'Easy';
    return 'Very Easy';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>🔍</span> Advanced Filters
        </h3>
        <button className="text-gray-500 hover:text-gray-700">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Sentiment Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sentiment Range
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={filters.sentimentRange[0]}
                onChange={(e) => setFilters({
                  ...filters,
                  sentimentRange: [parseFloat(e.target.value), filters.sentimentRange[1]]
                })}
                className="flex-1"
              />
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={filters.sentimentRange[1]}
                onChange={(e) => setFilters({
                  ...filters,
                  sentimentRange: [filters.sentimentRange[0], parseFloat(e.target.value)]
                })}
                className="flex-1"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{getSentimentLabel(filters.sentimentRange[0])} ({filters.sentimentRange[0].toFixed(1)})</span>
              <span>{getSentimentLabel(filters.sentimentRange[1])} ({filters.sentimentRange[1].toFixed(1)})</span>
            </div>
          </div>

          {/* Readability Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Readability Range (Flesch Reading Ease)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={filters.readabilityRange[0]}
                onChange={(e) => setFilters({
                  ...filters,
                  readabilityRange: [parseInt(e.target.value), filters.readabilityRange[1]]
                })}
                className="flex-1"
              />
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={filters.readabilityRange[1]}
                onChange={(e) => setFilters({
                  ...filters,
                  readabilityRange: [filters.readabilityRange[0], parseInt(e.target.value)]
                })}
                className="flex-1"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{getReadabilityLabel(filters.readabilityRange[0])} ({filters.readabilityRange[0]})</span>
              <span>{getReadabilityLabel(filters.readabilityRange[1])} ({filters.readabilityRange[1]})</span>
            </div>
          </div>

          {/* Word Count Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Word Count Range
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="0"
                value={filters.wordCountRange[0]}
                onChange={(e) => setFilters({
                  ...filters,
                  wordCountRange: [parseInt(e.target.value) || 0, filters.wordCountRange[1]]
                })}
                className="w-24 p-2 border border-gray-300 rounded"
                placeholder="Min"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                min="0"
                value={filters.wordCountRange[1]}
                onChange={(e) => setFilters({
                  ...filters,
                  wordCountRange: [filters.wordCountRange[0], parseInt(e.target.value) || 100000]
                })}
                className="w-24 p-2 border border-gray-300 rounded"
                placeholder="Max"
              />
            </div>
          </div>

          {/* Project Filter */}
          {allProjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              <select
                value={filters.project}
                onChange={(e) => setFilters({ ...filters, project: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="">All Projects</option>
                {allProjects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTags = filters.tags.includes(tag)
                        ? filters.tags.filter(t => t !== tag)
                        : [...filters.tags, tag];
                      setFilters({ ...filters, tags: newTags });
                    }}
                    className={`px-3 py-1 text-sm rounded-full transition ${
                      filters.tags.includes(tag)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Genre Filter (Requirement #16) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Genre
            </label>
            <select
              value={filters.genre}
              onChange={(e) => setFilters({ ...filters, genre: e.target.value as Genre | '' })}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="">All Genres</option>
              <option value="fiction">Fiction</option>
              <option value="non-fiction">Non-Fiction</option>
              <option value="academic">Academic</option>
              <option value="technical">Technical</option>
              <option value="creative">Creative</option>
              <option value="journal">Journal</option>
              <option value="article">Article</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Length Band Filter (Requirement #16) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Length Band
            </label>
            <select
              value={filters.lengthBand}
              onChange={(e) => setFilters({ ...filters, lengthBand: e.target.value as LengthBand | '' })}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="">All Lengths</option>
              <option value="micro">Micro (&lt;100 words)</option>
              <option value="short">Short (100-500 words)</option>
              <option value="medium">Medium (500-2000 words)</option>
              <option value="long">Long (2000-5000 words)</option>
              <option value="extended">Extended (5000+ words)</option>
            </select>
          </div>

          {/* Topic Cluster Filter (Requirement #16) */}
          {allTopicClusters.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic Cluster
              </label>
              <select
                value={filters.topicCluster}
                onChange={(e) => setFilters({ ...filters, topicCluster: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="">All Topics</option>
                {allTopicClusters.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>
          )}

          {/* Clause Depth Range (Requirement #16) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clause Depth Range
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={filters.clauseDepthRange[0]}
                onChange={(e) => setFilters({
                  ...filters,
                  clauseDepthRange: [parseFloat(e.target.value), filters.clauseDepthRange[1]]
                })}
                className="flex-1"
              />
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={filters.clauseDepthRange[1]}
                onChange={(e) => setFilters({
                  ...filters,
                  clauseDepthRange: [filters.clauseDepthRange[0], parseFloat(e.target.value)]
                })}
                className="flex-1"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Min: {filters.clauseDepthRange[0]}</span>
              <span>Max: {filters.clauseDepthRange[1]}</span>
            </div>
          </div>

          {/* Sentiment Volatility Range (Requirement #16) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sentiment Volatility Range
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={filters.volatilityRange[0]}
                onChange={(e) => setFilters({
                  ...filters,
                  volatilityRange: [parseFloat(e.target.value), filters.volatilityRange[1]]
                })}
                className="flex-1"
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={filters.volatilityRange[1]}
                onChange={(e) => setFilters({
                  ...filters,
                  volatilityRange: [filters.volatilityRange[0], parseFloat(e.target.value)]
                })}
                className="flex-1"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Stable ({filters.volatilityRange[0].toFixed(1)})</span>
              <span>Volatile ({filters.volatilityRange[1].toFixed(1)})</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={applyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
