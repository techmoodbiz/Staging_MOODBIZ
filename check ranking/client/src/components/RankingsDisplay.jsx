import { useState, useEffect } from 'react'

const API_URL = 'http://localhost:5000/api'

function getRankingBadge(position) {
  if (!position) return <span className="text-gray-500 text-sm">Not ranked</span>
  if (position <= 10) return <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-semibold">🥇 #{position}</span>
  if (position <= 30) return <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-semibold">🥈 #{position}</span>
  if (position <= 50) return <span className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full font-semibold">🥉 #{position}</span>
  return <span className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full font-semibold">#{position}</span>
}

export default function RankingsDisplay({ siteId, siteDomain }) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('position')

  useEffect(() => {
    fetchRankings()
    const interval = setInterval(fetchRankings, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [siteId])

  const fetchRankings = async () => {
    try {
      const res = await fetch(`${API_URL}/rankings/${siteId}`)
      const data = await res.json()
      setRankings(data)
    } catch (error) {
      console.error('Error fetching rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedRankings = [...rankings].sort((a, b) => {
    if (sortBy === 'position') {
      if (!a.position) return 1
      if (!b.position) return -1
      return a.position - b.position
    } else if (sortBy === 'keyword') {
      return a.keyword.localeCompare(b.keyword)
    }
    return 0
  })

  const topRankings = sortedRankings.filter(r => r.position && r.position <= 10).length
  const inTop50 = sortedRankings.filter(r => r.position && r.position <= 50).length
  const notRanked = sortedRankings.filter(r => !r.position).length

  return (
    <div className="space-y-6">
      {rankings.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
            <p className="text-green-700 text-sm font-medium">Top 10</p>
            <p className="text-3xl font-bold text-green-900 mt-1">{topRankings}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700 text-sm font-medium">Top 50</p>
            <p className="text-3xl font-bold text-blue-900 mt-1">{inTop50}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4">
            <p className="text-gray-700 text-sm font-medium">Not Ranked</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{notRanked}</p>
          </div>
        </div>
      )}

      {rankings.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="position">Position (Best First)</option>
            <option value="keyword">Keyword (A-Z)</option>
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading rankings...</p>
      ) : rankings.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No ranking data yet. Add keywords and click "Check Rankings".</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Keyword</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Position</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Last Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedRankings.map((ranking) => (
                <tr key={ranking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{ranking.keyword}</td>
                  <td className="px-6 py-4 text-sm">{getRankingBadge(ranking.position)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {ranking.checkedAt
                      ? new Date(ranking.checkedAt).toLocaleDateString() + ' ' +
                        new Date(ranking.checkedAt).toLocaleTimeString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
