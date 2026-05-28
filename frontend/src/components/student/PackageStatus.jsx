import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { packagesApi } from '../../api'

const DURATION_LABEL = { 25: '25분', 50: '50분' }
const DURATION_COLOR = {
  25: { card: 'border-sky-100 bg-sky-50/30', badge: 'bg-sky-100 text-sky-700', bar: 'bg-sky-400' },
  50: { card: 'border-violet-100 bg-violet-50/30', badge: 'bg-violet-100 text-violet-700', bar: 'bg-violet-400' },
}

function PackageCard({ pkg }) {
  const remaining = pkg.total_lessons - pkg.completed_lessons
  const pct       = pkg.total_lessons > 0 ? Math.round((pkg.completed_lessons / pkg.total_lessons) * 100) : 0
  const colors    = DURATION_COLOR[pkg.duration_minutes] ?? DURATION_COLOR[25]
  const isFinished = remaining <= 0

  return (
    <div className={`border rounded-xl p-4 ${colors.card}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
            {DURATION_LABEL[pkg.duration_minutes]} 수업
          </span>
          {pkg.label && (
            <p className="text-xs text-gray-400 mt-1">{pkg.label}</p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${isFinished ? 'text-orange-500' : 'text-gray-800'}`}>
            {remaining}
          </p>
          <p className="text-xs text-gray-400">남은 수업</p>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
        <div
          className={`h-2 rounded-full transition-all ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        완료 <span className="font-medium">{pkg.completed_lessons}</span>회 /
        전체 <span className="font-medium">{pkg.total_lessons}</span>회
        {isFinished && (
          <span className="ml-2 text-orange-500 font-medium">· 수업권 소진 완료</span>
        )}
      </p>
    </div>
  )
}

export default function PackageStatus() {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    packagesApi.list()
      .then(data => setPackages(data.filter(p => p.is_active)))
      .catch(() => toast.error('수업권 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  if (packages.length === 0) {
    return (
      <section className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="text-base font-semibold text-gray-800 mb-2">내 수업권</h3>
        <p className="text-sm text-gray-400">
          등록된 수업권이 없습니다. 선생님께 문의해 주세요.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 mb-6">
      <h3 className="text-base font-semibold text-gray-800 mb-3">내 수업권</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {packages.map(pkg => (
          <PackageCard key={pkg.id} pkg={pkg} />
        ))}
      </div>
    </section>
  )
}
