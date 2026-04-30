import { useState, useEffect } from 'react'

const API_URL = 'http://localhost:5000/api'

export default function KeywordManager({ siteId, siteDomain }) {
  const [keywords, setKeywords] = useState([])
  const [newKeyword, setNewKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchKeywords()
  }, [siteId])

  const fetchKeywords = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/keywords/${siteId}`)
      const data = await res.json()
      setKeywords(data)
    } catch (error) {
      console.error('Error fetching keywords:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddKeyword = async (e) => {
    e.preventDefault()
    if (!newKeyword.trim()) return

    try {
      const res = await fetch(`${API_URL}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, keyword: newKeyword.trim() })
      })
      const added = await res.json()
      setKeywords([...keywords, added])
      setNewKeyword('')
    } catch (error) {
      console.error('Error adding keyword:', error)
      alert('Error adding keyword')
    }
  }

  const handleDeleteKeyword = async (keywordId) => {
    if (!confirm('Delete this keyword?')) return

    try {
      await fetch(`${API_URL}/keywords/${keywordId}`, { method: 'DELETE' })
      setKeywords(keywords.filter(k => k.id !== keywordId))
    } catch (error) {
      console.error('Error deleting keyword:', error)
      alert('Error deleting keyword')
    }
  }

  const handleRefreshRankings = async () => {
    if (!confirm(`Check rankings for ${keywords.length} keywords? This may take 1-2 minutes...`)) return

    setRefreshing(true)
    try {
      const res = await fetch(`${API_URL}/refresh/${siteId}`, { method: 'POST' })
      const result = await res.json()
      alert(`✓ Checked ${result.checked} keywords`)
      fetchKeywords()
    } catch (error) {
      console.error('Error refreshing rankings:', error)
      alert('Error refreshing rankings: ' + error.message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 Add keywords to track for <strong>{siteDomain}</strong>, then click "Check Rankings" to search Google.
        </p>
      </div>

      <form onSubmit={handleAddKeyword} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter keyword to track..."
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition"
        >
          Add
        </button>
      </form>

      {keywords.length > 0 && (
        <button
          onClick={handleRefreshRankings}
          disabled={refreshing || keywords.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
        >
          {refreshing ? '🔄 Checking Rankings...' : '🔍 Check Rankings'}
        </button>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading keywords...</p>
      ) : keywords.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No keywords added yet</p>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900">Keywords ({keywords.length})</h3>
          <ul className="space-y-1">
            {keywords.map((kw) => (
              <li
                key={kw.id}
                className="flex items-center justify-between bg-gray-50 p-3 rounded-lg hover:bg-gray-100"
              >
                <span className="text-gray-900 font-medium">{kw.keyword}</span>
                <button
                  onClick={() => handleDeleteKeyword(kw.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
