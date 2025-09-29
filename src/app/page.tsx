'use client';

import { useState } from 'react';
import { AnalyzeRequest, AnalyzeResponse, Scorecard } from '@/types/scorecard';
import { getAllCategoriesWithChecks, getCheckInfo } from '@/lib/analyze/checkInfo';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState<'check' | 'rubric' | 'evidence'>('check');
  
  // const allCategories = getAllCategoriesWithChecks();

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-600 bg-green-50';
      case 'partial': return 'text-yellow-600 bg-yellow-50';
      case 'fail': return 'text-red-600 bg-red-50';
      case 'na': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return '✅';
      case 'partial': return '⚠️';
      case 'fail': return '❌';
      case 'na': return '➖';
      default: return '❓';
    }
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Analyze URL</h2>
             <button
               onClick={() => {
                 setDrawerContent('rubric');
                 setDrawerOpen(true);
               }}
               className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
             >
               📊 View Rubric
             </button>
            </div>
            <div className="flex gap-4">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a location page URL (e.g., https://example.com/locations/chicago)"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
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
                        {category.checks.map((check) => {
                          const checkInfo = getCheckInfo(check.id);
                          const checkName = checkInfo?.name || check.id;
                          return (
                            <div key={check.id} className="flex items-center justify-between text-sm p-2 rounded-lg border">
                              <div className="flex items-center gap-3 flex-1">
                                <span className="text-lg">{getStatusIcon(check.status)}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">{checkName}</span>
                                    <button
                                      onClick={() => {
                                        setSelectedCheck(check.id);
                                        setDrawerContent('check');
                                        setDrawerOpen(true);
                                      }}
                                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                    >
                                      Info
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedCheck(check.id);
                                        setDrawerContent('evidence');
                                        setDrawerOpen(true);
                                      }}
                                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                    >
                                      Evidence
                                    </button>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {checkInfo?.description}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(check.status)}`}>
                                  {check.status}
                                </span>
                                <span className="text-gray-500 text-xs">{check.score} pts</span>
                              </div>
                            </div>
                          );
                        })}
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
                        {category.checks.map((check) => {
                          const checkInfo = getCheckInfo(check.id);
                          const checkName = checkInfo?.name || check.id;
                          return (
                            <div key={check.id} className="border-l-4 border-gray-200 pl-4 mb-3 p-3 bg-gray-50 rounded-r-lg">
                              <div className="font-medium text-sm text-gray-800 mb-2">
                                {checkName}: <span className={`font-semibold ${check.status === 'pass' ? 'text-green-600' : check.status === 'partial' ? 'text-yellow-600' : 'text-red-600'}`}>{check.status}</span> ({check.score} pts)
                              </div>
                              {check.evidence.length > 0 && (
                                <div className="bg-white p-3 rounded border-l-2 border-gray-300">
                                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Evidence:</div>
                                  <ul className="text-sm text-gray-700 space-y-1">
                                    {check.evidence.map((evidence, idx) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-gray-400 mr-2">•</span>
                                        <span className="flex-1">{evidence}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
          <div 
            className="bg-white w-[500px] h-full shadow-xl border-l border-gray-200 overflow-y-auto pointer-events-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {drawerContent === 'check' 
                        ? (getCheckInfo(selectedCheck)?.name || selectedCheck)
                        : drawerContent === 'evidence'
                        ? `Evidence: ${getCheckInfo(selectedCheck)?.name || selectedCheck}`
                        : 'Scoring Rubric'
                      }
                    </h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              {drawerContent === 'check' && selectedCheck && (() => {
                const checkInfo = getCheckInfo(selectedCheck);
                if (!checkInfo) return null;
                
                return (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2">What it checks</h3>
                      <p className="text-blue-800">{checkInfo.whatItChecks}</p>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-green-900 mb-2">Why it matters</h3>
                      <p className="text-green-800">{checkInfo.whyItMatters}</p>
                    </div>
                    
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-yellow-900 mb-2">How to pass</h3>
                      <p className="text-yellow-800">{checkInfo.howToPass}</p>
                    </div>
                    
                    {checkInfo.examples && checkInfo.examples.length > 0 && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">Examples</h3>
                        <ul className="space-y-2">
                          {checkInfo.examples.map((example, idx) => (
                            <li key={idx} className="text-gray-700 text-sm font-mono bg-white p-2 rounded border">
                              {example}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Category: {checkInfo.category}</span>
                        <span>Weight: {checkInfo.weight} points</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {drawerContent === 'evidence' && selectedCheck && (() => {
                const checkInfo = getCheckInfo(selectedCheck);
                const checkResult = scorecard?.categories
                  .flatMap(cat => cat.checks)
                  .find(check => check.id === selectedCheck);
                
                if (!checkInfo || !checkResult) return null;
                
                return (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2">Check Details</h3>
                      <p className="text-blue-800">{checkInfo.description}</p>
                      <div className="mt-2 text-sm text-blue-700">
                        <span className="font-medium">Status:</span> {checkResult.status} | 
                        <span className="font-medium ml-2">Score:</span> {checkResult.score} points
                      </div>
                    </div>
                    
                    {checkResult.evidence && checkResult.evidence.length > 0 && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">Evidence</h3>
                        <ul className="space-y-2">
                          {checkResult.evidence.map((evidence, idx) => {
                            const isHtml = evidence.includes('HTML:') || evidence.includes('Schema:');
                            const isNegative = evidence.includes('❌') || 
                                              evidence.includes('missing') || 
                                              evidence.includes('No ') || 
                                              evidence.includes('Poor') || 
                                              evidence.includes('fail') || 
                                              evidence.includes('not found') || 
                                              evidence.includes('invalid') || 
                                              evidence.includes('blocked') || 
                                              evidence.includes('error') ||
                                              evidence.includes('Only') ||
                                              evidence.includes('None') ||
                                              evidence.includes('Failed') ||
                                              evidence.includes('Missing') ||
                                              evidence.includes('Insufficient') ||
                                              evidence.includes('Inadequate');
                            const isPositive = evidence.includes('✅') || 
                                              evidence.includes('found') || 
                                              evidence.includes('All ') || 
                                              evidence.includes('Good') || 
                                              evidence.includes('pass') || 
                                              evidence.includes('valid') || 
                                              evidence.includes('matches') ||
                                              evidence.includes('Complete') ||
                                              evidence.includes('Success') ||
                                              evidence.includes('Available') ||
                                              evidence.includes('Present') ||
                                              evidence.includes('Detected') ||
                                              evidence.includes('Located');
                            
                            return (
                              <li key={idx} className={`text-sm p-2 rounded border ${
                                isHtml 
                                  ? 'bg-gray-900 text-green-400 font-mono text-xs' 
                                  : isNegative 
                                    ? 'bg-red-50 text-red-800 border-red-200' 
                                    : isPositive 
                                      ? 'bg-green-50 text-green-800 border-green-200'
                                      : 'bg-white text-gray-700'
                              }`}>
                                {isHtml ? (
                                  <pre className="whitespace-pre-wrap overflow-x-auto">
                                    {evidence.replace(/^(HTML:|Schema:)\s*/, '')}
                                  </pre>
                                ) : (
                                  evidence
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Category: {checkInfo.category}</span>
                        <span>Weight: {checkInfo.weight} points</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {drawerContent === 'rubric' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-3">Scoring Overview</h3>
                    <p className="text-blue-800 text-sm">
                      The analyzer evaluates location pages across 7 categories with a total of 100 points.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Category Weights</h3>
                    <div className="space-y-3">
                      {[
                        { name: 'Fetchability', weight: '20 pts', desc: 'Can bots access and index the page?' },
                        { name: 'Metadata', weight: '20 pts', desc: 'Title, description, Open Graph tags' },
                        { name: 'Schema', weight: '25 pts', desc: 'JSON-LD structured data' },
                        { name: 'Semantic Content', weight: '15 pts', desc: 'Headings, content structure' },
                        { name: 'Freshness', weight: '10 pts', desc: 'Recent updates, sitemap recency' },
                        { name: 'Brand Clarity', weight: '13 pts', desc: 'Consistent branding across elements' },
                        { name: 'Accessibility', weight: '13 pts', desc: 'Image alt text, forms, navigation, video accessibility' }
                      ].map((category, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded border">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900">{category.name}</div>
                              <div className="text-sm text-gray-600">{category.desc}</div>
                            </div>
                            <span className="text-sm font-semibold text-blue-600">{category.weight}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-yellow-900 mb-2">Scoring Details</h3>
                    <p className="text-yellow-800 text-sm">
                      Each check has specific point values. Pass = full points, Partial = 50% points, Fail = 0 points.
                      The final score is calculated as a percentage of total possible points.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}