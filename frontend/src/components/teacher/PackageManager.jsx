import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { packagesApi } from '../../api'

function ProgressBar({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
      <div
        className="bg-teal-500 h-2 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function PackageCard({ pkg, onAddLessons, onDeactivate, onDelete }) {
  const { t } = useTranslation()
  const remaining = pkg.total_lessons - pkg.completed_lessons
  const isFinished = remaining <= 0
  const durationLabel = t(`package_manager.duration_${pkg.duration_minutes}`)

  return (
    <div className={`border rounded-xl p-4 ${
      !pkg.is_active ? 'border-gray-100 bg-gray-50 opacity-60' :
      isFinished     ? 'border-orange-100 bg-orange-50' :
                       'border-gray-100 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
              {durationLabel} {t('package_manager.lesson_suffix')}
            </span>
            {!pkg.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">{t('package_manager.inactive_badge')}</span>
            )}
            {isFinished && pkg.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">{t('package_manager.depleted_badge')}</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-800 mt-1 truncate">
            {pkg.student?.full_name}
          </p>
          {pkg.label && (
            <p className="text-xs text-gray-400 mt-0.5">{pkg.label}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-800">
            {remaining}
            <span className="text-sm font-normal text-gray-400"> / {pkg.total_lessons}</span>
          </p>
          <p className="text-xs text-gray-400">{t('package_manager.remaining')}</p>
        </div>
      </div>

      <ProgressBar completed={pkg.completed_lessons} total={pkg.total_lessons} />
      <p className="text-xs text-gray-400 mt-1">
        {t('package_manager.completed_label')} {pkg.completed_lessons}{t('package_manager.sessions_suffix')}
      </p>

      {pkg.is_active && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onAddLessons(pkg)}
            className="flex-1 text-xs border border-teal-200 text-teal-600 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
          >
            {t('package_manager.add_lessons_btn')}
          </button>
          <button
            onClick={() => onDeactivate(pkg)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 transition-colors"
          >
            {t('package_manager.deactivate_btn')}
          </button>
          <button
            onClick={() => onDelete(pkg)}
            className="text-xs text-red-400 hover:text-red-600 px-2 transition-colors"
          >
            {t('package_manager.delete_btn')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function PackageManager() {
  const { t } = useTranslation()
  const [packages, setPackages] = useState([])
  const [students, setStudents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [addingTo, setAddingTo] = useState(null)
  const [form, setForm] = useState({
    student_id: '',
    duration_minutes: '25',
    total_lessons: '',
    label: '',
    initial_completed: '0',
  })

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [pkgs, studs] = await Promise.all([
        packagesApi.list(),
        packagesApi.listStudents(),
      ])
      setPackages(pkgs)
      setStudents(studs)
    } catch {
      toast.error(t('package_manager.error_load'))
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await packagesApi.create({
        student_id:        form.student_id,
        duration_minutes:  Number(form.duration_minutes),
        total_lessons:     Number(form.total_lessons),
        label:             form.label || undefined,
        initial_completed: Number(form.initial_completed),
      })
      toast.success(t('package_manager.create_success'))
      setShowForm(false)
      setForm({ student_id: '', duration_minutes: '25', total_lessons: '', label: '', initial_completed: '0' })
      load()
    } catch {
      toast.error(t('package_manager.create_error'))
    }
  }

  async function handleAddLessons(pkg, count) {
    try {
      await packagesApi.update(pkg.id, { add_lessons: count })
      toast.success(t('package_manager.add_success', { count }))
      setAddingTo(null)
      load()
    } catch {
      toast.error(t('package_manager.add_error'))
    }
  }

  async function handleDeactivate(pkg) {
    const durationLabel = t(`package_manager.duration_${pkg.duration_minutes}`)
    if (!confirm(t('package_manager.deactivate_confirm', { name: pkg.student?.full_name, duration: durationLabel }))) return
    try {
      await packagesApi.update(pkg.id, { is_active: false })
      toast.success(t('package_manager.deactivate_success'))
      load()
    } catch {
      toast.error(t('package_manager.deactivate_error'))
    }
  }

  async function handleDelete(pkg) {
    if (!confirm(t('package_manager.delete_confirm', { name: pkg.student?.full_name }))) return
    try {
      await packagesApi.remove(pkg.id)
      toast.success(t('package_manager.delete_success'))
      load()
    } catch {
      toast.error(t('package_manager.delete_error'))
    }
  }

  const activePackages   = packages.filter(p => p.is_active)
  const inactivePackages = packages.filter(p => !p.is_active)

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{t('package_manager.title')}</h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-sm bg-teal-500 text-white px-3 py-1.5 rounded-lg hover:bg-teal-600 transition-colors"
        >
          {t('package_manager.add_package_btn')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-teal-100 rounded-xl p-4 mb-4 bg-teal-50/30 space-y-3">
          <p className="text-sm font-medium text-gray-700">{t('package_manager.new_package_title')}</p>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('package_manager.student_label')}</label>
            <select
              required
              value={form.student_id}
              onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            >
              <option value="">{t('package_manager.student_placeholder')}</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('package_manager.duration_label')}</label>
              <select
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              >
                <option value="25">{t('package_manager.duration_25')}</option>
                <option value="50">{t('package_manager.duration_50')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t('package_manager.total_lessons_label')}</label>
              <input
                required
                type="number"
                min="1"
                value={form.total_lessons}
                onChange={e => setForm(f => ({ ...f, total_lessons: e.target.value }))}
                placeholder={t('package_manager.total_placeholder')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {t('package_manager.initial_label')} <span className="text-gray-400">({t('package_manager.initial_hint')})</span>
            </label>
            <input
              type="number"
              min="0"
              value={form.initial_completed}
              onChange={e => setForm(f => ({ ...f, initial_completed: e.target.value }))}
              placeholder="0"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('package_manager.label_field')}</label>
            <input
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder={t('package_manager.label_placeholder')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 bg-teal-500 text-white text-sm py-2 rounded-lg hover:bg-teal-600 transition-colors"
            >
              {t('package_manager.register_btn')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-200 text-gray-500 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('package_manager.cancel_btn')}
            </button>
          </div>
        </form>
      )}

      {addingTo && (
        <div className="border border-teal-100 rounded-xl p-4 mb-4 bg-teal-50/30">
          <p className="text-sm font-medium text-gray-700 mb-3">
            {t('package_manager.add_lessons_modal_title', {
              name: addingTo.pkg.student?.full_name,
              duration: t(`package_manager.duration_${addingTo.pkg.duration_minutes}`),
            })}
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={addingTo.count}
              onChange={e => setAddingTo(a => ({ ...a, count: e.target.value }))}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder={t('package_manager.add_lessons_placeholder')}
            />
            <button
              onClick={() => handleAddLessons(addingTo.pkg, Number(addingTo.count))}
              disabled={!addingTo.count || Number(addingTo.count) < 1}
              className="bg-teal-500 text-white text-sm px-4 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-40"
            >
              {t('package_manager.add_btn')}
            </button>
            <button
              onClick={() => setAddingTo(null)}
              className="border border-gray-200 text-gray-500 text-sm px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('package_manager.cancel_btn')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-[480px] overflow-y-auto">
        {activePackages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            {t('package_manager.empty')}
          </p>
        )}
        {activePackages.map(pkg => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            onAddLessons={p => setAddingTo({ pkg: p, count: '' })}
            onDeactivate={handleDeactivate}
            onDelete={handleDelete}
          />
        ))}

        {inactivePackages.length > 0 && (
          <details className="pt-2">
            <summary className="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-600">
              {t('package_manager.inactive_count', { count: inactivePackages.length })}
            </summary>
            <div className="space-y-2 mt-2">
              {inactivePackages.map(pkg => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onAddLessons={p => setAddingTo({ pkg: p, count: '' })}
                  onDeactivate={handleDeactivate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  )
}
