import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  AlertTriangle,
  Cloud,
  CloudOff,
  Download,
  FileSpreadsheet,
  Flame,
  Lock,
  LockOpen,
  LogIn,
  Maximize2,
  Minimize2,
  Plus,
  Printer,
  Upload,
} from 'lucide-react';
import { CloudSyncCard } from './components/CloudSyncCard';
import { EmergencyPoster } from './components/EmergencyPoster';
import { EpiSiteModal } from './components/EpiSiteModal';
import { PersonModal } from './components/PersonModal';
import { PersonnelManager } from './components/PersonnelManager';
import { SettingsPanel } from './components/SettingsPanel';
import { TeamPinModal } from './components/TeamPinModal';
import { ZoneManager } from './components/ZoneManager';
import { createDefaultAppData } from './data/defaultData';
import { auth, googleProvider } from './firebase';
import {
  checkEditorAccessForUser,
  deletePersonInFirestore,
  deleteZoneInFirestore,
  joinSiteWithInviteCode,
  lockTeamEditorSession,
  resolveOrInitializeUserSite,
  seedEntireSiteToFirestore,
  subscribeToSiteData,
  syncSharedUidsForSite,
  unlockTeamEditorWithPin,
  updateSiteSettingsInFirestore,
  upsertPersonInFirestore,
  upsertZoneInFirestore,
} from './services/firestoreSync';
import { AppData, Person, PosterSettings, Zone } from './types';
import { compressLogoFileToDataUrl } from './utils/imageCompress';
import {
  downloadCsvTemplate,
  exportAppDataToJson,
  parseSpreadsheetFile,
  validateAndParseJsonImport,
} from './utils/importExport';
import { computePosterColumns } from './utils/posterLogic';
import { getTodayFrenchDate, isPersonEligibleForPoster } from './utils/validation';

const STORAGE_KEY = 'annuaire_urgence_a3_v1';
const PREFERRED_SITE_KEY = 'annuaire_preferred_site_id';

type ActiveTab = 'poster' | 'personnel' | 'zones' | 'settings';

function loadInitialData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultAppData();
    return validateAndParseJsonImport(raw);
  } catch {
    return createDefaultAppData();
  }
}

export default function App() {
  const [data, setData] = useState<AppData>(loadInitialData);
  const dataRef = useRef<AppData>(data);
  dataRef.current = data;

  const [activeTab, setActiveTab] = useState<ActiveTab>('poster');
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | '100'>('fit');
  const [fitScale, setFitScale] = useState(0.75);

  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [epiSiteModalOpen, setEpiSiteModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [quickZoneName, setQuickZoneName] = useState('');
  const [sidebarToast, setSidebarToast] = useState<string | null>(null);

  // État Firebase Auth & Firestore
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteOwnerUid, setSiteOwnerUid] = useState<string | null>(null);
  const [sharedUids, setSharedUids] = useState<string[]>([]);
  const [teamShared, setTeamShared] = useState(true);
  const [canEditCloud, setCanEditCloud] = useState(false);
  const [editorMemberName, setEditorMemberName] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [anonAuthDisabled, setAnonAuthDisabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'connecting' | 'synced' | 'error'>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite');
  });

  const autoAnonAttemptedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const quickLogoInputRef = useRef<HTMLInputElement>(null);
  const quickJsonInputRef = useRef<HTMLInputElement>(null);
  const quickCsvInputRef = useRef<HTMLInputElement>(null);

  // Sauvegarde automatique locale (cache hors-ligne / mode non connecté)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota errors silently
    }
  }, [data]);

  // Écoute de l'authentification Firebase et synchronisation temps réel Firestore
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      setUser(nextUser);
      setAuthReady(true);
      setSyncError(null);

      if (!nextUser) {
        setSiteId(null);
        setSiteOwnerUid(null);
        setSharedUids([]);
        setCanEditCloud(false);
        setEditorMemberName(null);
        setSyncStatus('local');

        if (!autoAnonAttemptedRef.current) {
          autoAnonAttemptedRef.current = true;
          try {
            await signInAnonymously(auth);
            return;
          } catch (anonErr) {
            const code =
              anonErr && typeof anonErr === 'object' && 'code' in anonErr
                ? String((anonErr as { code?: string }).code)
                : '';
            if (
              code.includes('operation-not-allowed') ||
              code.includes('admin-restricted-operation')
            ) {
              setAnonAuthDisabled(true);
            }
          }
        }
        return;
      }

      setAnonAuthDisabled(false);
      setSyncStatus('connecting');
      try {
        let preferredSiteId = localStorage.getItem(PREFERRED_SITE_KEY);

        if (pendingInviteCode && !nextUser.isAnonymous) {
          try {
            preferredSiteId = await joinSiteWithInviteCode(pendingInviteCode, nextUser);
            localStorage.setItem(PREFERRED_SITE_KEY, preferredSiteId);
            setPendingInviteCode(null);
            window.history.replaceState({}, '', window.location.pathname);
          } catch (inviteErr) {
            setSyncError(
              inviteErr instanceof Error
                ? inviteErr.message
                : 'Code d’invitation invalide.'
            );
          }
        }

        const resolved = await resolveOrInitializeUserSite(
          nextUser,
          dataRef.current,
          preferredSiteId
        );

        if (cancelled) return;

        if (!resolved) {
          setSiteId(null);
          setSiteOwnerUid(null);
          setSharedUids([]);
          setCanEditCloud(false);
          setEditorMemberName(null);
          setSyncStatus('local');
          return;
        }

        setSiteId(resolved.siteId);
        setSiteOwnerUid(resolved.ownerUid);
        setSharedUids(resolved.sharedUids);
        setTeamShared(resolved.teamShared);
        localStorage.setItem(PREFERRED_SITE_KEY, resolved.siteId);

        const editorStatus = await checkEditorAccessForUser(
          resolved.siteId,
          nextUser,
          resolved.ownerUid
        );
        if (cancelled) return;
        setCanEditCloud(editorStatus.canEdit);
        setEditorMemberName(editorStatus.memberName);

        unsubFirestore = subscribeToSiteData(
          resolved.siteId,
          nextUser,
          resolved.teamShared,
          (partial) => {
            if (partial.ownerUid !== undefined) setSiteOwnerUid(partial.ownerUid);
            if (partial.sharedUids !== undefined) setSharedUids(partial.sharedUids);
            if (partial.teamShared !== undefined) setTeamShared(partial.teamShared);

            setData((prev) => ({
              zones:
                partial.zones !== undefined && partial.zones.length > 0
                  ? partial.zones
                  : prev.zones,
              people: partial.people !== undefined ? partial.people : prev.people,
              activeZoneId:
                partial.activeZoneId !== undefined && partial.activeZoneId !== ''
                  ? partial.activeZoneId
                  : prev.activeZoneId,
              settings: partial.settings !== undefined ? partial.settings : prev.settings,
            }));
          }
        );

        setSyncStatus('synced');
      } catch (err) {
        if (cancelled) return;
        setSyncStatus('error');
        setSyncError(
          err instanceof Error
            ? err.message
            : 'Impossible de se connecter à la sauvegarde Firebase.'
        );
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, [pendingInviteCode]);

  // Calcul dynamique du facteur d'échelle pour ajuster l'affiche A3 (1188x840) à l'écran
  useEffect(() => {
    const updateScale = () => {
      if (!stageRef.current) return;
      const availableWidth = Math.max(200, stageRef.current.clientWidth - 56);
      const availableHeight = Math.max(window.innerHeight - 190, 360);
      const scaleW = availableWidth / 1188;
      const scaleH = availableHeight / 840;
      const next = Math.min(scaleW, scaleH, 1.05);
      setFitScale(Math.max(0.18, Number(next.toFixed(3))));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (stageRef.current) observer.observe(stageRef.current);
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [activeTab, isFullscreenPreview]);

  useEffect(() => {
    if (!sidebarToast) return;
    const timer = setTimeout(() => setSidebarToast(null), 4000);
    return () => clearTimeout(timer);
  }, [sidebarToast]);

  const zonesById = useMemo(() => {
    const map = new Map<string, Zone>();
    data.zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [data.zones]);

  const activeZone = useMemo(
    () => zonesById.get(data.activeZoneId) || data.zones[0],
    [zonesById, data.activeZoneId, data.zones]
  );

  const posterColumns = useMemo(
    () => computePosterColumns(data.people, activeZone),
    [data.people, activeZone]
  );

  const excludedPeopleCount = useMemo(
    () => data.people.filter((p) => !isPersonEligibleForPoster(p)).length,
    [data.people]
  );

  const isCloudReady = Boolean(user && siteId && siteOwnerUid && syncStatus === 'synced');

  const handlePermissionDenied = () => {
    setCanEditCloud(false);
    setSidebarToast('Code PIN requis ou expiré pour modifier en ligne.');
    setPinModalOpen(true);
  };

  const requireEditAccess = (): boolean => {
    if (isCloudReady && !canEditCloud) {
      setPinModalOpen(true);
      return false;
    }
    return true;
  };

  const withAutoDate = (prev: AppData): PosterSettings =>
    prev.settings.autoUpdateDate
      ? { ...prev.settings, lastUpdatedDate: getTodayFrenchDate() }
      : prev.settings;

  const syncSettingsToCloud = (nextSettings: PosterSettings, nextActiveZoneId: string) => {
    if (isCloudReady && canEditCloud && siteId) {
      void updateSiteSettingsInFirestore(
        siteId,
        nextSettings,
        nextActiveZoneId,
        handlePermissionDenied
      );
    }
  };

  // Actions Auth Firebase
  const handleSignIn = async () => {
    setSyncError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setSidebarToast('Connecté en Admin Google.');
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'Échec de la connexion Google.'
      );
    }
  };

  const handleSignOut = async () => {
    autoAnonAttemptedRef.current = false;
    await signOut(auth);
    setSidebarToast('Déconnecté.');
  };

  const handleUnlockWithPin = async (pin: string, displayName: string) => {
    if (!user || !siteId || !siteOwnerUid) {
      throw new Error('Connexion au serveur en cours, réessayez dans un instant.');
    }
    await unlockTeamEditorWithPin(siteId, siteOwnerUid, user, pin, displayName);
    setCanEditCloud(true);
    setEditorMemberName(displayName);
    setSidebarToast('Mode Édition déverrouillé pour cette session.');
  };

  const handleLockEditor = async () => {
    if (!user || !siteId) return;
    await lockTeamEditorSession(siteId, user);
    setCanEditCloud(false);
    setEditorMemberName(null);
    setSidebarToast('Mode Édition verrouillé (lecture seule).');
  };

  const handlePushLocalToCloud = async () => {
    if (!user || !siteId || !siteOwnerUid) return;
    await seedEntireSiteToFirestore(
      siteId,
      siteOwnerUid,
      sharedUids.length > 0 ? sharedUids : [siteOwnerUid],
      dataRef.current,
      teamShared
    );
  };

  const handleJoinWithCode = async (code: string) => {
    if (!user) return;
    const joinedSiteId = await joinSiteWithInviteCode(code, user);
    localStorage.setItem(PREFERRED_SITE_KEY, joinedSiteId);
    setPendingInviteCode(null);
    // Re-résoudre la connexion vers le site rejoint
    const resolved = await resolveOrInitializeUserSite(user, dataRef.current, joinedSiteId);
    if (resolved) {
      setSiteId(resolved.siteId);
      setSiteOwnerUid(resolved.ownerUid);
      setSharedUids(resolved.sharedUids);
      setTeamShared(resolved.teamShared);
      const editorStatus = await checkEditorAccessForUser(
        resolved.siteId,
        user,
        resolved.ownerUid
      );
      setCanEditCloud(editorStatus.canEdit);
      setEditorMemberName(editorStatus.memberName);
    }
  };

  const handleSyncMembersAccess = async (memberUids: string[]) => {
    if (!siteId || !siteOwnerUid) return;
    await syncSharedUidsForSite(siteId, siteOwnerUid, memberUids);
  };

  // Handlers Personnel
  const handleSavePerson = (
    personData: Omit<Person, 'id'>,
    existingId?: string,
    epiSiteZoneIds?: string[]
  ) => {
    if (!requireEditAccess()) return;
    const newId = existingId || `p-${crypto.randomUUID()}`;
    const savedPerson: Person = { ...personData, id: newId };
    const prevSnapshot = dataRef.current;
    const nextSettings = withAutoDate(prevSnapshot);

    const changedZones: Zone[] = [];
    const targetZoneSet = epiSiteZoneIds !== undefined ? new Set(epiSiteZoneIds) : null;

    const nextZones =
      targetZoneSet !== null
        ? prevSnapshot.zones.map((z) => {
            const currentIds = z.epiSitePersonIds || [];
            const currentlyIncluded = currentIds.includes(newId);
            const shouldInclude = savedPerson.roles.includes('EPI') && targetZoneSet.has(z.id);
            if (currentlyIncluded === shouldInclude) return z;
            const updatedZone: Zone = {
              ...z,
              epiSitePersonIds: shouldInclude
                ? Array.from(new Set([...currentIds, newId]))
                : currentIds.filter((id) => id !== newId),
            };
            changedZones.push(updatedZone);
            return updatedZone;
          })
        : prevSnapshot.zones;

    setData((prev) => {
      const nextPeople = existingId
        ? prev.people.map((p) => (p.id === existingId ? savedPerson : p))
        : [...prev.people, savedPerson];
      return {
        ...prev,
        zones: nextZones,
        people: nextPeople,
        settings: withAutoDate(prev),
      };
    });

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void upsertPersonInFirestore(
        siteId,
        savedPerson,
        siteOwnerUid,
        sharedUids,
        !existingId,
        teamShared,
        handlePermissionDenied
      );
      changedZones.forEach((z) => {
        void upsertZoneInFirestore(
          siteId,
          z,
          siteOwnerUid,
          sharedUids,
          false,
          teamShared,
          handlePermissionDenied
        );
      });
      if (prevSnapshot.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, prevSnapshot.activeZoneId);
      }
    }
  };

  const handleTogglePersonActive = (personId: string) => {
    if (!requireEditAccess()) return;
    const target = dataRef.current.people.find((p) => p.id === personId);
    if (!target) return;
    const updated: Person = { ...target, isActive: !target.isActive };
    const nextSettings = withAutoDate(dataRef.current);

    setData((prev) => ({
      ...prev,
      people: prev.people.map((p) => (p.id === personId ? updated : p)),
      settings: withAutoDate(prev),
    }));

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void upsertPersonInFirestore(
        siteId,
        updated,
        siteOwnerUid,
        sharedUids,
        false,
        teamShared,
        handlePermissionDenied
      );
      if (dataRef.current.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, dataRef.current.activeZoneId);
      }
    }
  };

  const handleDeletePerson = (personId: string) => {
    if (!requireEditAccess()) return;
    const prevSnapshot = dataRef.current;
    const nextSettings = withAutoDate(prevSnapshot);
    const changedZones: Zone[] = [];
    const nextZones = prevSnapshot.zones.map((z) => {
      const currentIds = z.epiSitePersonIds || [];
      if (!currentIds.includes(personId)) return z;
      const updated: Zone = {
        ...z,
        epiSitePersonIds: currentIds.filter((id) => id !== personId),
      };
      changedZones.push(updated);
      return updated;
    });

    setData((prev) => ({
      ...prev,
      zones: nextZones,
      people: prev.people.filter((p) => p.id !== personId),
      settings: withAutoDate(prev),
    }));

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void deletePersonInFirestore(siteId, personId, handlePermissionDenied);
      changedZones.forEach((z) => {
        void upsertZoneInFirestore(
          siteId,
          z,
          siteOwnerUid,
          sharedUids,
          false,
          teamShared,
          handlePermissionDenied
        );
      });
      if (prevSnapshot.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, prevSnapshot.activeZoneId);
      }
    }
  };

  // Handlers Zones
  const handleSelectActiveZone = (zoneId: string) => {
    setData((prev) => ({ ...prev, activeZoneId: zoneId }));
    syncSettingsToCloud(dataRef.current.settings, zoneId);
  };

  const handleCreateZone = (name: string) => {
    const clean = name.trim().toUpperCase();
    if (!clean) return;
    const existing = data.zones.find((z) => z.name.toUpperCase() === clean);
    if (existing) {
      handleSelectActiveZone(existing.id);
      setSidebarToast(`Zone "${clean}" sélectionnée.`);
      return;
    }
    if (!requireEditAccess()) return;
    const newId = `zone-${crypto.randomUUID()}`;
    const newZone: Zone = { id: newId, name: clean, nearbyZoneIds: [] };
    const nextSettings = withAutoDate(dataRef.current);

    setData((prev) => ({
      ...prev,
      zones: [...prev.zones, newZone],
      activeZoneId: newId,
      settings: withAutoDate(prev),
    }));
    setSidebarToast(`Zone "${clean}" créée.`);

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void upsertZoneInFirestore(
        siteId,
        newZone,
        siteOwnerUid,
        sharedUids,
        true,
        teamShared,
        handlePermissionDenied
      );
      syncSettingsToCloud(nextSettings, newId);
    }
  };

  const handleCreateMultipleZones = (names: string[]): number => {
    if (!requireEditAccess()) return 0;
    const existingNames = new Set(data.zones.map((z) => z.name.trim().toUpperCase()));
    const toAdd: Zone[] = [];
    names.forEach((raw) => {
      const clean = raw.trim().toUpperCase();
      if (clean && !existingNames.has(clean)) {
        existingNames.add(clean);
        toAdd.push({
          id: `zone-${crypto.randomUUID()}`,
          name: clean,
          nearbyZoneIds: [],
        });
      }
    });
    if (toAdd.length === 0) return 0;

    const nextSettings = withAutoDate(dataRef.current);
    setData((prev) => ({
      ...prev,
      zones: [...prev.zones, ...toAdd],
      settings: withAutoDate(prev),
    }));
    setSidebarToast(`${toAdd.length} zone(s) créée(s).`);

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      toAdd.forEach((z) => {
        void upsertZoneInFirestore(
          siteId,
          z,
          siteOwnerUid,
          sharedUids,
          true,
          teamShared,
          handlePermissionDenied
        );
      });
      if (dataRef.current.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, dataRef.current.activeZoneId);
      }
    }
    return toAdd.length;
  };

  const handleRenameZone = (zoneId: string, newName: string) => {
    if (!requireEditAccess()) return;
    const clean = newName.trim().toUpperCase();
    const target = dataRef.current.zones.find((z) => z.id === zoneId);
    if (!target || !clean) return;
    const updated: Zone = { ...target, name: clean };
    const nextSettings = withAutoDate(dataRef.current);

    setData((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === zoneId ? updated : z)),
      settings: withAutoDate(prev),
    }));

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void upsertZoneInFirestore(
        siteId,
        updated,
        siteOwnerUid,
        sharedUids,
        false,
        teamShared,
        handlePermissionDenied
      );
      if (dataRef.current.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, dataRef.current.activeZoneId);
      }
    }
  };

  const handleDeleteZone = (zoneId: string) => {
    if (dataRef.current.zones.length <= 1) return;
    if (!requireEditAccess()) return;
    const prevSnapshot = dataRef.current;
    const remaining = prevSnapshot.zones
      .filter((z) => z.id !== zoneId)
      .map((z) => ({
        ...z,
        nearbyZoneIds: z.nearbyZoneIds.filter((id) => id !== zoneId),
      }));
    const fallbackId = remaining[0].id;
    const nextPeople = prevSnapshot.people.map((p) => ({
      ...p,
      primaryZoneId: p.primaryZoneId === zoneId ? fallbackId : p.primaryZoneId,
      coveredZoneIds: (p.coveredZoneIds || []).filter((id) => id !== zoneId),
      nearbyZoneIds: (p.nearbyZoneIds || []).filter((id) => id !== zoneId),
    }));
    const nextActiveZone =
      prevSnapshot.activeZoneId === zoneId ? fallbackId : prevSnapshot.activeZoneId;
    const nextSettings = withAutoDate(prevSnapshot);

    setData({
      zones: remaining,
      people: nextPeople,
      activeZoneId: nextActiveZone,
      settings: nextSettings,
    });

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void deleteZoneInFirestore(siteId, zoneId, handlePermissionDenied);
      remaining.forEach((z) => {
        const orig = prevSnapshot.zones.find((oz) => oz.id === z.id);
        if (orig && orig.nearbyZoneIds.length !== z.nearbyZoneIds.length) {
          void upsertZoneInFirestore(
            siteId,
            z,
            siteOwnerUid,
            sharedUids,
            false,
            teamShared,
            handlePermissionDenied
          );
        }
      });
      nextPeople.forEach((p) => {
        const origP = prevSnapshot.people.find((op) => op.id === p.id);
        if (
          origP &&
          (origP.primaryZoneId !== p.primaryZoneId ||
            (origP.coveredZoneIds || []).length !== p.coveredZoneIds.length ||
            origP.nearbyZoneIds.length !== p.nearbyZoneIds.length)
        ) {
          void upsertPersonInFirestore(
            siteId,
            p,
            siteOwnerUid,
            sharedUids,
            false,
            teamShared,
            handlePermissionDenied
          );
        }
      });
      syncSettingsToCloud(nextSettings, nextActiveZone);
    }
  };

  const handleToggleZoneProximity = (
    zoneId: string,
    nearbyZoneId: string,
    bidirectional: boolean
  ) => {
    if (!requireEditAccess()) return;
    const prevSnapshot = dataRef.current;
    const targetZone = prevSnapshot.zones.find((z) => z.id === zoneId);
    if (!targetZone) return;
    const currentlyNearby = targetZone.nearbyZoneIds.includes(nearbyZoneId);

    const changedZones: Zone[] = [];
    const nextZones = prevSnapshot.zones.map((z) => {
      if (z.id === zoneId) {
        const updated = {
          ...z,
          nearbyZoneIds: currentlyNearby
            ? z.nearbyZoneIds.filter((id) => id !== nearbyZoneId)
            : Array.from(new Set([...z.nearbyZoneIds, nearbyZoneId])),
        };
        changedZones.push(updated);
        return updated;
      }
      if (bidirectional && z.id === nearbyZoneId) {
        const updated = {
          ...z,
          nearbyZoneIds: currentlyNearby
            ? z.nearbyZoneIds.filter((id) => id !== zoneId)
            : Array.from(new Set([...z.nearbyZoneIds, zoneId])),
        };
        changedZones.push(updated);
        return updated;
      }
      return z;
    });

    const nextSettings = withAutoDate(prevSnapshot);
    setData((prev) => ({
      ...prev,
      zones: nextZones,
      settings: withAutoDate(prev),
    }));

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      changedZones.forEach((z) => {
        void upsertZoneInFirestore(
          siteId,
          z,
          siteOwnerUid,
          sharedUids,
          false,
          teamShared,
          handlePermissionDenied
        );
      });
      if (prevSnapshot.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, prevSnapshot.activeZoneId);
      }
    }
  };

  const handleToggleEpiSitePerson = (zoneId: string, personId: string) => {
    if (!requireEditAccess()) return;
    const prevSnapshot = dataRef.current;
    const targetZone = prevSnapshot.zones.find((z) => z.id === zoneId);
    if (!targetZone) return;

    const currentIds = targetZone.epiSitePersonIds || [];
    const exists = currentIds.includes(personId);
    const updatedZone: Zone = {
      ...targetZone,
      epiSitePersonIds: exists
        ? currentIds.filter((id) => id !== personId)
        : Array.from(new Set([...currentIds, personId])),
    };
    const nextSettings = withAutoDate(prevSnapshot);

    setData((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === zoneId ? updatedZone : z)),
      settings: withAutoDate(prev),
    }));

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void upsertZoneInFirestore(
        siteId,
        updatedZone,
        siteOwnerUid,
        sharedUids,
        false,
        teamShared,
        handlePermissionDenied
      );
      if (prevSnapshot.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, prevSnapshot.activeZoneId);
      }
    }
  };

  const handleClearZoneEpiSite = (zoneId: string) => {
    if (!requireEditAccess()) return;
    const prevSnapshot = dataRef.current;
    const targetZone = prevSnapshot.zones.find((z) => z.id === zoneId);
    if (!targetZone || (targetZone.epiSitePersonIds || []).length === 0) return;

    const updatedZone: Zone = { ...targetZone, epiSitePersonIds: [] };
    const nextSettings = withAutoDate(prevSnapshot);

    setData((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === zoneId ? updatedZone : z)),
      settings: withAutoDate(prev),
    }));

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void upsertZoneInFirestore(
        siteId,
        updatedZone,
        siteOwnerUid,
        sharedUids,
        false,
        teamShared,
        handlePermissionDenied
      );
      if (prevSnapshot.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, prevSnapshot.activeZoneId);
      }
    }
  };

  // Handlers Settings & Import/Export
  const handleUpdateSettings = (partial: Partial<PosterSettings>) => {
    if (!requireEditAccess()) return;
    const nextSettings = { ...dataRef.current.settings, ...partial };
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }));
    syncSettingsToCloud(nextSettings, dataRef.current.activeZoneId);
  };

  const handleImportJsonFile = async (file: File) => {
    if (!requireEditAccess()) return;
    const text = await file.text();
    const parsed = validateAndParseJsonImport(text);
    setData(parsed);
    setSidebarToast('Sauvegarde JSON importée.');
    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      await seedEntireSiteToFirestore(siteId, siteOwnerUid, sharedUids, parsed, teamShared);
    }
  };

  const handleImportSpreadsheetFile = async (file: File) => {
    if (!requireEditAccess()) {
      return { added: 0, zonesCreated: 0, skipped: 0, warnings: ['Déverrouillez l’édition avec le code PIN.'] };
    }
    const res = await parseSpreadsheetFile(file, data.zones);
    const nextSettings = withAutoDate(dataRef.current);
    setData((prev) => ({
      ...prev,
      zones: [...prev.zones, ...res.createdZones],
      people: [...prev.people, ...res.newPeople],
      settings: withAutoDate(prev),
    }));
    setSidebarToast(`${res.newPeople.length} fiche(s) importée(s).`);

    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      res.createdZones.forEach((z) => {
        void upsertZoneInFirestore(
          siteId,
          z,
          siteOwnerUid,
          sharedUids,
          true,
          teamShared,
          handlePermissionDenied
        );
      });
      res.newPeople.forEach((p) => {
        void upsertPersonInFirestore(
          siteId,
          p,
          siteOwnerUid,
          sharedUids,
          true,
          teamShared,
          handlePermissionDenied
        );
      });
      if (dataRef.current.settings.autoUpdateDate) {
        syncSettingsToCloud(nextSettings, dataRef.current.activeZoneId);
      }
    }

    return {
      added: res.newPeople.length,
      zonesCreated: res.createdZones.length,
      skipped: res.skippedRows,
      warnings: res.warnings,
    };
  };

  const handleResetDemoData = () => {
    if (!requireEditAccess()) return;
    const fresh = createDefaultAppData();
    setData(fresh);
    if (isCloudReady && canEditCloud && siteId && siteOwnerUid) {
      void seedEntireSiteToFirestore(siteId, siteOwnerUid, sharedUids, fresh, teamShared);
    }
  };

  const handleQuickLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressLogoFileToDataUrl(file);
      handleUpdateSettings({ companyLogoDataUrl: compressed });
      setSidebarToast('Logo entreprise mis à jour.');
    } catch {
      setSidebarToast('Erreur lors du chargement du logo.');
    }
    e.target.value = '';
  };

  const handlePrint = () => {
    if (activeTab !== 'poster') {
      setActiveTab('poster');
      setTimeout(() => window.print(), 120);
    } else {
      window.print();
    }
  };

  const effectiveScale = zoomMode === '100' ? 1 : fitScale;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Barre supérieure (Contrat 3 zones, masquée à l'impression) */}
      <header className="no-print bg-white border-b border-slate-200 px-4 lg:px-6 min-h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-3 lg:gap-6 sticky top-0 z-30">
        {/* Zone 1 : Marque */}
        <span className="font-display font-extrabold text-base lg:text-lg tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Annuaire d&apos;Urgence A3
        </span>

        {/* Zone 2 : Navigation principale */}
        <nav className="flex items-center gap-3 lg:gap-5 flex-wrap">
          {(
            [
              { id: 'poster', label: 'Aperçu A3' },
              { id: 'personnel', label: 'Personnel' },
              { id: 'zones', label: 'Zones & Proximité' },
              { id: 'settings', label: 'Paramètres & Logo' },
            ] as { id: ActiveTab; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                if (item.id !== 'poster') setIsFullscreenPreview(false);
              }}
              className={`py-5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? 'border-[#D91E18] text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3 : Action principale */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#D91E18] hover:bg-[#B91C1C] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer / Aperçu A3</span>
          </button>
        </div>
      </header>

      {/* Corps applicatif */}
      <div className="flex-1 flex min-h-0">
        {/* Barre latérale d'administration (masquée à l'impression et en aperçu plein écran) */}
        {!isFullscreenPreview && (
          <aside className="no-print hidden lg:flex w-72 shrink-0 bg-white border-r border-slate-200 flex-col justify-between p-5 gap-6">
            <div className="space-y-6">
              {/* Sélecteur rapide de zone + création directe */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Zones ({data.zones.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('zones')}
                    className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
                  >
                    Proximité &amp; lot
                  </button>
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                  {data.zones.map((z) => {
                    const isCurrent = z.id === activeZone?.id;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => {
                          handleSelectActiveZone(z.id);
                          setActiveTab('poster');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide transition-colors cursor-pointer truncate ${
                          isCurrent
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {z.name}
                      </button>
                    );
                  })}
                </div>

                {/* Ajout rapide d'une zone directement dans la barre latérale */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!quickZoneName.trim()) return;
                    handleCreateZone(quickZoneName);
                    setQuickZoneName('');
                    setActiveTab('poster');
                  }}
                  className="mt-2.5 flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={quickZoneName}
                    onChange={(e) => setQuickZoneName(e.target.value.toUpperCase())}
                    placeholder="+ Nouvelle zone..."
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs uppercase font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  />
                  <button
                    type="submit"
                    disabled={!quickZoneName.trim()}
                    title="Créer cette zone"
                    className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Synthèse couverture de la zone active */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Effectifs sur l&apos;affiche
                </h2>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span>S.S.T (Zone / Proche / Site)</span>
                    <span className="font-mono-num font-bold text-[#006B39]">
                      {posterColumns.sstZone.length} / {posterColumns.sstNearby.length} /{' '}
                      {posterColumns.sstSite.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>E.P.I (Zone / Proche / Site)</span>
                    <span className="font-mono-num font-bold text-[#B91C1C]">
                      {posterColumns.epiZone.length} / {posterColumns.epiNearby.length} /{' '}
                      {posterColumns.epiSite.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span>Serre-file / Guide</span>
                    <span className="font-mono-num font-bold text-[#006B39]">
                      {posterColumns.evacSerreFile.length} / {posterColumns.evacGuide.length}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!requireEditAccess()) return;
                    setEpiSiteModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-red-700 hover:underline cursor-pointer"
                >
                  Choisir des E.P.I « Site » pour cette zone →
                </button>

                {excludedPeopleCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('personnel')}
                    className="w-full mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-left text-xs text-amber-900 hover:bg-amber-100/70 transition-colors flex items-start gap-2 cursor-pointer"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-mono-num">{excludedPeopleCount}</strong> fiche
                      {excludedPeopleCount > 1 ? 's' : ''} masquée
                      {excludedPeopleCount > 1 ? 's' : ''} (formation expirée ou désactivée).
                    </span>
                  </button>
                )}
              </div>

              {/* Actions rapides */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Actions rapides
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!requireEditAccess()) return;
                    setEditingPerson(null);
                    setPersonModalOpen(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter une personne</span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => exportAppDataToJson(data)}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    title="Exporter JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => quickJsonInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    title="Importer JSON"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Importer</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => quickCsvInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100/70 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Importer CSV / Excel</span>
                </button>
              </div>
            </div>

            {/* Sauvegarde Firebase & Statut */}
            <div className="border-t border-slate-100 pt-3 space-y-2.5">
              {user && !user.isAnonymous ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="w-full p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-left hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                    <Cloud className="w-4 h-4 shrink-0" />
                    <span>
                      {syncStatus === 'synced'
                        ? 'Admin Cloud synchronisé'
                        : syncStatus === 'connecting'
                        ? 'Connexion Firebase...'
                        : 'Erreur sync Firebase'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700/80 truncate mt-0.5">
                    {user.email}
                  </p>
                </button>
              ) : user?.isAnonymous && syncStatus === 'synced' ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      canEditCloud ? setActiveTab('settings') : setPinModalOpen(true)
                    }
                    className={`w-full p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      canEditCloud
                        ? 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 text-xs font-semibold ${
                        canEditCloud ? 'text-emerald-800' : 'text-slate-800'
                      }`}
                    >
                      {canEditCloud ? (
                        <LockOpen className="w-4 h-4 shrink-0 text-emerald-700" />
                      ) : (
                        <Lock className="w-4 h-4 shrink-0 text-slate-500" />
                      )}
                      <span>
                        {canEditCloud
                          ? 'Édition équipe active'
                          : 'Lecture seule · Déverrouiller'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {canEditCloud
                        ? editorMemberName || 'Code PIN validé'
                        : 'Cliquez pour saisir le code PIN'}
                    </p>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={!authReady}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Connexion Admin Google</span>
                </button>
              )}

              <div className="text-[11px] text-slate-400 leading-relaxed flex items-center gap-1.5">
                {syncStatus !== 'synced' && <CloudOff className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {syncStatus === 'synced'
                    ? 'Base temps réel · A3 paysage.'
                    : 'Mode local uniquement · A3 paysage.'}
                </span>
              </div>
              {sidebarToast && (
                <p className="text-emerald-700 text-[11px] font-semibold">{sidebarToast}</p>
              )}
            </div>
          </aside>
        )}

        {/* Contenu principal */}
        <main className="flex-1 min-w-0 flex flex-col">
          {activeTab === 'poster' && (
            <div className="flex-1 flex flex-col">
              {/* Barre d'outils de l'aperçu (masquée à l'impression) */}
              <div className="no-print bg-white/80 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs font-semibold text-slate-600 lg:hidden">
                    Zone :
                  </label>
                  <select
                    value={activeZone?.id || ''}
                    onChange={(e) => handleSelectActiveZone(e.target.value)}
                    className="lg:hidden px-3 py-1.5 text-xs font-bold uppercase border border-slate-300 rounded-lg bg-white"
                    aria-label="Sélectionner la zone"
                  >
                    {data.zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>

                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <span className="font-display font-bold text-slate-900 uppercase">
                      {activeZone?.name}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Format A3 Paysage</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      {posterColumns.eligibleCount} actif{posterColumns.eligibleCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (!requireEditAccess()) return;
                      setEpiSiteModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#B91C1C] bg-red-50 border border-red-200 rounded-lg hover:bg-red-100/70 transition-colors cursor-pointer"
                    title="Choisir des E.P.I du site à afficher sous Proche de la zone"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>E.P.I « SITE » ({posterColumns.epiSite.length})</span>
                  </button>

                  {isCloudReady && user?.isAnonymous && (
                    canEditCloud ? (
                      <button
                        type="button"
                        onClick={handleLockEditor}
                        title="Verrouiller le mode édition"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100/70 transition-colors cursor-pointer"
                      >
                        <LockOpen className="w-3.5 h-3.5" />
                        <span>Édition active</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPinModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-[#D91E18]" />
                        <span>Modifier (Code PIN)</span>
                      </button>
                    )
                  )}

                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setZoomMode('fit')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        zoomMode === 'fit'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ajuster
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomMode('100')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        zoomMode === '100'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      100%
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFullscreenPreview((v) => !v)}
                    className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {isFullscreenPreview ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Afficher panneau</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Aperçu plein écran</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!requireEditAccess()) return;
                      setEditingPerson(null);
                      setPersonModalOpen(true);
                    }}
                    className="lg:hidden inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>
              </div>

              {/* Scène de prévisualisation et d'impression de l'affiche A3 */}
              <div
                ref={stageRef}
                className={`print-stage flex-1 bg-slate-200/75 p-4 md:p-6 flex items-start justify-center ${
                  zoomMode === 'fit' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'
                }`}
              >
                <div
                  style={
                    zoomMode === 'fit'
                      ? {
                          width: `${1188 * effectiveScale}px`,
                          height: `${840 * effectiveScale}px`,
                        }
                      : undefined
                  }
                  className="print:!w-full print:!h-auto shrink-0"
                >
                  <div
                    style={
                      zoomMode === 'fit'
                        ? {
                            transform: `scale(${effectiveScale})`,
                            transformOrigin: 'top left',
                          }
                        : undefined
                    }
                    className="print:!transform-none"
                  >
                    <EmergencyPoster
                      activeZone={activeZone}
                      columns={posterColumns}
                      zonesById={zonesById}
                      settings={data.settings}
                      onRequestLogoUpload={() => {
                        if (!requireEditAccess()) return;
                        quickLogoInputRef.current?.click();
                      }}
                      onManageEpiSite={() => {
                        if (!requireEditAccess()) return;
                        setEpiSiteModalOpen(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'personnel' && (
            <div className="no-print p-5 md:p-6 max-w-6xl w-full mx-auto">
              <PersonnelManager
                people={data.people}
                zones={data.zones}
                zonesById={zonesById}
                onAddPerson={() => {
                  if (!requireEditAccess()) return;
                  setEditingPerson(null);
                  setPersonModalOpen(true);
                }}
                onEditPerson={(person) => {
                  if (!requireEditAccess()) return;
                  setEditingPerson(person);
                  setPersonModalOpen(true);
                }}
                onToggleActive={handleTogglePersonActive}
                onDeletePerson={handleDeletePerson}
              />
            </div>
          )}

          {activeTab === 'zones' && (
            <div className="no-print p-5 md:p-6 max-w-6xl w-full mx-auto">
              <ZoneManager
                zones={data.zones}
                people={data.people}
                activeZoneId={activeZone?.id || ''}
                onSelectActiveZone={(zoneId) => {
                  handleSelectActiveZone(zoneId);
                  setActiveTab('poster');
                }}
                onCreateZone={handleCreateZone}
                onCreateMultipleZones={handleCreateMultipleZones}
                onRenameZone={handleRenameZone}
                onDeleteZone={handleDeleteZone}
                onToggleZoneProximity={handleToggleZoneProximity}
                onToggleEpiSitePerson={handleToggleEpiSitePerson}
                onClearZoneEpiSite={handleClearZoneEpiSite}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="no-print p-5 md:p-6 max-w-6xl w-full mx-auto">
              <SettingsPanel
                settings={data.settings}
                onUpdateSettings={handleUpdateSettings}
                onExportJson={() => exportAppDataToJson(data)}
                onImportJson={handleImportJsonFile}
                onImportSpreadsheet={handleImportSpreadsheetFile}
                onDownloadCsvTemplate={downloadCsvTemplate}
                onResetDemoData={handleResetDemoData}
                cloudSyncSlot={
                  <CloudSyncCard
                    user={user}
                    authReady={authReady}
                    siteId={siteId}
                    siteOwnerUid={siteOwnerUid}
                    sharedUids={sharedUids}
                    canEditCloud={canEditCloud}
                    editorMemberName={editorMemberName}
                    anonAuthDisabled={anonAuthDisabled}
                    syncStatus={syncStatus}
                    syncError={syncError}
                    onSignIn={handleSignIn}
                    onSignOut={handleSignOut}
                    onOpenPinModal={() => setPinModalOpen(true)}
                    onLockEditor={handleLockEditor}
                    onPushLocalToCloud={handlePushLocalToCloud}
                    onJoinWithCode={handleJoinWithCode}
                    onSyncMembersAccess={handleSyncMembersAccess}
                  />
                }
              />
            </div>
          )}
        </main>
      </div>

      {/* Inputs cachés pour accès rapide depuis la barre latérale ou l'affiche */}
      <input
        ref={quickLogoInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickLogoUpload}
        className="hidden"
      />
      <input
        ref={quickJsonInputRef}
        type="file"
        accept=".json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            try {
              await handleImportJsonFile(f);
            } catch (err) {
              setSidebarToast(err instanceof Error ? err.message : 'Erreur JSON');
            }
          }
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={quickCsvInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            try {
              await handleImportSpreadsheetFile(f);
            } catch (err) {
              setSidebarToast(err instanceof Error ? err.message : 'Erreur import');
            }
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Modale d'ajout / édition de personnel */}
      <PersonModal
        isOpen={personModalOpen}
        personToEdit={editingPerson}
        zones={data.zones}
        defaultZoneId={activeZone?.id || data.zones[0]?.id || ''}
        onClose={() => {
          setPersonModalOpen(false);
          setEditingPerson(null);
        }}
        onSave={handleSavePerson}
      />

      {/* Modale de sélection rapide des E.P.I « SITE » pour la zone active */}
      <EpiSiteModal
        isOpen={epiSiteModalOpen}
        zone={activeZone}
        people={data.people}
        zonesById={zonesById}
        onTogglePerson={handleToggleEpiSitePerson}
        onClearAll={handleClearZoneEpiSite}
        onClose={() => setEpiSiteModalOpen(false)}
      />

      {/* Modale de déverrouillage Équipe SharePoint (Code PIN) */}
      <TeamPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onUnlock={handleUnlockWithPin}
      />
    </div>
  );
}
