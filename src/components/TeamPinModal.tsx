import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, LockOpen, X } from 'lucide-react';

interface TeamPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (pin: string, displayName: string) => Promise<void>;
}

const NAME_STORAGE_KEY = 'annuaire_team_member_name';

export const TeamPinModal: React.FC<TeamPinModalProps> = ({
  isOpen,
  onClose,
  onUnlock,
}) => {
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem(NAME_STORAGE_KEY) || ''
  );
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Veuillez saisir le code PIN d’équipe.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cleanName = displayName.trim() || 'Équipe QSE';
      if (displayName.trim()) {
        localStorage.setItem(NAME_STORAGE_KEY, displayName.trim());
      }
      await onUnlock(pin.trim(), cleanName);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Code PIN incorrect ou accès refusé.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-slate-900">
                Déverrouiller les modifications
              </h2>
              <p className="text-xs text-slate-500">
                Accès équipe SharePoint sans compte Google
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Saisissez le <strong>code PIN d&apos;équipe</strong> communiqué par votre
            responsable QSE pour modifier les fiches, les zones ou les logos et les
            enregistrer pour tout le monde.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Votre nom / prénom (optionnel)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex. Marie Martin"
              maxLength={80}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Code PIN d&apos;équipe *
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Saisir le code PIN..."
                autoFocus
                className="w-full pl-3 pr-10 py-2 text-sm font-mono-num tracking-wider border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                tabIndex={-1}
                aria-label={showPin ? 'Masquer' : 'Afficher'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || !pin.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#D91E18] hover:bg-[#B91C1C] text-white rounded-lg disabled:opacity-40 cursor-pointer"
            >
              <LockOpen className="w-3.5 h-3.5" />
              <span>{busy ? 'Vérification...' : 'Déverrouiller'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
