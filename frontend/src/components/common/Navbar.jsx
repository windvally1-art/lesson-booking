import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

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

      {profile && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            <span className="font-medium">{profile.full_name}</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-primary-100 text-primary-700">
              {profile.role === 'teacher' ? '선생님' : '학생'}
            </span>
          </span>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            로그아웃
          </button>
        </div>
      )}
    </nav>
  )
}
