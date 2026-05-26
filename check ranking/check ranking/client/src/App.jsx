import { useState, useEffect } from 'react'
import SiteList from './components/SiteList'
import SiteForm from './components/SiteForm'
import KeywordManager from './components/KeywordManager'
import RankingsDisplay from './components/RankingsDisplay'

const API_URL = 'http://localhost:5000/api'

export default function App() {
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('sites')

  useEffect(() => {
    fetchSites()
  }, [])

  const fetchSites = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/sites`)
      const data = await res.json()
      setSites(data)
      if (data.length > 0 && !selectedSite) {
        setSelectedSite(data[0])
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSite = async (domain, name) => {
    try {
      const res = await fetch(`${API_URL}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, name })
      })
      const newSite = await res.json()
      setSites([newSite, ...sites])
      setSelectedSite(newSite)
      setActiveTab('keywords')
    } catch (error) {
      console.error('Error adding site:', error)
    }
  }

  const handleDeleteSite = async (siteId) => {
    if (confirm('Are you sure?')) {
      try {
        await fetch(`${API_URL}/sites/${siteId}`, { method: 'DELETE' })
        const updated = sites.filter(s => s.id !== siteId)
        setSites(updated)
        if (selectedSite?.id === siteId) {
          setSelectedSite(updated[0] || null)
        }
      } catch (error) {
        console.error('Error deleting site:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">🔍 Keyword Ranking Checker</h1>
          <p className="text-gray-600 mt-2">Track your website's rankings in Google top 100</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Tracked Sites</h2>
              {loading ? (
                <p className="text-gray-500">Loading...</p>
              ) : (
                <SiteList
                  sites={sites}
                  selectedSite={selectedSite}
                  onSelect={setSelectedSite}
                  onDelete={handleDeleteSite}
                />
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('sites')}
                    className={`px-6 py-4 font-medium border-b-2 ${
                      activeTab === 'sites'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Add Website
                  </button>
                  {selectedSite && (
                    <>
                      <button
                        onClick={() => setActiveTab('keywords')}
                        className={`px-6 py-4 font-medium border-b-2 ${
                          activeTab === 'keywords'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Keywords
                      </button>
                      <button
                        onClick={() => setActiveTab('rankings')}
                        className={`px-6 py-4 font-medium border-b-2 ${
                          activeTab === 'rankings'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Rankings
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'sites' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Add New Website</h3>
                    <SiteForm onAdd={handleAddSite} />
                  </div>
                )}

                {activeTab === 'keywords' && selectedSite && (
                  <KeywordManager siteId={selectedSite.id} siteDomain={selectedSite.domain} />
                )}

                {activeTab === 'rankings' && selectedSite && (
                  <RankingsDisplay siteId={selectedSite.id} siteDomain={selectedSite.domain} />
                )}

                {!selectedSite && activeTab !== 'sites' && (
                  <p className="text-gray-500 text-center py-8">Please select or add a website first</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
