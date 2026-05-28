import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { packagesApi } from '../../api'

const DURATION_COLOR = {
  25: { card: 'border-sky-100 bg-sky-50/30', badge: 'bg-sky-100 text-sky-700', bar: 'bg-sky-400' },
  50: { card: 'border-violet-100 bg-violet-50/30', badge: 'bg-violet-100 text-violet-700', bar: 'bg-violet-400' },
}

function PackageCard({ pkg }) {
  const { t } = useTranslation()
  const remaining = pkg.total_lessons - pkg.completed_lessons
  const pct       = pkg.total_lessons > 0 ? Math.round((pkg.completed_lessons / pkg.total_lessons) * 100) : 0
  const colors    = DURATION_COLOR[pkg.duration_minutes] ?? DURATION_COLOR[25]
  const isFinished = remaining <= 0
  const durationLabel = t(`package_status.duration_${pkg.duration_minutes}`)

  return (
    <div className={`border rounded-xl p-4 ${colors.card}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
            {durationLabel} {t('package_status.lesson_suffix')}
          </span>
          {pkg.label && (
            <p className="text-xs text-gray-400 mt-1">{pkg.label}</p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${isFinished ? 'text-orange-500' : 'text-gray-800'}`}>
            {remaining}
          </p>
          <p className="text-xs text-gray-400">{t('package_status.remaining')}</p>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
        <div
          className={`h-2 rounded-full transition-all ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {t('package_status.completed_label')} <span className="font-medium">{pkg.completed_lessons}</span>{t('package_status.sessions_suffix')} /
        {' '}{t('package_status.total_label')} <span className="font-medium">{pkg.total_lessons}</span>{t('package_status.sessions_suffix')}
        {isFinished && (
          <span className="ml-2 text-orange-500 font-medium">· {t('package_status.depleted')}</span>
        )}
      </p>
    </div>
  )
}

export default function PackageStatus() {
  const { t } = useTranslation()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    packagesApi.list()
      .then(data => setPackages(data.filter(p => p.is_active)))
      .catch(() => toast.error(t('package_status.error_load')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  if (packages.length === 0) {
    return (
      <section className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="text-base font-semibold text-gray-800 mb-2">{t('package_status.title')}</h3>
        <p className="text-sm text-gray-400">
          {t('package_status.empty')}
        </p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 mb-6">
      <h3 className="text-base font-semibold text-gray-800 mb-3">{t('package_status.title')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {packages.map(pkg => (
          <PackageCard key={pkg.id} pkg={pkg} />
        ))}
      </div>
    </section>
  )
}
