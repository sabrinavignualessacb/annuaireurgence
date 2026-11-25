import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AppData,
  EmergencyBoxShape,
  EmergencyRole,
  Person,
  PosterSettings,
  Zone,
} from '../types';
import { getTodayFrenchDate, normalizeInternalNumber } from '../utils/validation';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'service.qse.33450@gmail.com';
export const DEFAULT_ADMIN_SITE_ID = 'site-principal';
export const DEFAULT_TEAM_PIN = '2025';

export interface SiteMemberRecord {
  uid: string;
  siteOwnerUid: string;
  displayName: string;
  role: 'editor' | 'viewer';
  inviteCode: string;
}

export interface SiteInviteRecord {
  code: string;
  siteId: string;
  role: 'editor' | 'viewer';
  active: boolean;
}

export interface ResolvedSiteInfo {
  siteId: string;
  ownerUid: string;
  sharedUids: string[];
  teamShared: boolean;
}

export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  return (
    Boolean(user.emailVerified) &&
    user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  );
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return cleaned || `id-${crypto.randomUUID()}`;
}

function buildSitePayload(
  siteName: string,
  ownerUid: string,
  sharedUids: string[],
  data: AppData,
  isCreate: boolean,
  teamShared = true
) {
  const logo = (data.settings.companyLogoDataUrl || '').slice(0, 399000);
  const validShape: EmergencyBoxShape = ['pills', 'stacked', 'rounded', 'chamfer'].includes(
    data.settings.emergencyBoxShape
  )
    ? data.settings.emergencyBoxShape
    : 'pills';

  const base = {
    name: siteName.slice(0, 120) || 'Site Principal',
    sharedUids: Array.from(new Set(sharedUids)).slice(0, 10),
    companyName: (data.settings.companyName || '').slice(0, 120),
    companyLogoDataUrl: logo,
    companyLogoSizePx: Math.min(96, Math.max(24, Number(data.settings.companyLogoSizePx || 54))),
    sstLogoDataUrl: (data.settings.sstLogoDataUrl || '').slice(0, 99000),
    epiLogoDataUrl: (data.settings.epiLogoDataUrl || '').slice(0, 99000),
    evacuationLogoDataUrl: (data.settings.evacuationLogoDataUrl || '').slice(0, 99000),
    serreFileLogoDataUrl: (data.settings.serreFileLogoDataUrl || '').slice(0, 99000),
    guideLogoDataUrl: (data.settings.guideLogoDataUrl || '').slice(0, 99000),
    pictogramSizePx: Math.min(68, Math.max(28, Number(data.settings.pictogramSizePx || 44))),
    roleBadgeSizePx: Math.min(48, Math.max(18, Number(data.settings.roleBadgeSizePx || 24))),
    lastUpdatedDate: (data.settings.lastUpdatedDate || getTodayFrenchDate()).slice(0, 20),
    autoUpdateDate: Boolean(data.settings.autoUpdateDate),
    headerHeightPx: Math.min(140, Math.max(48, Number(data.settings.headerHeightPx || 68))),
    zoneScale: Math.min(1.6, Math.max(0.95, Number(data.settings.zoneScale || 1.15))),
    emergencyBoxShape: validShape,
    activeZoneId: (data.activeZoneId || '').slice(0, 128),
    updatedAt: serverTimestamp(),
  };

  if (isCreate) {
    return {
      ...base,
      ownerUid,
      teamShared,
      createdAt: serverTimestamp(),
    };
  }
  return base;
}

function buildZonePayload(
  zone: Zone,
  ownerUid: string,
  sharedUids: string[],
  isCreate: boolean,
  teamShared = true
) {
  const base = {
    name: (zone.name || 'ZONE').trim().toUpperCase().slice(0, 120),
    nearbyZoneIds: (zone.nearbyZoneIds || []).slice(0, 50).map((id) => String(id).slice(0, 128)),
    epiSitePersonIds: (zone.epiSitePersonIds || [])
      .slice(0, 50)
      .map((id) => String(id).slice(0, 128)),
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    return {
      ...base,
      ownerUid,
      sharedUids: Array.from(new Set(sharedUids)).slice(0, 10),
      teamShared,
      createdAt: serverTimestamp(),
    };
  }
  return base;
}

function buildPersonPayload(
  person: Person,
  ownerUid: string,
  sharedUids: string[],
  isCreate: boolean,
  teamShared = true
) {
  const validRoles = (person.roles || []).filter((r): r is EmergencyRole =>
    ['SST', 'EPI', 'GUIDE', 'SERRE_FILE'].includes(r)
  );
  const rolesToSave: EmergencyRole[] = validRoles.length > 0 ? validRoles.slice(0, 4) : ['SST'];
  const normNum = normalizeInternalNumber(person.internalNumber || '0000');
  const validNum = /^\d{4}(\/\d{4})?$/.test(normNum) ? normNum : '0000';
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(person.trainingExpiryDate || '')
    ? person.trainingExpiryDate
    : '';

  const base = {
    lastName: (person.lastName || 'INCONNU').trim().toUpperCase().slice(0, 80),
    firstName: (person.firstName || '—').trim().slice(0, 80),
    internalNumber: validNum,
    roles: rolesToSave,
    primaryZoneId: (String(person.primaryZoneId || '').trim() || 'zone-default').slice(0, 128),
    coveredZoneIds: (person.coveredZoneIds || []).slice(0, 50).map((id) => String(id).slice(0, 128)),
    nearbyZoneIds: (person.nearbyZoneIds || []).slice(0, 50).map((id) => String(id).slice(0, 128)),
    trainingExpiryDate: expiry,
    isActive: Boolean(person.isActive),
    updatedAt: serverTimestamp(),
  };

  if (isCreate) {
    return {
      ...base,
      ownerUid,
      sharedUids: Array.from(new Set(sharedUids)).slice(0, 10),
      teamShared,
      createdAt: serverTimestamp(),
    };
  }
  return base;
}

/**
 * Pour l'administrateur ou propriétaire : garantit que `teamShared: true` est appliqué
 * sur le site et ses sous-collections et initialise le code PIN d'équipe si absent.
 */
export async function ensureTeamSharedAndDefaultPin(siteId: string): Promise<void> {
  try {
    const siteRef = doc(db, 'sites', siteId);
    const siteSnap = await getDoc(siteRef);
    if (!siteSnap.exists()) return;

    const zonesSnap = await getDocs(collection(db, 'sites', siteId, 'zones'));
    const peopleSnap = await getDocs(collection(db, 'sites', siteId, 'people'));

    const batch = writeBatch(db);
    let hasChanges = false;

    if (siteSnap.data().teamShared !== true) {
      batch.update(siteRef, { teamShared: true, updatedAt: serverTimestamp() });
      hasChanges = true;
    }
    zonesSnap.forEach((z) => {
      if (z.data().teamShared !== true) {
        batch.update(z.ref, { teamShared: true, updatedAt: serverTimestamp() });
        hasChanges = true;
      }
    });
    peopleSnap.forEach((p) => {
      if (p.data().teamShared !== true) {
        batch.update(p.ref, { teamShared: true, updatedAt: serverTimestamp() });
        hasChanges = true;
      }
    });

    if (hasChanges) {
      await batch.commit();
    }

    const pinRef = doc(db, 'sites', siteId, 'private', 'teamPin');
    const pinSnap = await getDoc(pinRef);
    if (!pinSnap.exists()) {
      await setDoc(pinRef, {
        pin: DEFAULT_TEAM_PIN,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-blocking setup helper
  }
}

/**
 * Résout l'identifiant du site Firestore pour l'utilisateur connecté
 * (Admin Google, collègue avec code, ou visiteur SharePoint en session anonyme).
 */
export async function resolveOrInitializeUserSite(
  user: User,
  localFallbackData: AppData,
  preferredSiteId?: string | null
): Promise<ResolvedSiteInfo | null> {
  const isAdmin = isAdminUser(user);

  // 1. Si un site préféré est fourni et accessible
  if (preferredSiteId && /^[a-zA-Z0-9_-]+$/.test(preferredSiteId)) {
    const siteRef = doc(db, 'sites', preferredSiteId);
    try {
      const snap = await getDoc(siteRef);
      if (snap.exists()) {
        const d = snap.data();
        const shared = Array.isArray(d.sharedUids) ? d.sharedUids.map(String) : [];
        const isTeamShared = d.teamShared === true;
        if (isAdmin || d.ownerUid === user.uid || shared.includes(user.uid) || isTeamShared) {
          if (isAdmin || d.ownerUid === user.uid) {
            await ensureTeamSharedAndDefaultPin(snap.id);
          }
          return {
            siteId: snap.id,
            ownerUid: String(d.ownerUid),
            sharedUids: shared,
            teamShared: isTeamShared || isAdmin || d.ownerUid === user.uid,
          };
        }
      }
    } catch {
      // Fall through to discovery
    }
  }

  // 2. Vérifier 'site-principal' (accessible à l'admin et à toute l'équipe si teamShared == true)
  const principalRef = doc(db, 'sites', DEFAULT_ADMIN_SITE_ID);
  try {
    const snap = await getDoc(principalRef);
    if (snap.exists()) {
      const d = snap.data();
      const shared = Array.isArray(d.sharedUids) ? d.sharedUids.map(String) : [];
      const isTeamShared = d.teamShared === true;
      if (isAdmin || d.ownerUid === user.uid || shared.includes(user.uid) || isTeamShared) {
        if (isAdmin || d.ownerUid === user.uid) {
          await ensureTeamSharedAndDefaultPin(snap.id);
        }
        return {
          siteId: snap.id,
          ownerUid: String(d.ownerUid),
          sharedUids: shared,
          teamShared: isTeamShared || isAdmin || d.ownerUid === user.uid,
        };
      }
    }
  } catch (error) {
    if (isAdmin) {
      handleFirestoreError(error, OperationType.GET, `sites/${DEFAULT_ADMIN_SITE_ID}`);
    }
  }

  // 3. Pour les comptes Google vérifiés : rechercher un site où l'utilisateur est dans sharedUids
  if (!user.isAnonymous) {
    try {
      const q = query(
        collection(db, 'sites'),
        where('sharedUids', 'array-contains', user.uid)
      );
      const listSnap = await getDocs(q);
      if (!listSnap.empty) {
        const first = listSnap.docs[0];
        const d = first.data();
        const isTeamShared = d.teamShared === true;
        if (d.ownerUid === user.uid) {
          await ensureTeamSharedAndDefaultPin(first.id);
        }
        return {
          siteId: first.id,
          ownerUid: String(d.ownerUid),
          sharedUids: Array.isArray(d.sharedUids) ? d.sharedUids.map(String) : [user.uid],
          teamShared: isTeamShared || d.ownerUid === user.uid,
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sites');
    }
  }

  // 4. Si visiteur anonyme (SharePoint) et que le site principal n'est pas encore initialisé
  if (user.isAnonymous) {
    return null;
  }

  // 5. Aucun site trouvé pour un compte Google vérifié : initialiser le site avec les données locales
  const newSiteId = isAdmin
    ? DEFAULT_ADMIN_SITE_ID
    : sanitizeId(`site-${user.uid.slice(0, 16)}`);
  const sharedUids = [user.uid];

  await seedEntireSiteToFirestore(newSiteId, user.uid, sharedUids, localFallbackData, true);
  await ensureTeamSharedAndDefaultPin(newSiteId);

  return {
    siteId: newSiteId,
    ownerUid: user.uid,
    sharedUids,
    teamShared: true,
  };
}

export async function seedEntireSiteToFirestore(
  siteId: string,
  ownerUid: string,
  sharedUids: string[],
  data: AppData,
  teamShared = true
): Promise<void> {
  const siteRef = doc(db, 'sites', siteId);
  try {
    const existingSite = await getDoc(siteRef);
    if (existingSite.exists()) {
      await updateDoc(
        siteRef,
        buildSitePayload(
          data.settings.companyName || 'Site Principal',
          ownerUid,
          sharedUids,
          data,
          false,
          teamShared
        )
      );
    } else {
      await setDoc(
        siteRef,
        buildSitePayload(
          data.settings.companyName || 'Site Principal',
          ownerUid,
          sharedUids,
          data,
          true,
          teamShared
        )
      );
    }

    const existingZones = await getDocs(collection(db, 'sites', siteId, 'zones'));
    const existingPeople = await getDocs(collection(db, 'sites', siteId, 'people'));

    const batch = writeBatch(db);
    existingZones.forEach((d) => batch.delete(d.ref));
    existingPeople.forEach((d) => batch.delete(d.ref));

    data.zones.forEach((zone) => {
      const zId = sanitizeId(zone.id);
      const zRef = doc(db, 'sites', siteId, 'zones', zId);
      batch.set(
        zRef,
        buildZonePayload({ ...zone, id: zId }, ownerUid, sharedUids, true, teamShared)
      );
    });

    data.people.forEach((person) => {
      const pId = sanitizeId(person.id);
      const pRef = doc(db, 'sites', siteId, 'people', pId);
      batch.set(
        pRef,
        buildPersonPayload({ ...person, id: pId }, ownerUid, sharedUids, true, teamShared)
      );
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `sites/${siteId}`);
  }
}

export function subscribeToSiteData(
  siteId: string,
  user: User,
  teamShared: boolean,
  onUpdate: (partial: {
    settings?: PosterSettings;
    activeZoneId?: string;
    zones?: Zone[];
    people?: Person[];
    ownerUid?: string;
    sharedUids?: string[];
    teamShared?: boolean;
  }) => void
): () => void {
  const isAdmin = isAdminUser(user);

  const sitePath = `sites/${siteId}`;
  const zonesPath = `sites/${siteId}/zones`;
  const peoplePath = `sites/${siteId}/people`;

  const unsubSite = onSnapshot(
    doc(db, 'sites', siteId),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      onUpdate({
        ownerUid: String(d.ownerUid || ''),
        sharedUids: Array.isArray(d.sharedUids) ? d.sharedUids.map(String) : [],
        teamShared: d.teamShared === true,
        activeZoneId: String(d.activeZoneId || ''),
        settings: {
          companyLogoDataUrl: d.companyLogoDataUrl ? String(d.companyLogoDataUrl) : null,
          companyLogoSizePx: Number(d.companyLogoSizePx || 54),
          sstLogoDataUrl: d.sstLogoDataUrl ? String(d.sstLogoDataUrl) : null,
          epiLogoDataUrl: d.epiLogoDataUrl ? String(d.epiLogoDataUrl) : null,
          evacuationLogoDataUrl: d.evacuationLogoDataUrl ? String(d.evacuationLogoDataUrl) : null,
          serreFileLogoDataUrl: d.serreFileLogoDataUrl ? String(d.serreFileLogoDataUrl) : null,
          guideLogoDataUrl: d.guideLogoDataUrl ? String(d.guideLogoDataUrl) : null,
          pictogramSizePx: Number(d.pictogramSizePx || 44),
          roleBadgeSizePx: Number(d.roleBadgeSizePx || 24),
          companyName: String(d.companyName || 'ENTREPRISE'),
          lastUpdatedDate: String(d.lastUpdatedDate || getTodayFrenchDate()),
          autoUpdateDate: Boolean(d.autoUpdateDate),
          headerHeightPx: Number(d.headerHeightPx || 68),
          zoneScale: Number(d.zoneScale || 1.15),
          emergencyBoxShape: (['pills', 'stacked', 'rounded', 'chamfer'].includes(
            String(d.emergencyBoxShape)
          )
            ? d.emergencyBoxShape
            : 'pills') as EmergencyBoxShape,
        },
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, sitePath)
  );

  const zonesQuery = isAdmin
    ? collection(db, 'sites', siteId, 'zones')
    : teamShared
    ? query(collection(db, 'sites', siteId, 'zones'), where('teamShared', '==', true))
    : query(collection(db, 'sites', siteId, 'zones'), where('sharedUids', 'array-contains', user.uid));

  const unsubZones = onSnapshot(
    zonesQuery,
    (snap) => {
      const zones: Zone[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: String(d.name || 'ZONE'),
          nearbyZoneIds: Array.isArray(d.nearbyZoneIds) ? d.nearbyZoneIds.map(String) : [],
          epiSitePersonIds: Array.isArray(d.epiSitePersonIds)
            ? d.epiSitePersonIds.map(String)
            : [],
        };
      });
      zones.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      onUpdate({ zones });
    },
    (error) => handleFirestoreError(error, OperationType.LIST, zonesPath)
  );

  const peopleQuery = isAdmin
    ? collection(db, 'sites', siteId, 'people')
    : teamShared
    ? query(collection(db, 'sites', siteId, 'people'), where('teamShared', '==', true))
    : query(
        collection(db, 'sites', siteId, 'people'),
        where('sharedUids', 'array-contains', user.uid)
      );

  const unsubPeople = onSnapshot(
    peopleQuery,
    (snap) => {
      const people: Person[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          lastName: String(d.lastName || ''),
          firstName: String(d.firstName || ''),
          internalNumber: String(d.internalNumber || '0000'),
          roles: Array.isArray(d.roles) ? (d.roles as EmergencyRole[]) : [],
          primaryZoneId: String(d.primaryZoneId || ''),
          coveredZoneIds: Array.isArray(d.coveredZoneIds) ? d.coveredZoneIds.map(String) : [],
          nearbyZoneIds: Array.isArray(d.nearbyZoneIds) ? d.nearbyZoneIds.map(String) : [],
          trainingExpiryDate: String(d.trainingExpiryDate || ''),
          isActive: Boolean(d.isActive),
        };
      });
      onUpdate({ people });
    },
    (error) => handleFirestoreError(error, OperationType.LIST, peoplePath)
  );

  return () => {
    unsubSite();
    unsubZones();
    unsubPeople();
  };
}

export async function checkEditorAccessForUser(
  siteId: string,
  user: User,
  siteOwnerUid: string
): Promise<{ canEdit: boolean; memberName: string | null }> {
  if (isAdminUser(user) || (!user.isAnonymous && user.emailVerified && user.uid === siteOwnerUid)) {
    return { canEdit: true, memberName: user.displayName || user.email || 'Admin QSE' };
  }

  try {
    const memberSnap = await getDoc(doc(db, 'sites', siteId, 'members', user.uid));
    if (!memberSnap.exists()) {
      return { canEdit: false, memberName: null };
    }
    const data = memberSnap.data();
    return {
      canEdit: data.role === 'editor',
      memberName: String(data.displayName || 'Équipe QSE'),
    };
  } catch {
    return { canEdit: false, memberName: null };
  }
}

export async function unlockTeamEditorWithPin(
  siteId: string,
  siteOwnerUid: string,
  user: User,
  pinRaw: string,
  displayNameRaw: string
): Promise<void> {
  const pin = pinRaw.trim();
  if (pin.length < 4 || pin.length > 32) {
    throw new Error('Le code PIN doit contenir entre 4 et 32 caractères.');
  }
  const displayName = (displayNameRaw || user.displayName || 'Équipe QSE').trim().slice(0, 120);
  const memberRef = doc(db, 'sites', siteId, 'members', user.uid);

  try {
    const existing = await getDoc(memberRef);
    if (existing.exists()) {
      await updateDoc(memberRef, {
        inviteCode: pin,
        displayName,
        role: 'editor',
      });
    } else {
      await setDoc(memberRef, {
        uid: user.uid,
        siteOwnerUid,
        displayName,
        role: 'editor',
        inviteCode: pin,
        joinedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('permission') || msg.includes('insufficient')) {
      throw new Error('Code PIN incorrect.');
    }
    handleFirestoreError(error, OperationType.WRITE, `sites/${siteId}/members/${user.uid}`);
  }
}

export async function lockTeamEditorSession(siteId: string, user: User): Promise<void> {
  try {
    await deleteDoc(doc(db, 'sites', siteId, 'members', user.uid));
  } catch {
    // Ignore if already absent
  }
}

export async function getTeamPinForAdmin(siteId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'sites', siteId, 'private', 'teamPin'));
    if (!snap.exists()) return DEFAULT_TEAM_PIN;
    return String(snap.data().pin || DEFAULT_TEAM_PIN);
  } catch {
    return DEFAULT_TEAM_PIN;
  }
}

export async function setTeamPinForAdmin(siteId: string, newPinRaw: string): Promise<string> {
  const pin = newPinRaw.trim();
  if (pin.length < 4 || pin.length > 32) {
    throw new Error('Le code PIN doit contenir entre 4 et 32 caractères.');
  }
  const path = `sites/${siteId}/private/teamPin`;
  try {
    await setDoc(doc(db, 'sites', siteId, 'private', 'teamPin'), {
      pin,
      updatedAt: serverTimestamp(),
    });
    return pin;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateSiteSettingsInFirestore(
  siteId: string,
  settings: PosterSettings,
  activeZoneId: string,
  onPermissionDenied?: () => void
): Promise<void> {
  const path = `sites/${siteId}`;
  try {
    await updateDoc(doc(db, 'sites', siteId), {
      name: (settings.companyName || 'Site Principal').slice(0, 120),
      companyName: (settings.companyName || '').slice(0, 120),
      companyLogoDataUrl: (settings.companyLogoDataUrl || '').slice(0, 399000),
      companyLogoSizePx: Math.min(96, Math.max(24, Number(settings.companyLogoSizePx || 54))),
      sstLogoDataUrl: (settings.sstLogoDataUrl || '').slice(0, 99000),
      epiLogoDataUrl: (settings.epiLogoDataUrl || '').slice(0, 99000),
      evacuationLogoDataUrl: (settings.evacuationLogoDataUrl || '').slice(0, 99000),
      serreFileLogoDataUrl: (settings.serreFileLogoDataUrl || '').slice(0, 99000),
      guideLogoDataUrl: (settings.guideLogoDataUrl || '').slice(0, 99000),
      pictogramSizePx: Math.min(68, Math.max(28, Number(settings.pictogramSizePx || 44))),
      roleBadgeSizePx: Math.min(48, Math.max(18, Number(settings.roleBadgeSizePx || 24))),
      lastUpdatedDate: (settings.lastUpdatedDate || getTodayFrenchDate()).slice(0, 20),
      autoUpdateDate: Boolean(settings.autoUpdateDate),
      headerHeightPx: Math.min(140, Math.max(48, Number(settings.headerHeightPx || 68))),
      zoneScale: Math.min(1.6, Math.max(0.95, Number(settings.zoneScale || 1.15))),
      emergencyBoxShape: settings.emergencyBoxShape || 'pills',
      activeZoneId: (activeZoneId || '').slice(0, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (onPermissionDenied && (msg.includes('permission') || msg.includes('insufficient'))) {
      onPermissionDenied();
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertZoneInFirestore(
  siteId: string,
  zone: Zone,
  ownerUid: string,
  sharedUids: string[],
  isNew: boolean,
  teamShared = true,
  onPermissionDenied?: () => void
): Promise<void> {
  const zId = sanitizeId(zone.id);
  const path = `sites/${siteId}/zones/${zId}`;
  try {
    if (isNew) {
      await setDoc(
        doc(db, 'sites', siteId, 'zones', zId),
        buildZonePayload({ ...zone, id: zId }, ownerUid, sharedUids, true, teamShared)
      );
    } else {
      await updateDoc(
        doc(db, 'sites', siteId, 'zones', zId),
        buildZonePayload({ ...zone, id: zId }, ownerUid, sharedUids, false, teamShared)
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (onPermissionDenied && (msg.includes('permission') || msg.includes('insufficient'))) {
      onPermissionDenied();
      return;
    }
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteZoneInFirestore(
  siteId: string,
  zoneId: string,
  onPermissionDenied?: () => void
): Promise<void> {
  const zId = sanitizeId(zoneId);
  const path = `sites/${siteId}/zones/${zId}`;
  try {
    await deleteDoc(doc(db, 'sites', siteId, 'zones', zId));
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (onPermissionDenied && (msg.includes('permission') || msg.includes('insufficient'))) {
      onPermissionDenied();
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertPersonInFirestore(
  siteId: string,
  person: Person,
  ownerUid: string,
  sharedUids: string[],
  isNew: boolean,
  teamShared = true,
  onPermissionDenied?: () => void
): Promise<void> {
  const pId = sanitizeId(person.id);
  const path = `sites/${siteId}/people/${pId}`;
  try {
    if (isNew) {
      await setDoc(
        doc(db, 'sites', siteId, 'people', pId),
        buildPersonPayload({ ...person, id: pId }, ownerUid, sharedUids, true, teamShared)
      );
    } else {
      await updateDoc(
        doc(db, 'sites', siteId, 'people', pId),
        buildPersonPayload({ ...person, id: pId }, ownerUid, sharedUids, false, teamShared)
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (onPermissionDenied && (msg.includes('permission') || msg.includes('insufficient'))) {
      onPermissionDenied();
      return;
    }
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deletePersonInFirestore(
  siteId: string,
  personId: string,
  onPermissionDenied?: () => void
): Promise<void> {
  const pId = sanitizeId(personId);
  const path = `sites/${siteId}/people/${pId}`;
  try {
    await deleteDoc(doc(db, 'sites', siteId, 'people', pId));
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (onPermissionDenied && (msg.includes('permission') || msg.includes('insufficient'))) {
      onPermissionDenied();
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Partage d'équipe : codes d'invitation et membres
export async function createSiteInviteInFirestore(
  siteId: string,
  createdByUid: string,
  role: 'editor' | 'viewer' = 'editor'
): Promise<string> {
  const code = `QSE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const path = `siteInvites/${code}`;
  try {
    await setDoc(doc(db, 'siteInvites', code), {
      siteId,
      createdByUid,
      role,
      active: true,
      createdAt: serverTimestamp(),
    });
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listSiteInvites(
  siteId: string,
  user: User
): Promise<SiteInviteRecord[]> {
  const isAdmin = isAdminUser(user);
  try {
    const q = isAdmin
      ? query(collection(db, 'siteInvites'), where('siteId', '==', siteId))
      : query(collection(db, 'siteInvites'), where('createdByUid', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          code: d.id,
          siteId: String(data.siteId),
          role: (data.role === 'viewer' ? 'viewer' : 'editor') as 'editor' | 'viewer',
          active: Boolean(data.active),
        };
      })
      .filter((inv) => inv.siteId === siteId);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'siteInvites');
  }
}

export async function listSiteMembers(siteId: string): Promise<SiteMemberRecord[]> {
  const path = `sites/${siteId}/members`;
  try {
    const snap = await getDocs(collection(db, 'sites', siteId, 'members'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        siteOwnerUid: String(data.siteOwnerUid || ''),
        displayName: String(data.displayName || 'Collaborateur'),
        role: (data.role === 'viewer' ? 'viewer' : 'editor') as 'editor' | 'viewer',
        inviteCode: String(data.inviteCode || ''),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function joinSiteWithInviteCode(
  inviteCodeRaw: string,
  user: User
): Promise<string> {
  const code = inviteCodeRaw.trim().toUpperCase();
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(code)) {
    throw new Error('Format de code d’invitation invalide.');
  }

  const inviteSnap = await getDoc(doc(db, 'siteInvites', code));
  if (!inviteSnap.exists()) {
    throw new Error('Code d’invitation introuvable.');
  }
  const inviteData = inviteSnap.data();
  if (!inviteData.active) {
    throw new Error('Ce code d’invitation n’est plus actif.');
  }
  const siteId = String(inviteData.siteId);
  const role = inviteData.role === 'viewer' ? 'viewer' : 'editor';

  const siteSnap = await getDoc(doc(db, 'sites', siteId));
  if (!siteSnap.exists()) {
    throw new Error('Site introuvable.');
  }
  const siteOwnerUid = String(siteSnap.data().ownerUid);

  const memberPath = `sites/${siteId}/members/${user.uid}`;
  try {
    await setDoc(doc(db, 'sites', siteId, 'members', user.uid), {
      uid: user.uid,
      siteOwnerUid,
      displayName: (user.displayName || 'Collaborateur').slice(0, 120),
      role,
      inviteCode: code,
      joinedAt: serverTimestamp(),
    });
    return siteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, memberPath);
  }
}

/**
 * Ajoute les UID des membres du site dans `sharedUids` (site, zones et personnel)
 * et active `teamShared: true`.
 */
export async function syncSharedUidsForSite(
  siteId: string,
  ownerUid: string,
  memberUids: string[]
): Promise<void> {
  const nextShared = Array.from(new Set([ownerUid, ...memberUids])).slice(0, 10);
  try {
    const zonesSnap = await getDocs(collection(db, 'sites', siteId, 'zones'));
    const peopleSnap = await getDocs(collection(db, 'sites', siteId, 'people'));

    const batch = writeBatch(db);
    batch.update(doc(db, 'sites', siteId), {
      sharedUids: nextShared,
      teamShared: true,
      updatedAt: serverTimestamp(),
    });
    zonesSnap.forEach((z) => {
      batch.update(z.ref, { sharedUids: nextShared, teamShared: true, updatedAt: serverTimestamp() });
    });
    peopleSnap.forEach((p) => {
      batch.update(p.ref, { sharedUids: nextShared, teamShared: true, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sites/${siteId}`);
  }
}

export function isTimestamp(val: unknown): val is Timestamp {
  return val instanceof Timestamp;
}
