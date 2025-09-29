'use client';

import { useState } from 'react';
import { AnalyzeRequest, AnalyzeResponse, Scorecard } from '@/types/scorecard';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setScorecard(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() } as AnalyzeRequest),
      });

      const data: AnalyzeResponse = await response.json();

      if (!data.success) {
        setError(data.error || 'Analysis failed');
        return;
      }

      setScorecard(data.scorecard!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    if (score >= 40) return 'bg-orange-100';
    return 'bg-red-100';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              🧭 Location Pages Webscore
            </h1>
            <p className="text-lg text-gray-600">
              AI Search Readiness Analyzer for Location Pages
            </p>
          </div>

          {/* URL Input */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex gap-4">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a location page URL (e.g., https://example.com/locations/chicago)"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={handleAnalyze}
                disabled={loading || !url.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
            {error && (
              <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Results */}
          {scorecard && (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-gray-900">Overall Score</h2>
                  <div className="text-sm text-gray-500">
                    Phase {scorecard.phase} • {scorecard.rubric_version}
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className={`w-24 h-24 rounded-full ${getScoreBgColor(scorecard.total_score)} flex items-center justify-center`}>
                    <span className={`text-3xl font-bold ${getScoreColor(scorecard.total_score)}`}>
                      {scorecard.total_score}
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-medium text-gray-900">
                      {scorecard.total_score >= 80 ? 'Excellent' : 
                       scorecard.total_score >= 60 ? 'Good' : 
                       scorecard.total_score >= 40 ? 'Fair' : 'Needs Improvement'}
                    </div>
                    <div className="text-sm text-gray-600">
                      AI Search Readiness
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Category Breakdown</h3>
                <div className="space-y-4">
                  {scorecard.categories.map((category) => (
                    <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{category.label}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            {category.score}/{category.max_score} points
                          </span>
                          <span className={`text-sm font-medium ${getScoreColor(category.percentage)}`}>
                            {category.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            category.percentage >= 80 ? 'bg-green-500' :
                            category.percentage >= 60 ? 'bg-yellow-500' :
                            category.percentage >= 40 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>

                      {/* Check results */}
                      <div className="space-y-2">
                        {category.checks.map((check) => (
                          <div key={check.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                check.status === 'pass' ? 'bg-green-500' :
                                check.status === 'partial' ? 'bg-yellow-500' :
                                check.status === 'fail' ? 'bg-red-500' : 'bg-gray-400'
                              }`} />
                              <span className="text-gray-700">{check.id}: {check.status}</span>
                            </div>
                            <span className="text-gray-500">{check.score} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Details */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Evidence Details</h3>
                <div className="space-y-4">
                  {scorecard.categories.map((category) => (
                    <div key={category.id}>
                      <h4 className="font-medium text-gray-900 mb-2">{category.label}</h4>
                      <div className="space-y-2">
                        {category.checks.map((check) => (
                          <div key={check.id} className="border-l-4 border-gray-200 pl-4">
                            <div className="font-medium text-sm text-gray-700">
                              {check.id}: {check.status} ({check.score} pts)
                            </div>
                            {check.evidence.length > 0 && (
                              <ul className="text-sm text-gray-600 mt-1">
                                {check.evidence.map((evidence, idx) => (
                                  <li key={idx} className="list-disc list-inside">
                                    {evidence}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}