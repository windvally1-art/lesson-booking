import { useState } from 'react'
import SlotManager    from '../components/teacher/SlotManager'
import BookingList    from '../components/teacher/BookingList'
import PackageManager from '../components/teacher/PackageManager'

const TABS = [
  { id: 'schedule', label: '일정 관리' },
  { id: 'packages', label: '수업권 관리' },
]

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState('schedule')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <SlotManager />
          </div>
          <div className="lg:col-span-2">
            <BookingList />
          </div>
        </div>
      )}

      {activeTab === 'packages' && (
        <div className="max-w-lg">
          <PackageManager />
        </div>
      )}
    </div>
  )
}
