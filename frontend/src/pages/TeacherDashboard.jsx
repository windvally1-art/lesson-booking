import { useAuth } from '../context/AuthContext'
import SlotManager from '../components/teacher/SlotManager'
import BookingList  from '../components/teacher/BookingList'

export default function TeacherDashboard() {
  const { profile } = useAuth()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <SlotManager />
        </div>
        <div className="lg:col-span-2">
          <BookingList />
        </div>
      </div>
    </div>
  )
}
