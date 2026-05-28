import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate   = useNavigate()
  const { t } = useTranslation()
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'student' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signUp(form)
      toast.success(t('auth.register_success'))
      navigate('/login')
    } catch (err) {
      toast.error(err.message || t('auth.register_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('auth.register_title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.name')}</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('auth.name_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('auth.password_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('auth.role')}</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'student', label: t('auth.role_student') },
                { value: 'teacher', label: t('auth.role_teacher') },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, role: opt.value }))}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.role === opt.value
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-gray-300 text-gray-600 hover:border-primary-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t('auth.register_loading') : t('auth.register_submit')}
          </button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-500">
          {t('auth.have_account')}{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">
            {t('auth.login_link')}
          </Link>
        </p>
      </div>
    </div>
  )
}
