import { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import OfflineBanner from '../shared/OfflineBanner'

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <main className="lg:ml-64 pt-16 min-h-screen">
        <OfflineBanner />
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default AdminLayout