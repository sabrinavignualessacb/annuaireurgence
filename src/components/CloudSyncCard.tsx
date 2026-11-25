import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  UploadCloud,
  Users,
} from 'lucide-react';
import {
  createSiteInviteInFirestore,
  listSiteInvites,
  listSiteMembers,
  SiteInviteRecord,
  SiteMemberRecord,
} from '../services/firestoreSync';

interface CloudSyncCardProps {
  user: User | null;
  authReady: boolean;
  siteId: string | null;
  siteOwnerUid: string | null;
  sharedUids: string[];
  syncStatus: 'local' | 'connecting' | 'synced' | 'error';
  syncError: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onPushLocalToCloud: () => Promise<void>;
  onJoinWithCode: (code: string) => Promise<void>;
  onSyncMembersAccess: (memberUids: string[]) => Promise<void>;
}

export const CloudSyncCard: React.FC<CloudSyncCardProps> = ({
  user,
  authReady,
  siteId,
  siteOwnerUid,
  sharedUids,
  syncStatus,
  syncError,
  onSignIn,
  onSignOut,
  onPushLocalToCloud,
  onJoinWithCode,
  onSyncMembersAccess,
}) => {
  const [invites, setInvites] = useState<SiteInviteRecord[]>([]);
  const [members, setMembers] = useState<SiteMemberRecord[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const isOwnerOrAdmin =
    Boolean(user) &&
    (user?.uid === siteOwnerUid ||
      (Boolean(user?.emailVerified) &&
        user?.email?.toLowerCase() === 'service.qse.33450@gmail.com'));

  const refreshSharingData = async () => {
    if (!user || !siteId || !isOwnerOrAdmin) return;
    try {
      const [invList, memList] = await Promise.all([
        listSiteInvites(siteId, user),
        listSiteMembers(siteId),
      ]);
      setInvites(invList);
      setMembers(memList);
    } catch {
      // Handled silently in card refresh
    }
  };

  useEffect(() => {
    void refreshSharingData();
  }, [user?.uid, siteId, isOwnerOrAdmin]);

  const handleGenerateInvite = async (role: 'editor' | 'viewer') => {
    if (!user || !siteId) return;
    setBusy(true);
    setMessage(null);
    try {
      const code = await createSiteInviteInFirestore(siteId, user.uid, role);
      await refreshSharingData();
      setMessage({
        type: 'ok',
        text: `Code d’invitation créé : ${code} (${role === 'editor' ? 'Éditeur' : 'Lecteur'}).`,
      });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur création du code.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSyncMembers = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const uids = members.map((m) => m.uid);
      await onSyncMembersAccess(uids);
      setMessage({
        type: 'ok',
        text: 'Droits de synchronisation mis à jour pour tous les membres.',
      });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur lors de la synchronisation des droits.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await onJoinWithCode(joinCode.trim());
      setJoinCode('');
      setMessage({
        type: 'ok',
        text: 'Vous avez rejoint le site partagé. Demandez au propriétaire de cliquer sur « Synchroniser les droits » si les données ne s’affichent pas encore.',
      });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Impossible de rejoindre ce code.',
      });
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (code: string) => {
    try {
      const url = `${window.location.origin}?invite=${code}`;
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const pendingMembersCount = members.filter((m) => !sharedUids.includes(m.uid)).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-lg shrink-0 ${
              syncStatus === 'synced'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {syncStatus === 'synced' ? (
              <Cloud className="w-5 h-5" />
            ) : (
              <CloudOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">
              Sauvegarde Cloud Firebase &amp; Partage d&apos;équipe
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {!authReady
                ? 'Vérification de la session...'
                : user
                ? `Connecté en tant que ${user.displayName || user.email} · Base : ${
                    siteId || 'Initialisation...'
                  }`
                : 'Mode local uniquement. Connectez-vous avec Google pour sauvegarder en ligne et partager avec vos collègues.'}
            </p>
          </div>
        </div>

        {authReady &&
          (user ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>Se connecter avec Google</span>
            </button>
          ))}
      </div>

      {syncError && (
        <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {syncError}
        </p>
      )}

      {message && (
        <p
          className={`text-xs font-medium rounded-lg p-3 border ${
            message.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {message.text}
        </p>
      )}

      {user && siteId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          {/* Synchronisation & Partage propriétaire */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" />
                <h3 className="font-display font-semibold text-sm text-slate-900">
                  Gestion de la sauvegarde &amp; des accès
                </h3>
              </div>
              {syncStatus === 'synced' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Synchronisé
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMessage(null);
                  try {
                    await onPushLocalToCloud();
                    setMessage({
                      type: 'ok',
                      text: 'Données locales envoyées et synchronisées sur Firebase.',
                    });
                  } catch (err) {
                    setMessage({
                      type: 'err',
                      text: err instanceof Error ? err.message : 'Erreur d’envoi.',
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Ré-envoyer données locales</span>
              </button>

              {isOwnerOrAdmin && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleGenerateInvite('editor')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Créer un code d&apos;invitation</span>
                </button>
              )}
            </div>

            {isOwnerOrAdmin && invites.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Codes d&apos;invitation actifs
                </p>
                {invites
                  .filter((i) => i.active)
                  .slice(0, 4)
                  .map((inv) => (
                    <div
                      key={inv.code}
                      className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs"
                    >
                      <span className="font-mono-num font-bold text-slate-900">{inv.code}</span>
                      <button
                        type="button"
                        onClick={() => copyText(inv.code)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedCode === inv.code ? 'Lien copié' : 'Copier le lien'}</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {isOwnerOrAdmin && members.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200/80">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Collaborateurs ({members.length})
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSyncMembers}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer ${
                      pendingMembersCount > 0
                        ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>
                      {pendingMembersCount > 0
                        ? `Autoriser la synchro (${pendingMembersCount})`
                        : 'Actualiser droits'}
                    </span>
                  </button>
                </div>
                <div className="space-y-1">
                  {members.map((m) => (
                    <div
                      key={m.uid}
                      className="flex items-center justify-between text-xs text-slate-700 bg-white px-2.5 py-1.5 rounded border border-slate-200"
                    >
                      <span className="font-medium truncate">{m.displayName}</span>
                      <span className="text-[11px] text-slate-500">
                        {sharedUids.includes(m.uid) ? 'Synchronisé' : 'En attente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rejoindre un site partagé */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="font-display font-semibold text-sm text-slate-900">
              Rejoindre l&apos;annuaire partagé d&apos;un collègue
            </h3>
            <p className="text-xs text-slate-600">
              Si un responsable QSE vous a communiqué un code d&apos;invitation (ex.{' '}
              <span className="font-mono-num">QSE-A1B2C3</span>), saisissez-le ci-dessous pour
              accéder au même annuaire.
            </p>
            <form onSubmit={handleJoinSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Code d'invitation..."
                className="flex-1 px-3 py-2 text-xs font-mono-num uppercase font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
              <button
                type="submit"
                disabled={busy || !joinCode.trim()}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                Rejoindre
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
