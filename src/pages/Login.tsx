import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { appName, primaryColor, tagline, logoUrl, loginBgUrl } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message || 'Invalid credentials');
      setLoading(false);
    } else {
      // Navigate to root and let DefaultLanding pick the right destination
      // based on role (tenant → /dashboard, platform admin → /white-label,
      // partner-only → /partner). Avoids hard-coding /dashboard which would
      // get redirected anyway for non-tenant users.
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: branding panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12"
        style={{
          background: loginBgUrl
            ? `url(${loginBgUrl}) center/cover`
            : `linear-gradient(135deg, ${primaryColor} 0%, #0ea5e9 50%, #06b6d4 100%)`,
        }}
      >
        <div className="text-center text-white">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="w-20 h-20 mx-auto mb-6 rounded-2xl" />
          ) : (
            <div className="w-20 h-20 mx-auto mb-6 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Shield className="w-10 h-10 text-white" />
            </div>
          )}
          <h1 className="text-4xl font-bold mb-3">{appName}</h1>
          <p className="text-lg text-white/80 max-w-md">{tagline}</p>
          <div className="mt-8 grid grid-cols-2 gap-4 max-w-sm mx-auto text-sm">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-left">
              <p className="font-semibold">Real-time Alerts</p>
              <p className="text-white/70 text-xs mt-1">Instant team-wide notifications</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-left">
              <p className="font-semibold">Incident Tracking</p>
              <p className="text-white/70 text-xs mt-1">Document & manage all events</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-left">
              <p className="font-semibold">Secure Chat</p>
              <p className="text-white/70 text-xs mt-1">Encrypted team communication</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-left">
              <p className="font-semibold">Video Feeds</p>
              <p className="text-white/70 text-xs mt-1">Monitor all camera feeds</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, #0ea5e9)` }}
            >
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{appName}</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-10"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
