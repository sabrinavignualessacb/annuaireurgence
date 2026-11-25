import { Person, Zone } from '../types';
import { isPersonEligibleForPoster } from './validation';

export interface PosterColumnsData {
  sstZone: Person[];
  sstNearby: Person[];
  sstSite: Person[];
  epiZone: Person[];
  epiNearby: Person[];
  evacSerreFile: Person[];
  evacGuide: Person[];
  eligibleCount: number;
  excludedCount: number;
}

function sortByLastName(a: Person, b: Person): number {
  const lastCompare = a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' });
  if (lastCompare !== 0) return lastCompare;
  return a.firstName.localeCompare(b.firstName, 'fr', { sensitivity: 'base' });
}

export function getPersonCoveredZoneIds(person: Person): string[] {
  return Array.from(
    new Set([person.primaryZoneId, ...(person.coveredZoneIds || [])].filter(Boolean))
  );
}

export function personCoversZone(person: Person, zoneId: string): boolean {
  if (!zoneId) return false;
  if (person.primaryZoneId === zoneId) return true;
  return Array.isArray(person.coveredZoneIds) && person.coveredZoneIds.includes(zoneId);
}

function isNearbyToActiveZone(person: Person, activeZone: Zone): boolean {
  if (personCoversZone(person, activeZone.id)) return false;
  const coveredIds = getPersonCoveredZoneIds(person);
  const zoneConfiguredNearby = coveredIds.some((zid) =>
    activeZone.nearbyZoneIds.includes(zid)
  );
  const personExplicitNearby = (person.nearbyZoneIds || []).includes(activeZone.id);
  return zoneConfiguredNearby || personExplicitNearby;
}

export function getNearbyDisplayZoneName(
  person: Person,
  activeZone: Zone | undefined,
  zonesById: Map<string, Zone>
): string | undefined {
  if (activeZone) {
    if (activeZone.nearbyZoneIds.includes(person.primaryZoneId)) {
      return zonesById.get(person.primaryZoneId)?.name;
    }
    const matchingCoveredId = (person.coveredZoneIds || []).find((zid) =>
      activeZone.nearbyZoneIds.includes(zid)
    );
    if (matchingCoveredId) {
      return zonesById.get(matchingCoveredId)?.name;
    }
  }
  return zonesById.get(person.primaryZoneId)?.name;
}

export function computePosterColumns(
  people: Person[],
  activeZone: Zone | undefined
): PosterColumnsData {
  if (!activeZone) {
    return {
      sstZone: [],
      sstNearby: [],
      sstSite: [],
      epiZone: [],
      epiNearby: [],
      evacSerreFile: [],
      evacGuide: [],
      eligibleCount: 0,
      excludedCount: people.length,
    };
  }

  const eligible = people.filter(isPersonEligibleForPoster);
  const excludedCount = people.length - eligible.length;

  // Colonne 1 : S.S.T
  const allSst = eligible.filter((p) => p.roles.includes('SST'));
  const sstZone = allSst.filter((p) => personCoversZone(p, activeZone.id)).sort(sortByLastName);
  const sstNearby = allSst
    .filter((p) => !personCoversZone(p, activeZone.id) && isNearbyToActiveZone(p, activeZone))
    .sort(sortByLastName);
  const sstZoneAndNearbyIds = new Set([...sstZone, ...sstNearby].map((p) => p.id));
  const sstSite = allSst.filter((p) => !sstZoneAndNearbyIds.has(p.id)).sort(sortByLastName);

  // Colonne 2 : E.P.I
  const allEpi = eligible.filter((p) => p.roles.includes('EPI'));
  const epiZone = allEpi.filter((p) => personCoversZone(p, activeZone.id)).sort(sortByLastName);
  const epiNearby = allEpi
    .filter((p) => !personCoversZone(p, activeZone.id) && isNearbyToActiveZone(p, activeZone))
    .sort(sortByLastName);

  // Colonne 3 : ÉVACUATION SECOURS (zone active uniquement, incluant multi-zones)
  const zoneEvacEligible = eligible.filter((p) => personCoversZone(p, activeZone.id));
  const evacSerreFile = zoneEvacEligible
    .filter((p) => p.roles.includes('SERRE_FILE'))
    .sort(sortByLastName);
  const evacGuide = zoneEvacEligible
    .filter((p) => p.roles.includes('GUIDE'))
    .sort(sortByLastName);

  return {
    sstZone,
    sstNearby,
    sstSite,
    epiZone,
    epiNearby,
    evacSerreFile,
    evacGuide,
    eligibleCount: eligible.length,
    excludedCount,
  };
}
