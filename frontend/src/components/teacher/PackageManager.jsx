import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { packagesApi } from '../../api'

const DURATION_LABEL = { 25: '25분', 50: '50분' }

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
  const remaining = pkg.total_lessons - pkg.completed_lessons
  const isFinished = remaining <= 0

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
              {DURATION_LABEL[pkg.duration_minutes]} 수업
            </span>
            {!pkg.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">비활성</span>
            )}
            {isFinished && pkg.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">소진 완료</span>
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
          <p className="text-xs text-gray-400">남은 수업</p>
        </div>
      </div>

      <ProgressBar completed={pkg.completed_lessons} total={pkg.total_lessons} />
      <p className="text-xs text-gray-400 mt-1">완료 {pkg.completed_lessons}회</p>

      {pkg.is_active && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onAddLessons(pkg)}
            className="flex-1 text-xs border border-teal-200 text-teal-600 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
          >
            수업 추가
          </button>
          <button
            onClick={() => onDeactivate(pkg)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 transition-colors"
          >
            비활성화
          </button>
          <button
            onClick={() => onDelete(pkg)}
            className="text-xs text-red-400 hover:text-red-600 px-2 transition-colors"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  )
}

export default function PackageManager() {
  const [packages, setPackages] = useState([])
  const [students, setStudents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [addingTo, setAddingTo] = useState(null) // { pkg, count }
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
      toast.error('데이터를 불러오지 못했습니다.')
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
      toast.success('패키지가 생성되었습니다.')
      setShowForm(false)
      setForm({ student_id: '', duration_minutes: '25', total_lessons: '', label: '', initial_completed: '0' })
      load()
    } catch {
      toast.error('패키지 생성에 실패했습니다.')
    }
  }

  async function handleAddLessons(pkg, count) {
    try {
      await packagesApi.update(pkg.id, { add_lessons: count })
      toast.success(`${count}회 추가되었습니다.`)
      setAddingTo(null)
      load()
    } catch {
      toast.error('수업 추가에 실패했습니다.')
    }
  }

  async function handleDeactivate(pkg) {
    if (!confirm(`${pkg.student?.full_name}의 ${DURATION_LABEL[pkg.duration_minutes]} 패키지를 비활성화하시겠습니까?`)) return
    try {
      await packagesApi.update(pkg.id, { is_active: false })
      toast.success('패키지가 비활성화되었습니다.')
      load()
    } catch {
      toast.error('비활성화에 실패했습니다.')
    }
  }

  async function handleDelete(pkg) {
    if (!confirm(`${pkg.student?.full_name}의 패키지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return
    try {
      await packagesApi.remove(pkg.id)
      toast.success('패키지가 삭제되었습니다.')
      load()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const activePackages   = packages.filter(p => p.is_active)
  const inactivePackages = packages.filter(p => !p.is_active)

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">수업권 관리</h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-sm bg-teal-500 text-white px-3 py-1.5 rounded-lg hover:bg-teal-600 transition-colors"
        >
          + 패키지 추가
        </button>
      </div>

      {/* 패키지 생성 폼 */}
      {showForm && (
        <form onSubmit={handleCreate} className="border border-teal-100 rounded-xl p-4 mb-4 bg-teal-50/30 space-y-3">
          <p className="text-sm font-medium text-gray-700">새 패키지 등록</p>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">학생</label>
            <select
              required
              value={form.student_id}
              onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            >
              <option value="">학생 선택</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">수업 종류</label>
              <select
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              >
                <option value="25">25분</option>
                <option value="50">50분</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">총 수업 수</label>
              <input
                required
                type="number"
                min="1"
                value={form.total_lessons}
                onChange={e => setForm(f => ({ ...f, total_lessons: e.target.value }))}
                placeholder="예: 20"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              이미 완료한 수업 수 <span className="text-gray-400">(기존 데이터 이관 시 입력)</span>
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
            <label className="text-xs text-gray-500 mb-1 block">라벨 (선택)</label>
            <input
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="예: 2025년 5월 패키지"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 bg-teal-500 text-white text-sm py-2 rounded-lg hover:bg-teal-600 transition-colors"
            >
              등록
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-200 text-gray-500 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* 수업 추가 모달 */}
      {addingTo && (
        <div className="border border-teal-100 rounded-xl p-4 mb-4 bg-teal-50/30">
          <p className="text-sm font-medium text-gray-700 mb-3">
            {addingTo.pkg.student?.full_name} — {DURATION_LABEL[addingTo.pkg.duration_minutes]} 수업 추가
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={addingTo.count}
              onChange={e => setAddingTo(a => ({ ...a, count: e.target.value }))}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
              placeholder="추가할 수업 수"
            />
            <button
              onClick={() => handleAddLessons(addingTo.pkg, Number(addingTo.count))}
              disabled={!addingTo.count || Number(addingTo.count) < 1}
              className="bg-teal-500 text-white text-sm px-4 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-40"
            >
              추가
            </button>
            <button
              onClick={() => setAddingTo(null)}
              className="border border-gray-200 text-gray-500 text-sm px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 활성 패키지 */}
      <div className="space-y-3 max-h-[480px] overflow-y-auto">
        {activePackages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            등록된 수업권 패키지가 없습니다.
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

        {/* 비활성 패키지 */}
        {inactivePackages.length > 0 && (
          <details className="pt-2">
            <summary className="text-xs text-gray-400 cursor-pointer select-none hover:text-gray-600">
              비활성 패키지 {inactivePackages.length}개
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
