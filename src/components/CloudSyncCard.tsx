import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LockOpen,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';
import {
  createSiteInviteInFirestore,
  getTeamPinForAdmin,
  isAdminUser,
  listSiteInvites,
  listSiteMembers,
  setTeamPinForAdmin,
  SiteInviteRecord,
  SiteMemberRecord,
} from '../services/firestoreSync';

interface CloudSyncCardProps {
  user: User | null;
  authReady: boolean;
  siteId: string | null;
  siteOwnerUid: string | null;
  sharedUids: string[];
  canEditCloud: boolean;
  editorMemberName: string | null;
  anonAuthDisabled: boolean;
  syncStatus: 'local' | 'connecting' | 'synced' | 'error';
  syncError: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenPinModal: () => void;
  onLockEditor: () => Promise<void>;
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
  canEditCloud,
  editorMemberName,
  anonAuthDisabled,
  syncStatus,
  syncError,
  onSignIn,
  onSignOut,
  onOpenPinModal,
  onLockEditor,
  onPushLocalToCloud,
  onJoinWithCode,
  onSyncMembersAccess,
}) => {
  const [invites, setInvites] = useState<SiteInviteRecord[]>([]);
  const [members, setMembers] = useState<SiteMemberRecord[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [teamPin, setTeamPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const isGoogleUser = Boolean(user && !user.isAnonymous);
  const isOwnerOrAdmin =
    Boolean(user && !user.isAnonymous) &&
    (user?.uid === siteOwnerUid || isAdminUser(user));

  const refreshSharingData = async () => {
    if (!user || !siteId || !isOwnerOrAdmin) return;
    try {
      const [invList, memList, currentPin] = await Promise.all([
        listSiteInvites(siteId, user),
        listSiteMembers(siteId),
        getTeamPinForAdmin(siteId),
      ]);
      setInvites(invList);
      setMembers(memList);
      setTeamPin(currentPin);
    } catch {
      // Handled silently in card refresh
    }
  };

  useEffect(() => {
    void refreshSharingData();
  }, [user?.uid, user?.isAnonymous, siteId, isOwnerOrAdmin]);

  const handleSaveTeamPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await setTeamPinForAdmin(siteId, teamPin);
      setTeamPin(saved);
      setMessage({
        type: 'ok',
        text: `Code PIN d’équipe enregistré (${saved}). Toute personne disposant de ce code peut désormais modifier l’annuaire sans compte Google.`,
      });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur lors de la mise à jour du code PIN.',
      });
    } finally {
      setBusy(false);
    }
  };

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
        text: 'Vous avez rejoint le site partagé.',
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
              Sauvegarde Cloud Firebase &amp; Accès Équipe SharePoint
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {!authReady
                ? 'Vérification de la connexion...'
                : isGoogleUser
                ? `Admin connecté : ${user?.displayName || user?.email} · Base : ${
                    siteId || 'Initialisation...'
                  }`
                : user?.isAnonymous && syncStatus === 'synced'
                ? `Session SharePoint synchronisée en temps réel (${
                    canEditCloud
                      ? `Édition activée · ${editorMemberName || 'Équipe QSE'}`
                      : 'Lecture seule'
                  })`
                : 'Mode local uniquement. Connectez-vous ou activez l’accès anonyme Firebase pour SharePoint.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {authReady && user?.isAnonymous && siteId && (
            canEditCloud ? (
              <button
                type="button"
                onClick={onLockEditor}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Verrouiller l&apos;édition</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPinModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#D91E18] text-white rounded-lg hover:bg-[#B91C1C] cursor-pointer"
              >
                <LockOpen className="w-3.5 h-3.5" />
                <span>Déverrouiller (Code PIN)</span>
              </button>
            )
          )}

          {authReady &&
            (isGoogleUser ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnexion Admin</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Connexion Admin Google</span>
              </button>
            ))}
        </div>
      </div>

      {anonAuthDisabled && !isGoogleUser && (
        <div className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
          <strong>Configuration requise dans Firebase Console :</strong> pour que vos
          collègues sur SharePoint accèdent automatiquement à l&apos;annuaire sans
          compte Google, activez le fournisseur <strong>Anonyme</strong> dans{' '}
          <em>Firebase Console → Authentication → Méthode de connexion</em>.
        </div>
      )}

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

      {isOwnerOrAdmin && siteId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          {/* Code PIN Équipe SharePoint (sans compte Google) */}
          <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <h3 className="font-display font-semibold text-sm text-slate-900">
                  Code PIN d&apos;édition équipe (SharePoint)
                </h3>
              </div>
              {syncStatus === 'synced' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Actif
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Communiquez ce code PIN aux membres de votre équipe : ils peuvent modifier
              les fiches et les zones sans compte Google. Changer ce code révoque
              immédiatement les anciens accès.
            </p>

            <form onSubmit={handleSaveTeamPin} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={teamPin}
                  onChange={(e) => setTeamPin(e.target.value)}
                  minLength={4}
                  maxLength={32}
                  placeholder="Code PIN (4 car. min)"
                  className="w-full pl-3 pr-9 py-2 text-xs font-mono-num font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label={showPin ? 'Masquer' : 'Afficher'}
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={busy || teamPin.trim().length < 4}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                Enregistrer PIN
              </button>
            </form>

            <div className="pt-1 flex flex-wrap gap-2">
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
            </div>
          </div>

          {/* Membres & Invitations Google optionnelles */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" />
                <h3 className="font-display font-semibold text-sm text-slate-900">
                  Collaborateurs &amp; invitations Google
                </h3>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleGenerateInvite('editor')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>Lien Google</span>
              </button>
            </div>

            {invites.filter((i) => i.active).length > 0 && (
              <div className="space-y-1">
                {invites
                  .filter((i) => i.active)
                  .slice(0, 3)
                  .map((inv) => (
                    <div
                      key={inv.code}
                      className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs"
                    >
                      <span className="font-mono-num font-bold text-slate-900">{inv.code}</span>
                      <button
                        type="button"
                        onClick={() => copyText(inv.code)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedCode === inv.code ? 'Copié' : 'Copier le lien'}</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {members.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Postes autorisés ({members.length})
                  </p>
                  {pendingMembersCount > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSyncMembers}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-700 text-white rounded cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Autoriser ({pendingMembersCount})</span>
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {members.map((m) => (
                    <div
                      key={m.uid}
                      className="flex items-center justify-between text-xs text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200"
                    >
                      <span className="font-medium truncate">{m.displayName}</span>
                      <span className="text-[11px] text-emerald-700 font-medium">Éditeur</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Aucun membre n&apos;a encore déverrouillé l&apos;édition sur ce site.
              </p>
            )}
          </div>
        </div>
      )}

      {isGoogleUser && !isOwnerOrAdmin && (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <h3 className="font-display font-semibold text-sm text-slate-900">
            Rejoindre avec un code d&apos;invitation Google
          </h3>
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
      )}
    </div>
  );
};
