import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTranslation } from 'react-i18next'

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="relative bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between sticky top-0 z-50">
      <div className="w-24" />
      <Link to="/" className="absolute left-1/2 -translate-x-1/2">
        <img src="/header-logo.jpg" alt="Arin Korean Lab" className="h-[60px] w-auto object-contain" />
      </Link>

      <div className="flex items-center gap-4">
        {/* 언어 전환 */}
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => i18n.changeLanguage('ko')}
            className={i18n.language === 'ko' ? 'font-bold text-teal-600' : 'text-gray-400 hover:text-gray-600'}
          >
            {t('lang.ko')}
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => i18n.changeLanguage('ja')}
            className={i18n.language === 'ja' ? 'font-bold text-teal-600' : 'text-gray-400 hover:text-gray-600'}
          >
            {t('lang.ja')}
          </button>
        </div>

        {profile && (
          <>
            <span className="text-sm text-gray-600">
              <span className="font-medium">{profile.full_name}</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700">
                {profile.role === 'teacher' ? t('nav.role_teacher') : t('nav.role_student')}
              </span>
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              {t('nav.logout')}
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
