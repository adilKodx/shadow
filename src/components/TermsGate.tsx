import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Shield, FileText, Check, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWhiteLabel, type TermsVersion } from '../hooks/useWhiteLabel';

interface TermsGateProps {
  children: ReactNode;
}

export default function TermsGate({ children }: TermsGateProps) {
  const { user, tenant } = useAuth();
  const { getCurrentTerms, hasAcceptedCurrentTerms, acceptTerms } = useWhiteLabel();
  const [termsNeeded, setTermsNeeded] = useState(false);
  const [terms, setTerms] = useState<TermsVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [checks, setChecks] = useState({ terms: false, privacy: false, ownership: false });

  useEffect(() => {
    async function check() {
      if (!user) { setLoading(false); return; }
      const accepted = await hasAcceptedCurrentTerms(user.id);
      if (!accepted) {
        const t = await getCurrentTerms();
        setTerms(t);
        setTermsNeeded(true);
      }
      setLoading(false);
    }
    check();
  }, [user, hasAcceptedCurrentTerms, getCurrentTerms]);

  const handleAccept = async () => {
    if (!user || !checks.terms || !checks.privacy || !checks.ownership) return;
    setAccepting(true);
    await acceptTerms(user.id, tenant?.id || null);
    setTermsNeeded(false);
    setAccepting(false);
  };

  if (loading) return null;
  if (!termsNeeded) return <>{children}</>;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ pointerEvents: 'auto', isolation: 'isolate' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" style={{ pointerEvents: 'auto' }}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Updated Terms of Service</h2>
              <p className="text-sm text-gray-500">Please review and accept to continue</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Terms summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> ShadowField Inc. owns and operates this platform. All accounts, data, and customer relationships are the property of ShadowField Inc. By continuing, you acknowledge this ownership structure.
            </p>
          </div>

          {/* Expandable T&C */}
          {terms && (
            <>
              <button
                onClick={() => setShowTerms(!showTerms)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">Terms of Service (v{terms.version})</span>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </button>
              {showTerms && (
                <div className="bg-gray-50 rounded-xl p-4 max-h-60 overflow-y-auto">
                  <div className="prose prose-sm prose-gray">
                    {terms.content.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) return <h2 key={i} className="text-base font-bold mt-4 mb-2">{line.replace('# ', '')}</h2>;
                      if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-bold mt-3 mb-1">{line.replace('## ', '')}</h3>;
                      if (line.startsWith('- ')) return <li key={i} className="text-xs text-gray-600 ml-4">{line.replace('- ', '')}</li>;
                      if (line.trim() === '') return <br key={i} />;
                      return <p key={i} className="text-xs text-gray-600 mb-1">{line}</p>;
                    })}
                  </div>
                </div>
              )}

              {terms.privacy_content && (
                <>
                  <button
                    onClick={() => setShowPrivacy(!showPrivacy)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">Privacy Policy</span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </button>
                  {showPrivacy && (
                    <div className="bg-gray-50 rounded-xl p-4 max-h-60 overflow-y-auto">
                      <div className="prose prose-sm prose-gray">
                        {terms.privacy_content.split('\n').map((line, i) => {
                          if (line.startsWith('# ')) return <h2 key={i} className="text-base font-bold mt-4 mb-2">{line.replace('# ', '')}</h2>;
                          if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-bold mt-3 mb-1">{line.replace('## ', '')}</h3>;
                          if (line.startsWith('- ')) return <li key={i} className="text-xs text-gray-600 ml-4">{line.replace('- ', '')}</li>;
                          if (line.trim() === '') return <br key={i} />;
                          return <p key={i} className="text-xs text-gray-600 mb-1">{line}</p>;
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Checkboxes */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.terms} onChange={e => setChecks({ ...checks, terms: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-gray-300" />
              <span className="text-sm text-gray-700">I have read and agree to the <strong>Terms of Service</strong></span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.privacy} onChange={e => setChecks({ ...checks, privacy: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-gray-300" />
              <span className="text-sm text-gray-700">I have read and agree to the <strong>Privacy Policy</strong></span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.ownership} onChange={e => setChecks({ ...checks, ownership: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-gray-300" />
              <span className="text-sm text-gray-700">
                I understand that <strong>ShadowField Inc.</strong> owns all accounts, data, and customer relationships on this platform
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100">
          <button
            onClick={handleAccept}
            disabled={accepting || !checks.terms || !checks.privacy || !checks.ownership}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {accepting ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <Check className="w-5 h-5" /> Accept & Continue
              </>
            )}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            ShadowField Inc. © {new Date().getFullYear()} — All rights reserved
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
