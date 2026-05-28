import BookingCalendar from '../components/student/BookingCalendar'
import BookingHistory  from '../components/student/BookingHistory'
import PackageStatus   from '../components/student/PackageStatus'

export default function StudentDashboard() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PackageStatus />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <BookingCalendar />
        </div>
        <div className="lg:col-span-2">
          <BookingHistory />
        </div>
      </div>
    </div>
  )
}
