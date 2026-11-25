import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Person, ROLE_SHORT_LABELS, Zone } from '../types';
import { getPersonCoveredZoneIds, personCoversZone } from '../utils/posterLogic';
import {
  formatIsoToFrenchDate,
  getDaysUntilExpiry,
  getTrainingStatus,
  isPersonEligibleForPoster,
} from '../utils/validation';

interface PersonnelManagerProps {
  people: Person[];
  zones: Zone[];
  zonesById: Map<string, Zone>;
  onAddPerson: () => void;
  onEditPerson: (person: Person) => void;
  onToggleActive: (personId: string) => void;
  onDeletePerson: (personId: string) => void;
}

type FilterMode = 'all' | 'eligible' | 'excluded' | 'SST' | 'EPI' | 'EVAC';

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
  people,
  zones,
  zonesById,
  onAddPerson,
  onEditPerson,
  onToggleActive,
  onDeletePerson,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let eligible = 0;
    let excluded = 0;
    people.forEach((p) => {
      if (isPersonEligibleForPoster(p)) eligible++;
      else excluded++;
    });
    return { total: people.length, eligible, excluded };
  }, [people]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people
      .filter((p) => {
        if (zoneFilter !== 'all' && !personCoversZone(p, zoneFilter)) return false;
        const eligible = isPersonEligibleForPoster(p);
        if (filterMode === 'eligible' && !eligible) return false;
        if (filterMode === 'excluded' && eligible) return false;
        if (filterMode === 'SST' && !p.roles.includes('SST')) return false;
        if (filterMode === 'EPI' && !p.roles.includes('EPI')) return false;
        if (
          filterMode === 'EVAC' &&
          !p.roles.includes('GUIDE') &&
          !p.roles.includes('SERRE_FILE')
        ) {
          return false;
        }
        if (q) {
          const full = `${p.lastName} ${p.firstName} ${p.internalNumber}`.toLowerCase();
          if (!full.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' }));
  }, [people, search, filterMode, zoneFilter]);

  return (
    <div className="space-y-4">
      {/* En-tête de section + bouton Ajouter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h2 className="font-display font-bold text-lg text-slate-900">
            Gestion du personnel d&apos;urgence
          </h2>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-mono-num">{counts.total} personnes enregistrées</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-emerald-700 font-medium">
              {counts.eligible} actives sur l&apos;affiche
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-amber-700 font-medium">
              {counts.excluded} masquée{counts.excluded > 1 ? 's' : ''} (expirée ou désactivée)
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onAddPerson}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter une personne</span>
        </button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher nom, N° interne..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
            />
          </div>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-600/20 max-w-full"
            aria-label="Filtrer par zone"
          >
            <option value="all">Toutes les zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        {/* Contrôle segmenté des filtres (retour à la ligne propre sans scroll horizontal) */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'eligible', label: 'Sur l’affiche' },
              { id: 'excluded', label: 'Expirés / Inactifs' },
              { id: 'SST', label: 'SST' },
              { id: 'EPI', label: 'EPI' },
              { id: 'EVAC', label: 'Évacuation' },
            ] as { id: FilterMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste sans défilement horizontal */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredPeople.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Aucun membre du personnel ne correspond à ces critères.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Modifiez votre recherche ou ajoutez une nouvelle fiche personnel.
            </p>
          </div>
        ) : (
          <>
            {/* Vue cartes pour petits écrans */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredPeople.map((person) => {
                const status = getTrainingStatus(person.trainingExpiryDate);
                const daysLeft = getDaysUntilExpiry(person.trainingExpiryDate);
                const eligible = isPersonEligibleForPoster(person);
                const coveredNames = getPersonCoveredZoneIds(person)
                  .map((zid) => zonesById.get(zid)?.name)
                  .filter((n): n is string => Boolean(n));

                return (
                  <div
                    key={person.id}
                    className={`p-4 space-y-2.5 ${!eligible ? 'bg-slate-50/60 text-slate-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm text-slate-900 uppercase break-words">
                          {person.lastName}{' '}
                          <span className="font-semibold normal-case text-slate-700">
                            {person.firstName}
                          </span>
                        </p>
                        <p className="text-xs font-mono-num font-bold text-slate-700 mt-0.5">
                          N° {person.internalNumber} ·{' '}
                          <span className="font-sans font-medium">
                            {person.roles.map((r) => ROLE_SHORT_LABELS[r]).join(' · ') || '—'}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleActive(person.id)}
                          title={person.isActive ? 'Désactiver' : 'Réactiver'}
                          className={`p-1.5 rounded-md cursor-pointer ${
                            person.isActive
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-emerald-700 bg-emerald-50'
                          }`}
                        >
                          {person.isActive ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditPerson(person)}
                          title="Modifier"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePerson(person.id)}
                          title="Supprimer"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {coveredNames.map((zn, idx) => (
                        <span
                          key={zn}
                          className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                            idx === 0
                              ? 'bg-slate-100 border-slate-300 text-slate-800'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                        >
                          {zn}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono-num text-slate-600">
                        Validité : {formatIsoToFrenchDate(person.trainingExpiryDate)}
                        {status === 'expired' && (
                          <span className="ml-1.5 text-red-700 font-semibold font-sans">
                            (Expirée)
                          </span>
                        )}
                        {status === 'expiring_soon' && daysLeft !== null && (
                          <span className="ml-1.5 text-amber-700 font-semibold font-sans">
                            (J-{daysLeft})
                          </span>
                        )}
                      </span>
                      <span
                        className={`font-semibold ${
                          eligible
                            ? 'text-emerald-700'
                            : !person.isActive
                            ? 'text-slate-600'
                            : 'text-red-700'
                        }`}
                      >
                        {eligible
                          ? 'Sur l’affiche'
                          : !person.isActive
                          ? 'Désactivé'
                          : 'Masqué'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tableau desktop responsive 100% largeur (aucun scroll horizontal) */}
            <table className="hidden md:table w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3 w-[19%]">Nom &amp; Prénom</th>
                  <th className="py-3 px-2.5 w-[11%]">N° Interne</th>
                  <th className="py-3 px-2.5 w-[13%]">Rôles</th>
                  <th className="py-3 px-2.5 w-[21%]">Zone(s) couverte(s)</th>
                  <th className="py-3 px-2.5 w-[13%]">Validité</th>
                  <th className="py-3 px-2.5 w-[12%]">Statut</th>
                  <th className="py-3 px-3 w-[11%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredPeople.map((person) => {
                  const status = getTrainingStatus(person.trainingExpiryDate);
                  const daysLeft = getDaysUntilExpiry(person.trainingExpiryDate);
                  const eligible = isPersonEligibleForPoster(person);
                  const coveredNames = getPersonCoveredZoneIds(person)
                    .map((zid) => zonesById.get(zid)?.name)
                    .filter((n): n is string => Boolean(n));

                  return (
                    <tr
                      key={person.id}
                      className={`transition-colors hover:bg-slate-50/80 ${
                        !eligible ? 'bg-slate-50/50 text-slate-500' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 align-top break-words">
                        <span className="font-display font-bold uppercase text-slate-900">
                          {person.lastName}
                        </span>{' '}
                        <span className="text-slate-700">{person.firstName}</span>
                      </td>

                      <td className="py-2.5 px-2.5 align-top font-mono-num text-xs font-semibold text-slate-800 break-words">
                        N° {person.internalNumber}
                      </td>

                      <td className="py-2.5 px-2.5 align-top">
                        <span className="text-xs font-medium text-slate-700 break-words">
                          {person.roles.map((r) => ROLE_SHORT_LABELS[r]).join(' · ') || '—'}
                        </span>
                      </td>

                      <td className="py-2.5 px-2.5 align-top">
                        <div className="flex flex-wrap gap-1">
                          {coveredNames.length > 0 ? (
                            coveredNames.map((zn, idx) => (
                              <span
                                key={zn}
                                className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold leading-tight break-words ${
                                  idx === 0
                                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {zn}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 align-top">
                        <div className="flex flex-col gap-0.5 font-mono-num text-xs">
                          <span>{formatIsoToFrenchDate(person.trainingExpiryDate)}</span>
                          {status === 'expired' && (
                            <span className="inline-flex items-center gap-1 text-red-700 font-semibold font-sans text-[11px]">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Expirée
                            </span>
                          )}
                          {status === 'expiring_soon' && daysLeft !== null && (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-semibold font-sans text-[11px]">
                              <Clock className="w-3 h-3 shrink-0" />
                              J-{daysLeft}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-2.5 align-top">
                        {eligible ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Actif</span>
                          </span>
                        ) : !person.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                            <EyeOff className="w-3.5 h-3.5 shrink-0" />
                            <span>Désactivé</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Masqué</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => onToggleActive(person.id)}
                            title={
                              person.isActive
                                ? 'Désactiver (retirer de l’affiche)'
                                : 'Réactiver sur l’affiche'
                            }
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              person.isActive
                                ? 'text-slate-600 hover:bg-slate-200/70'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            {person.isActive ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditPerson(person)}
                            title="Modifier"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {confirmDeleteId === person.id ? (
                            <div className="inline-flex items-center gap-1 ml-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeletePerson(person.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-1.5 py-0.5 text-[11px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                Non
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(person.id)}
                              title="Supprimer"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};
