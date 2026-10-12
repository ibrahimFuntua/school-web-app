import { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import OfflineBanner from '../shared/OfflineBanner'
import { useSections } from '../../hooks/useSections'

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { restricted, position, sections, loading } = useSections()
  const identity = { position, sectionNames: sections.map(s => s.name) }
  const noSections = restricted && !loading && sections.length === 0

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        identity={identity}
      />
      <Navbar onMenuClick={() => setSidebarOpen(true)} identity={identity} />
      <main className="lg:ml-64 pt-16 min-h-screen">
        <OfflineBanner />
        {noSections && (
          <div className="mx-4 lg:mx-6 mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg px-4 py-3">
            No sections are assigned to you yet, so there is nothing to show. Ask the Admin to set
            "Managed by" on your sections
          </div>
        )}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default AdminLayout