import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { EmergencyRole, Person, ROLE_LABELS, Zone } from '../types';
import {
  getDaysUntilExpiry,
  getTrainingStatus,
  isValidInternalNumber,
  normalizeInternalNumber,
} from '../utils/validation';

interface PersonModalProps {
  isOpen: boolean;
  personToEdit: Person | null;
  zones: Zone[];
  defaultZoneId: string;
  onClose: () => void;
  onSave: (personData: Omit<Person, 'id'>, existingId?: string) => void;
}

const ALL_ROLES: EmergencyRole[] = ['SST', 'EPI', 'GUIDE', 'SERRE_FILE'];

export const PersonModal: React.FC<PersonModalProps> = ({
  isOpen,
  personToEdit,
  zones,
  defaultZoneId,
  onClose,
  onSave,
}) => {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [internalNumber, setInternalNumber] = useState('');
  const [roles, setRoles] = useState<EmergencyRole[]>(['SST']);
  const [primaryZoneId, setPrimaryZoneId] = useState(defaultZoneId);
  const [nearbyZoneIds, setNearbyZoneIds] = useState<string[]>([]);
  const [trainingExpiryDate, setTrainingExpiryDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (personToEdit) {
      setLastName(personToEdit.lastName);
      setFirstName(personToEdit.firstName);
      setInternalNumber(personToEdit.internalNumber);
      setRoles(personToEdit.roles);
      setPrimaryZoneId(personToEdit.primaryZoneId);
      setNearbyZoneIds(personToEdit.nearbyZoneIds || []);
      setTrainingExpiryDate(personToEdit.trainingExpiryDate);
      setIsActive(personToEdit.isActive);
    } else {
      setLastName('');
      setFirstName('');
      setInternalNumber('');
      setRoles(['SST']);
      setPrimaryZoneId(defaultZoneId || zones[0]?.id || '');
      setNearbyZoneIds([]);
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setTrainingExpiryDate(nextYear.toISOString().slice(0, 10));
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [isOpen, personToEdit, defaultZoneId, zones]);

  if (!isOpen) return null;

  const toggleRole = (role: EmergencyRole) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleNearbyZone = (zoneId: string) => {
    setNearbyZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLast = lastName.trim().toUpperCase();
    const cleanFirst = firstName.trim();
    const cleanNum = normalizeInternalNumber(internalNumber);

    if (!cleanLast) {
      setErrorMsg('Le nom de famille est obligatoire.');
      return;
    }
    if (!cleanFirst) {
      setErrorMsg('Le prénom est obligatoire.');
      return;
    }
    if (!isValidInternalNumber(cleanNum)) {
      setErrorMsg(
        'Le numéro interne doit contenir exactement 4 chiffres (ex. 7947) ou deux numéros à 4 chiffres séparés par "/" (ex. 7974/7311).'
      );
      return;
    }
    if (roles.length === 0) {
      setErrorMsg('Sélectionnez au moins un rôle de sécurité.');
      return;
    }
    if (!primaryZoneId) {
      setErrorMsg('Sélectionnez une zone principale.');
      return;
    }

    onSave(
      {
        lastName: cleanLast,
        firstName: cleanFirst,
        internalNumber: cleanNum,
        roles,
        primaryZoneId,
        nearbyZoneIds: nearbyZoneIds.filter((id) => id !== primaryZoneId),
        trainingExpiryDate,
        isActive,
      },
      personToEdit?.id
    );
    onClose();
  };

  const trainingStatus = getTrainingStatus(trainingExpiryDate);
  const daysLeft = getDaysUntilExpiry(trainingExpiryDate);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="person-modal-title" className="font-display font-bold text-lg text-slate-900">
            {personToEdit ? 'Modifier un membre du personnel' : 'Ajouter un membre du personnel'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nom et Prénom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                NOM (majuscules) *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value.toUpperCase())}
                placeholder="ex. MOREAU"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg uppercase font-semibold focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Prénom *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="ex. Thomas"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                required
              />
            </div>
          </div>

          {/* Numéro interne et Zone principale */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Numéro interne (4 chiffres) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono-num font-bold text-slate-500">
                  N°
                </span>
                <input
                  type="text"
                  value={internalNumber}
                  onChange={(e) => setInternalNumber(e.target.value)}
                  placeholder="7947 ou 7974/7311"
                  maxLength={11}
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Format strict : 4 chiffres (ou 2 numéros séparés par /).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Zone principale *
              </label>
              <select
                value={primaryZoneId}
                onChange={(e) => {
                  const newZoneId = e.target.value;
                  setPrimaryZoneId(newZoneId);
                  setNearbyZoneIds((prev) => prev.filter((id) => id !== newZoneId));
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rôles */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Rôles de sécurité *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_ROLES.map((role) => {
                const checked = roles.includes(role);
                return (
                  <label
                    key={role}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'border-slate-900 bg-slate-50 text-slate-900 font-medium'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(role)}
                      className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
                    />
                    <span>{ROLE_LABELS[role]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Date de validité formation + Actif */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fin de validité / Recyclage formation
              </label>
              <input
                type="date"
                value={trainingExpiryDate}
                onChange={(e) => setTrainingExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
              {trainingStatus === 'expired' && (
                <p className="text-xs text-red-700 font-medium mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Formation expirée : masqué automatiquement de l&apos;affiche.
                </p>
              )}
              {trainingStatus === 'expiring_soon' && daysLeft !== null && (
                <p className="text-xs text-amber-700 font-medium mt-1.5">
                  Renouvellement proche ({daysLeft} jour{daysLeft > 1 ? 's' : ''}).
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Statut d&apos;affichage
              </label>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  isActive
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-slate-300 bg-slate-100 text-slate-700'
                }`}
              >
                <span>{isActive ? 'Actif (affiché si valide)' : 'Désactivé (masqué)'}</span>
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center ${
                    isActive ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white'
                  }`}
                >
                  {isActive ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </span>
              </button>
            </div>
          </div>

          {/* Proximité spécifique */}
          {zones.length > 1 && (
            <div className="pt-1 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Apparaître aussi en « PROCHE DE LA ZONE » pour (optionnel)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                La proximité configurée au niveau des zones s&apos;applique déjà automatiquement.
              </p>
              <div className="flex flex-wrap gap-2">
                {zones
                  .filter((z) => z.id !== primaryZoneId)
                  .map((z) => {
                    const checked = nearbyZoneIds.includes(z.id);
                    return (
                      <label
                        key={z.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'border-slate-800 bg-slate-100 text-slate-900 font-medium'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleNearbyZone(z.id)}
                          className="w-3.5 h-3.5 accent-slate-900 cursor-pointer"
                        />
                        <span>{z.name}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {personToEdit ? 'Enregistrer les modifications' : 'Ajouter à l’annuaire'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
