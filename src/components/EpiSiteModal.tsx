import React, { useMemo, useState } from 'react';
import { AlertTriangle, Flame, Search, X } from 'lucide-react';
import { Person, Zone } from '../types';
import { isNearbyToActiveZone, personCoversZone } from '../utils/posterLogic';
import { isPersonEligibleForPoster } from '../utils/validation';

interface EpiSiteModalProps {
  isOpen: boolean;
  zone: Zone | undefined;
  people: Person[];
  zonesById: Map<string, Zone>;
  onTogglePerson: (zoneId: string, personId: string) => void;
  onClearAll: (zoneId: string) => void;
  onClose: () => void;
}

export const EpiSiteModal: React.FC<EpiSiteModalProps> = ({
  isOpen,
  zone,
  people,
  zonesById,
  onTogglePerson,
  onClearAll,
  onClose,
}) => {
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    if (!zone) {
      return { inZoneCount: 0, nearbyCount: 0, selectedCount: 0, candidates: [] as Person[] };
    }
    const eligibleEpi = people.filter(
      (p) => isPersonEligibleForPoster(p) && p.roles.includes('EPI')
    );
    const inZoneCount = eligibleEpi.filter((p) => personCoversZone(p, zone.id)).length;
    const nearbyCount = eligibleEpi.filter(
      (p) => !personCoversZone(p, zone.id) && isNearbyToActiveZone(p, zone)
    ).length;

    const selectedSet = new Set(zone.epiSitePersonIds || []);
    const candidates = people
      .filter((p) => {
        if (!p.roles.includes('EPI')) return false;
        if (personCoversZone(p, zone.id)) return false;
        if (isNearbyToActiveZone(p, zone)) return false;
        return isPersonEligibleForPoster(p) || selectedSet.has(p.id);
      })
      .sort((a, b) => {
        const lastCompare = a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' });
        if (lastCompare !== 0) return lastCompare;
        return a.firstName.localeCompare(b.firstName, 'fr', { sensitivity: 'base' });
      });

    const selectedCount = eligibleEpi.filter(
      (p) =>
        selectedSet.has(p.id) &&
        !personCoversZone(p, zone.id) &&
        !isNearbyToActiveZone(p, zone)
    ).length;

    return { inZoneCount, nearbyCount, selectedCount, candidates };
  }, [zone, people]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stats.candidates;
    return stats.candidates.filter((p) => {
      const zoneName = zonesById.get(p.primaryZoneId)?.name || '';
      return (
        p.lastName.toLowerCase().includes(q) ||
        p.firstName.toLowerCase().includes(q) ||
        p.internalNumber.toLowerCase().includes(q) ||
        zoneName.toLowerCase().includes(q)
      );
    });
  }, [stats.candidates, search, zonesById]);

  if (!isOpen || !zone) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="epi-site-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#D91E18] shrink-0" />
              <h2
                id="epi-site-modal-title"
                className="font-display font-bold text-base text-slate-900 truncate"
              >
                E.P.I « SITE » · {zone.name}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cochez les E.P.I d&apos;autres zones à afficher sous « PROCHE DE LA ZONE ».
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono-num text-slate-700">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Zone : <strong className="text-slate-900">{stats.inZoneCount}</strong>
              </span>
              <span>
                Proche : <strong className="text-slate-900">{stats.nearbyCount}</strong>
              </span>
              <span>
                SITE choisis :{' '}
                <strong className="text-[#B91C1C]">{stats.selectedCount}</strong>
              </span>
            </div>
            {(zone.epiSitePersonIds || []).length > 0 && (
              <button
                type="button"
                onClick={() => onClearAll(zone.id)}
                className="font-sans text-xs font-semibold text-slate-500 hover:text-red-700 cursor-pointer"
              >
                Tout décocher
              </button>
            )}
          </div>

          {stats.inZoneCount + stats.nearbyCount <= 1 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Peu d&apos;E.P.I dans cette zone ou à proximité. Sélectionnez des E.P.I du site
                ci-dessous.
              </span>
            </div>
          )}

          {stats.candidates.length > 4 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, prénom ou zone..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>
          )}

          {filteredCandidates.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              {stats.candidates.length === 0
                ? "Aucun autre équipier E.P.I disponible sur le site en dehors de cette zone et des zones proches."
                : 'Aucun résultat pour cette recherche.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredCandidates.map((person) => {
                const isChecked = (zone.epiSitePersonIds || []).includes(person.id);
                const primaryZoneName =
                  zonesById.get(person.primaryZoneId)?.name || 'ZONE INCONNUE';
                const isEligible = isPersonEligibleForPoster(person);

                return (
                  <label
                    key={person.id}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-[#D91E18] bg-red-50/60 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onTogglePerson(zone.id, person.id)}
                        className="w-4 h-4 accent-[#D91E18] rounded cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-display font-bold text-sm uppercase">
                            {person.lastName}
                          </span>
                          <span className="text-sm font-medium text-slate-800">
                            {person.firstName}
                          </span>
                          {!isEligible && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              Inactif / Expiré
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate uppercase">
                          {primaryZoneName}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-[#B91C1C] shrink-0 whitespace-nowrap">
                      N° {person.internalNumber}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-end bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Terminer
          </button>
        </div>
      </div>
    </div>
  );
};
