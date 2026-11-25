import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ImagePlus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { CONFIDENTIALITY_NOTICE, PosterSettings } from '../types';
import { compressLogoFileToDataUrl } from '../utils/imageCompress';
import { getTodayFrenchDate } from '../utils/validation';
import {
  EpiPictogram,
  EvacuationPictogram,
  RoleLetterBadge,
  SstPictogram,
} from './SafetyPictograms';

type RoleLogoKey =
  | 'sstLogoDataUrl'
  | 'epiLogoDataUrl'
  | 'evacuationLogoDataUrl'
  | 'serreFileLogoDataUrl'
  | 'guideLogoDataUrl';

interface SettingsPanelProps {
  settings: PosterSettings;
  onUpdateSettings: (partial: Partial<PosterSettings>) => void;
  onExportJson: () => void;
  onImportJson: (file: File) => Promise<void>;
  onImportSpreadsheet: (file: File) => Promise<{
    added: number;
    zonesCreated: number;
    skipped: number;
    warnings: string[];
  }>;
  onDownloadCsvTemplate: () => void;
  onResetDemoData: () => void;
  cloudSyncSlot?: React.ReactNode;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onExportJson,
  onImportJson,
  onImportSpreadsheet,
  onDownloadCsvTemplate,
  onResetDemoData,
  cloudSyncSlot,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const roleLogoInputRef = useRef<HTMLInputElement>(null);
  const activeRoleLogoKeyRef = useRef<RoleLogoKey | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string[];
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressLogoFileToDataUrl(file, {
        maxWidth: 600,
        maxHeight: 240,
        maxChars: 350000,
      });
      onUpdateSettings({ companyLogoDataUrl: compressed });
      setFeedback({ type: 'success', message: 'Logo entreprise mis à jour.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors du chargement du logo.',
      });
    }
    e.target.value = '';
  };

  const handleRoleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetKey = activeRoleLogoKeyRef.current;
    if (!file || !targetKey) return;
    try {
      const compressed = await compressLogoFileToDataUrl(file, {
        maxWidth: 220,
        maxHeight: 220,
        maxChars: 90000,
      });
      onUpdateSettings({ [targetKey]: compressed } as Partial<PosterSettings>);
      setFeedback({ type: 'success', message: 'Pictogramme mis à jour sur l’affiche.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors du chargement du pictogramme.',
      });
    }
    e.target.value = '';
  };

  const triggerRoleLogoUpload = (key: RoleLogoKey) => {
    activeRoleLogoKeyRef.current = key;
    roleLogoInputRef.current?.click();
  };

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onImportJson(file);
      setFeedback({
        type: 'success',
        message: 'Sauvegarde JSON importée avec succès.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors de l’import JSON.',
      });
    }
    e.target.value = '';
  };

  const handleSpreadsheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await onImportSpreadsheet(file);
      setFeedback({
        type: res.added > 0 ? 'success' : 'error',
        message: `${res.added} personne(s) importée(s), ${res.zonesCreated} zone(s) créée(s), ${res.skipped} ligne(s) ignorée(s).`,
        details: res.warnings.slice(0, 6),
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erreur lors de l’import CSV/Excel.',
      });
    }
    e.target.value = '';
  };

  const roleLogoItems: {
    key: RoleLogoKey;
    label: string;
    subtitle: string;
    preview: React.ReactNode;
  }[] = [
    {
      key: 'sstLogoDataUrl',
      label: 'S.S.T',
      subtitle: 'En-tête colonne gauche',
      preview: (
        <SstPictogram
          sizePx={40}
          customLogoUrl={settings.sstLogoDataUrl}
        />
      ),
    },
    {
      key: 'epiLogoDataUrl',
      label: 'E.P.I',
      subtitle: 'En-tête colonne centrale',
      preview: (
        <EpiPictogram
          sizePx={40}
          customLogoUrl={settings.epiLogoDataUrl}
        />
      ),
    },
    {
      key: 'evacuationLogoDataUrl',
      label: 'Évacuation Secours',
      subtitle: 'En-tête colonne droite',
      preview: (
        <EvacuationPictogram
          sizePx={40}
          customLogoUrl={settings.evacuationLogoDataUrl}
        />
      ),
    },
    {
      key: 'serreFileLogoDataUrl',
      label: 'Serre-file',
      subtitle: 'Sous-bloc orange',
      preview: (
        <RoleLetterBadge
          letter="S"
          sizePx={32}
          customLogoUrl={settings.serreFileLogoDataUrl}
        />
      ),
    },
    {
      key: 'guideLogoDataUrl',
      label: "Guide d'évacuation",
      subtitle: 'Sous-bloc jaune',
      preview: (
        <RoleLetterBadge
          letter="G"
          sizePx={32}
          customLogoUrl={settings.guideLogoDataUrl}
        />
      ),
    },
  ];

  const hasCustomRoleLogos = Boolean(
    settings.sstLogoDataUrl ||
      settings.epiLogoDataUrl ||
      settings.evacuationLogoDataUrl ||
      settings.serreFileLogoDataUrl ||
      settings.guideLogoDataUrl
  );

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-semibold">{feedback.message}</p>
            {feedback.details && feedback.details.length > 0 && (
              <ul className="mt-1.5 text-xs space-y-0.5 list-disc list-inside opacity-90">
                {feedback.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {cloudSyncSlot}

      {/* Dimensions & Mise en évidence de l'affiche */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">
              Dimensions &amp; Mise en évidence de l&apos;affiche A3
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Ajustez la hauteur du bandeau rouge supérieur et la taille de la zone active (ex. SALLE DE PAUSE).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateSettings({ headerHeightPx: 68, zoneScale: 1.15 })}
            className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Valeurs par défaut
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hauteur bandeau rouge Annuaire d'urgence */}
          <div className="space-y-2.5 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="header-height-range"
                className="text-xs font-semibold text-slate-800"
              >
                Zone rouge « ANNUAIRE D&apos;URGENCE »
              </label>
              <span className="font-mono-num text-xs font-bold text-red-700">
                {settings.headerHeightPx ?? 68} px
              </span>
            </div>
            <input
              id="header-height-range"
              type="range"
              min={48}
              max={130}
              step={2}
              value={settings.headerHeightPx ?? 68}
              onChange={(e) =>
                onUpdateSettings({ headerHeightPx: Number(e.target.value) })
              }
              className="w-full accent-[#D91E18] cursor-pointer"
            />
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              {[
                { label: 'Compact (56 px)', val: 56 },
                { label: 'Standard (68 px)', val: 68 },
                { label: 'Grand (92 px)', val: 92 },
                { label: 'Très grand (116 px)', val: 116 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => onUpdateSettings({ headerHeightPx: preset.val })}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                    (settings.headerHeightPx ?? 68) === preset.val
                      ? 'bg-[#D91E18] text-white border-[#D91E18]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Agrandissement de la zone active */}
          <div className="space-y-2.5 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="zone-scale-range"
                className="text-xs font-semibold text-slate-800"
              >
                Taille de la zone active (bandeau &amp; contacts prioritaires)
              </label>
              <span className="font-mono-num text-xs font-bold text-emerald-700">
                {Math.round((settings.zoneScale ?? 1.15) * 100)}%
              </span>
            </div>
            <input
              id="zone-scale-range"
              type="range"
              min={1}
              max={1.55}
              step={0.05}
              value={settings.zoneScale ?? 1.15}
              onChange={(e) =>
                onUpdateSettings({ zoneScale: Number(e.target.value) })
              }
              className="w-full accent-[#008749] cursor-pointer"
            />
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              {[
                { label: '100%', val: 1.0 },
                { label: '115%', val: 1.15 },
                { label: '130%', val: 1.3 },
                { label: '145%', val: 1.45 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => onUpdateSettings({ zoneScale: preset.val })}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer font-mono-num ${
                    Math.abs((settings.zoneScale ?? 1.15) - preset.val) < 0.01
                      ? 'bg-[#008749] text-white border-[#008749]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Forme des encadrés numéros d'urgence (bas de page) */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-800">
              Forme des encadrés numéros d&apos;urgence (SAMU 15 / POMPIERS 18 / 112)
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(
              [
                {
                  id: 'pills',
                  label: 'Modèle miroir (plat / arrondi)',
                  desc: 'Vert carré à gauche · Rouge carré à droite',
                },
                {
                  id: 'stacked',
                  label: 'Bandeaux empilés',
                  desc: '2 barres superposées à gauche',
                },
                {
                  id: 'rounded',
                  label: 'Encadrés classiques',
                  desc: '2 rectangles à coins doux',
                },
                {
                  id: 'chamfer',
                  label: 'Panneaux biseautés',
                  desc: '2 plaques sécurité à pans coupés',
                },
              ] as const
            ).map((opt) => {
              const active = (settings.emergencyBoxShape || 'pills') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ emergencyBoxShape: opt.id })}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      active ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pictogrammes SST / EPI / Évacuation / Serre-file / Guide & Tailles */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">
              Logos des rôles (SST / EPI / Évacuation / Serre-file / Guide)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Remplacez n&apos;importe quel pictogramme par votre propre visuel (PNG, JPG, SVG) et réglez leur taille.
            </p>
          </div>
          {(hasCustomRoleLogos ||
            (settings.pictogramSizePx ?? 44) !== 44 ||
            (settings.roleBadgeSizePx ?? 24) !== 24) && (
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  sstLogoDataUrl: null,
                  epiLogoDataUrl: null,
                  evacuationLogoDataUrl: null,
                  serreFileLogoDataUrl: null,
                  guideLogoDataUrl: null,
                  pictogramSizePx: 44,
                  roleBadgeSizePx: 24,
                })
              }
              className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Tout remettre par défaut
            </button>
          )}
        </div>

        <input
          ref={roleLogoInputRef}
          type="file"
          accept="image/*"
          onChange={handleRoleLogoChange}
          className="hidden"
        />

        {/* 5 cartes des pictogrammes modifiables */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {roleLogoItems.map((item) => {
            const hasCustom = Boolean(settings[item.key]);
            return (
              <div
                key={item.key}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 p-1">
                    {item.preview}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{item.label}</p>
                    <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => triggerRoleLogoUpload(item.key)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{hasCustom ? 'Changer' : 'Modifier'}</span>
                  </button>
                  {hasCustom && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ [item.key]: null } as Partial<PosterSettings>)
                      }
                      title="Rétablir le pictogramme par défaut"
                      className="p-1.5 text-red-700 border border-red-200 bg-white rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Réglages de grosseur des pictogrammes colonnes & badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          <div className="space-y-2 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="pictogram-size-range"
                className="text-xs font-semibold text-slate-800"
              >
                Grosseur des logos SST / EPI / Évacuation
              </label>
              <span className="font-mono-num text-xs font-bold text-slate-900">
                {settings.pictogramSizePx ?? 44} px
              </span>
            </div>
            <input
              id="pictogram-size-range"
              type="range"
              min={30}
              max={64}
              step={2}
              value={settings.pictogramSizePx ?? 44}
              onChange={(e) =>
                onUpdateSettings({ pictogramSizePx: Number(e.target.value) })
              }
              className="w-full accent-slate-900 cursor-pointer"
            />
          </div>

          <div className="space-y-2 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="role-badge-size-range"
                className="text-xs font-semibold text-slate-800"
              >
                Grosseur des logos Serre-file / Guide
              </label>
              <span className="font-mono-num text-xs font-bold text-slate-900">
                {settings.roleBadgeSizePx ?? 24} px
              </span>
            </div>
            <input
              id="role-badge-size-range"
              type="range"
              min={18}
              max={44}
              step={2}
              value={settings.roleBadgeSizePx ?? 24}
              onChange={(e) =>
                onUpdateSettings({ roleBadgeSizePx: Number(e.target.value) })
              }
              className="w-full accent-slate-900 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Identité de l'affiche & Logo entreprise */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">
              Logo entreprise &amp; Pied de page
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Personnalisez le logo affiché en bas à droite, sa taille et la date de mise à jour.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Logo entreprise (PNG, JPG, SVG)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-44 h-20 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center p-2 overflow-hidden shrink-0">
                {settings.companyLogoDataUrl ? (
                  <img
                    src={settings.companyLogoDataUrl}
                    alt="Aperçu logo"
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Aucun logo importé</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>Importer un logo</span>
                </button>
                {settings.companyLogoDataUrl && (
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ companyLogoDataUrl: null })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Retirer</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grosseur du logo entreprise */}
          <div className="space-y-2 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="company-logo-size-range"
                className="text-xs font-semibold text-slate-800"
              >
                Grosseur du logo entreprise sur l&apos;affiche
              </label>
              <span className="font-mono-num text-xs font-bold text-slate-900">
                {settings.companyLogoSizePx ?? 54} px
              </span>
            </div>
            <input
              id="company-logo-size-range"
              type="range"
              min={28}
              max={84}
              step={2}
              value={settings.companyLogoSizePx ?? 54}
              onChange={(e) =>
                onUpdateSettings({ companyLogoSizePx: Number(e.target.value) })
              }
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              {[
                { label: 'Petit (38 px)', val: 38 },
                { label: 'Standard (54 px)', val: 54 },
                { label: 'Grand (68 px)', val: 68 },
                { label: 'Max (82 px)', val: 82 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => onUpdateSettings({ companyLogoSizePx: preset.val })}
                  className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                    (settings.companyLogoSizePx ?? 54) === preset.val
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nom de l&apos;entreprise (affiché si aucun logo image n&apos;est importé)
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => onUpdateSettings({ companyName: e.target.value })}
              placeholder="ex. CORDON GROUP"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Date de mise à jour (pied de page)
              </label>
              <input
                type="text"
                value={settings.lastUpdatedDate}
                onChange={(e) => onUpdateSettings({ lastUpdatedDate: e.target.value })}
                placeholder="JJ/MM/AAAA"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            <button
              type="button"
              onClick={() => onUpdateSettings({ lastUpdatedDate: getTodayFrenchDate() })}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Date du jour ({getTodayFrenchDate()})
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoUpdateDate}
              onChange={(e) => onUpdateSettings({ autoUpdateDate: e.target.checked })}
              className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
            />
            <span>Actualiser automatiquement la date lors des modifications du personnel/zones</span>
          </label>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Mention réglementaire fixe en pied d&apos;affiche
            </p>
            <p className="text-xs font-semibold text-slate-800 mt-1">{CONFIDENTIALITY_NOTICE}</p>
          </div>
        </div>

        {/* Sauvegarde & Import/Export */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900">
              Sauvegarde &amp; Import / Export
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Vos données sont enregistrées automatiquement dans le navigateur (localStorage).
              Exportez ou importez vos fichiers pour les partager.
            </p>
          </div>

          {/* Export / Import JSON */}
          <div className="p-4 border border-slate-200 rounded-lg space-y-3">
            <h3 className="font-display font-semibold text-sm text-slate-900">
              Sauvegarde complète (JSON)
            </h3>
            <p className="text-xs text-slate-600">
              Inclut toutes les zones, les règles de proximité, le personnel, les logos et les réglages.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Exporter JSON</span>
              </button>

              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleJsonUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Importer JSON</span>
              </button>
            </div>
          </div>

          {/* Import CSV / Excel */}
          <div className="p-4 border border-slate-200 rounded-lg space-y-3">
            <h3 className="font-display font-semibold text-sm text-slate-900">
              Importation depuis Excel ou CSV
            </h3>
            <p className="text-xs text-slate-600">
              Colonnes reconnues : <span className="font-mono-num">NOM</span>,{' '}
              <span className="font-mono-num">Prenom</span>,{' '}
              <span className="font-mono-num">Numero_Interne</span> (4 chiffres),{' '}
              <span className="font-mono-num">Roles</span> (SST;EPI;Guide;Serre-file),{' '}
              <span className="font-mono-num">Zone_Principale</span>,{' '}
              <span className="font-mono-num">Date_Validite_Formation</span>,{' '}
              <span className="font-mono-num">Actif</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleSpreadsheetUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importer CSV / Excel</span>
              </button>

              <button
                type="button"
                onClick={onDownloadCsvTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger modèle CSV</span>
              </button>
            </div>
          </div>

          {/* Réinitialisation */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Données d&apos;exemple</p>
              <p className="text-[11px] text-slate-500">
                Restaure la configuration initiale (SALLE DE PAUSE et exemples).
              </p>
            </div>
            {confirmReset ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemoData();
                    setConfirmReset(false);
                    setFeedback({
                      type: 'success',
                      message: 'Données d’exemple restaurées.',
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
