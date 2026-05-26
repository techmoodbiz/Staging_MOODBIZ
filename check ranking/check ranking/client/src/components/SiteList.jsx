export default function SiteList({ sites, selectedSite, onSelect, onDelete }) {
  if (sites.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No websites added yet</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {sites.map((site) => (
        <li
          key={site.id}
          className={`p-3 rounded-lg cursor-pointer transition ${
            selectedSite?.id === site.id
              ? 'bg-blue-100 border-2 border-blue-500'
              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
          }`}
        >
          <div onClick={() => onSelect(site)} className="flex-1">
            <p className="font-medium text-gray-900">{site.name}</p>
            <p className="text-sm text-gray-500">{site.domain}</p>
            {site.lastChecked && (
              <p className="text-xs text-gray-400 mt-1">
                Last: {new Date(site.lastChecked).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(site.id)
            }}
            className="text-red-500 hover:text-red-700 text-sm mt-2"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
