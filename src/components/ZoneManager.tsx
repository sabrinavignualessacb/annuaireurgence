import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Flame, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Person, Zone } from '../types';
import { isNearbyToActiveZone, personCoversZone } from '../utils/posterLogic';
import { isPersonEligibleForPoster } from '../utils/validation';

interface ZoneManagerProps {
  zones: Zone[];
  people: Person[];
  activeZoneId: string;
  onSelectActiveZone: (zoneId: string) => void;
  onCreateZone: (name: string) => void;
  onCreateMultipleZones: (names: string[]) => number;
  onRenameZone: (zoneId: string, newName: string) => void;
  onDeleteZone: (zoneId: string) => void;
  onToggleZoneProximity: (zoneId: string, nearbyZoneId: string, bidirectional: boolean) => void;
  onToggleEpiSitePerson: (zoneId: string, personId: string) => void;
  onClearZoneEpiSite: (zoneId: string) => void;
}

export const ZoneManager: React.FC<ZoneManagerProps> = ({
  zones,
  people,
  activeZoneId,
  onSelectActiveZone,
  onCreateZone,
  onCreateMultipleZones,
  onRenameZone,
  onDeleteZone,
  onToggleZoneProximity,
  onToggleEpiSitePerson,
  onClearZoneEpiSite,
}) => {
  const [newZoneName, setNewZoneName] = useState('');
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [selectedConfigZoneId, setSelectedConfigZoneId] = useState<string>(activeZoneId);
  const [bidirectional, setBidirectional] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const configZone = zones.find((z) => z.id === selectedConfigZoneId) || zones[0];

  const zonesById = useMemo(() => {
    const map = new Map<string, Zone>();
    zones.forEach((z) => map.set(z.id, z));
    return map;
  }, [zones]);

  const epiStatsForConfigZone = useMemo(() => {
    if (!configZone) {
      return { inZoneCount: 0, nearbyCount: 0, selectedCount: 0, candidates: [] as Person[] };
    }
    const eligibleEpi = people.filter(
      (p) => isPersonEligibleForPoster(p) && p.roles.includes('EPI')
    );
    const inZoneCount = eligibleEpi.filter((p) => personCoversZone(p, configZone.id)).length;
    const nearbyCount = eligibleEpi.filter(
      (p) => !personCoversZone(p, configZone.id) && isNearbyToActiveZone(p, configZone)
    ).length;

    const selectedSet = new Set(configZone.epiSitePersonIds || []);
    const candidates = people
      .filter((p) => {
        if (!p.roles.includes('EPI')) return false;
        if (personCoversZone(p, configZone.id)) return false;
        if (isNearbyToActiveZone(p, configZone)) return false;
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
        !personCoversZone(p, configZone.id) &&
        !isNearbyToActiveZone(p, configZone)
    ).length;

    return { inZoneCount, nearbyCount, selectedCount, candidates };
  }, [configZone, people]);

  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newZoneName.trim().toUpperCase();
    if (!trimmed) return;
    onCreateZone(trimmed);
    setNewZoneName('');
  };

  const handleBatchCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const names = batchText
      .split(/[\n,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    if (names.length === 0) return;
    const createdCount = onCreateMultipleZones(names);
    setBatchText('');
    setShowBatchForm(false);
    setBatchFeedback(
      createdCount > 0
        ? `${createdCount} zone(s) ajoutée(s).`
        : 'Toutes ces zones existent déjà.'
    );
  };

  const startRename = (zone: Zone) => {
    setEditingZoneId(zone.id);
    setEditingName(zone.name);
  };

  const commitRename = (zoneId: string) => {
    const trimmed = editingName.trim().toUpperCase();
    if (trimmed) {
      onRenameZone(zoneId, trimmed);
    }
    setEditingZoneId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Liste et gestion des zones */}
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">
              Zones du site <span className="font-mono-num text-sm text-slate-500">({zones.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Créez toutes vos zones (ex. SALLE DE PAUSE, ATELIER, BUREAUX, MAGASIN...).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowBatchForm((v) => !v);
              setBatchFeedback(null);
            }}
            className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showBatchForm ? 'Fermer ajout en lot' : '+ Ajouter plusieurs zones'}
          </button>
        </div>

        <form onSubmit={handleAddZone} className="flex items-center gap-2">
          <input
            type="text"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value.toUpperCase())}
            placeholder="Nom de la nouvelle zone..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg uppercase font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
          />
          <button
            type="submit"
            disabled={!newZoneName.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Créer</span>
          </button>
        </form>

        {showBatchForm && (
          <form
            onSubmit={handleBatchCreate}
            className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5"
          >
            <label className="block text-xs font-semibold text-slate-800">
              Création rapide en lot (une zone par ligne ou séparées par des virgules)
            </label>
            <textarea
              rows={4}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={'ACCUEIL\nATELIER CMS\nATELIER TEST\nMAGASIN\nEXPÉDITIONS'}
              className="w-full px-3 py-2 text-xs font-semibold uppercase border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchForm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!batchText.trim()}
                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Créer toutes ces zones
              </button>
            </div>
          </form>
        )}

        {batchFeedback && (
          <p className="text-xs font-semibold text-emerald-700">{batchFeedback}</p>
        )}

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-y-auto max-h-[460px]">
          {zones.map((zone) => {
            const assignedCount = people.filter((p) => personCoversZone(p, zone.id)).length;
            const isSelectedForConfig = configZone?.id === zone.id;
            const isActivePoster = activeZoneId === zone.id;

            return (
              <div
                key={zone.id}
                onClick={() => setSelectedConfigZoneId(zone.id)}
                className={`px-3.5 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  isSelectedForConfig ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {editingZoneId === zone.id ? (
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(zone.id);
                          if (e.key === 'Escape') setEditingZoneId(null);
                        }}
                        className="px-2 py-1 text-sm font-bold uppercase border border-slate-400 rounded w-full max-w-xs"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(zone.id)}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                        title="Valider"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingZoneId(null)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                        title="Annuler"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sm text-slate-900 uppercase truncate">
                          {zone.name}
                        </span>
                        {isActivePoster && (
                          <span className="text-[11px] font-semibold text-red-700">
                            · Affiche active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
                        {assignedCount} personne{assignedCount > 1 ? 's' : ''}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        {zone.nearbyZoneIds.length} zone{zone.nearbyZoneIds.length > 1 ? 's' : ''} proche
                        {zone.nearbyZoneIds.length > 1 ? 's' : ''}
                        {(zone.epiSitePersonIds || []).length > 0 && (
                          <>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="text-red-700 font-semibold">
                              {(zone.epiSitePersonIds || []).length} E.P.I Site
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {editingZoneId !== zone.id && (
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!isActivePoster && (
                      <button
                        type="button"
                        onClick={() => onSelectActiveZone(zone.id)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-white cursor-pointer"
                      >
                        Afficher
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startRename(zone)}
                      title="Renommer la zone"
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-md cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {zones.length > 1 &&
                      (confirmDeleteId === zone.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteZone(zone.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                          >
                            Supprimer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(zone.id)}
                          title="Supprimer la zone"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Colonne droite : Proximité & E.P.I SITE */}
      <div className="lg:col-span-6 space-y-5">
        {/* Configuration de proximité */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900">
                Zones « Proche de la zone »
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Définissez les zones voisines dont les SST et EPI apparaîtront dans le bloc{' '}
                <strong className="text-slate-700">PROCHE DE LA ZONE</strong>.
              </p>
            </div>
          </div>

          {configZone && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-xs text-slate-600">Zone configurée :</span>
                  <span className="font-display font-bold text-sm text-slate-900 uppercase truncate">
                    {configZone.name}
                  </span>
                </div>
                <select
                  value={configZone.id}
                  onChange={(e) => setSelectedConfigZoneId(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white"
                  aria-label="Choisir la zone à configurer"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bidirectional}
                  onChange={(e) => setBidirectional(e.target.checked)}
                  className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
                />
                <span>Rendre la proximité réciproque automatiquement (A ↔ B)</span>
              </label>

              {zones.length <= 1 ? (
                <p className="text-sm text-slate-500 py-4">
                  Créez au moins une deuxième zone pour configurer la proximité géographique.
                </p>
              ) : (
                <div className="space-y-2">
                  {zones
                    .filter((z) => z.id !== configZone.id)
                    .map((other) => {
                      const isNearby = configZone.nearbyZoneIds.includes(other.id);
                      const otherCount = people.filter((p) => personCoversZone(p, other.id)).length;

                      return (
                        <label
                          key={other.id}
                          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                            isNearby
                              ? 'border-emerald-500 bg-emerald-50/60 text-slate-900'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isNearby}
                              onChange={() =>
                                onToggleZoneProximity(configZone.id, other.id, bidirectional)
                              }
                              className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="font-display font-bold text-sm uppercase truncate">
                                {other.name}
                              </p>
                              <p className="text-xs text-slate-500 font-mono-num">
                                {otherCount} personne{otherCount > 1 ? 's' : ''} rattachée
                                {otherCount > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-xs font-semibold whitespace-nowrap ${
                              isNearby ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {isNearby ? 'Proche' : 'Éloignée (Site)'}
                          </span>
                        </label>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sélection des E.P.I « SITE » pour cette zone */}
        {configZone && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#D91E18] shrink-0" />
                  <h2 className="font-display font-bold text-lg text-slate-900">
                    E.P.I « SITE » pour cette zone
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Ajoutez manuellement des équipiers E.P.I d&apos;autres zones dans la colonne{' '}
                  <strong className="text-slate-700">ÉQUIPIERS DE PREMIÈRE INTERVENTION</strong>{' '}
                  (bloc <strong className="text-slate-700">SITE</strong>) de{' '}
                  <strong className="uppercase text-slate-800">{configZone.name}</strong>.
                </p>
              </div>
              {(configZone.epiSitePersonIds || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => onClearZoneEpiSite(configZone.id)}
                  className="text-xs font-semibold text-slate-500 hover:text-red-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Tout décocher
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono-num text-slate-700">
              <span>
                Dans la zone :{' '}
                <strong className="text-slate-900">{epiStatsForConfigZone.inZoneCount}</strong>
              </span>
              <span>
                Proche :{' '}
                <strong className="text-slate-900">{epiStatsForConfigZone.nearbyCount}</strong>
              </span>
              <span>
                SITE choisis :{' '}
                <strong className="text-[#B91C1C]">{epiStatsForConfigZone.selectedCount}</strong>
              </span>
            </div>

            {epiStatsForConfigZone.inZoneCount + epiStatsForConfigZone.nearbyCount <= 1 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Effectif E.P.I réduit dans cette zone ou à proximité. Cochez ci-dessous des
                  équipiers E.P.I du site à afficher en renfort.
                </span>
              </div>
            )}

            {epiStatsForConfigZone.candidates.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Tous les E.P.I actifs du site sont déjà affectés à cette zone ou à ses zones
                proches (ou aucun autre E.P.I n&apos;est disponible).
              </p>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
                {epiStatsForConfigZone.candidates.map((person) => {
                  const isChecked = (configZone.epiSitePersonIds || []).includes(person.id);
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
                          onChange={() => onToggleEpiSitePerson(configZone.id, person.id)}
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
        )}
      </div>
    </div>
  );
};
