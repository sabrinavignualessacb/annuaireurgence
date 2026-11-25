import React, { useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, PhoneCall } from 'lucide-react';
import { CONFIDENTIALITY_NOTICE, Person, PosterSettings, Zone } from '../types';
import { getNearbyDisplayZoneName, PosterColumnsData } from '../utils/posterLogic';
import {
  EpiPictogram,
  EvacuationPictogram,
  RoleLetterBadge,
  SstPictogram,
} from './SafetyPictograms';

interface EmergencyPosterProps {
  activeZone: Zone | undefined;
  columns: PosterColumnsData;
  zonesById: Map<string, Zone>;
  settings: PosterSettings;
  onRequestLogoUpload?: () => void;
}

type PriorityTier = 'primary' | 'nearby' | 'site';

interface PersonRowProps {
  person: Person;
  zoneLabel?: string;
  accentColor: 'green' | 'red' | 'orange' | 'yellow';
  tier?: PriorityTier;
  zoneScale?: number;
  siteFontSize?: number;
  sitePadY?: number;
}

const PersonRow: React.FC<PersonRowProps> = ({
  person,
  zoneLabel,
  accentColor,
  tier = 'primary',
  zoneScale = 1.15,
  siteFontSize = 10,
  sitePadY = 2,
}) => {
  const numColorMap = {
    green: 'text-[#006B39]',
    red: 'text-[#B91C1C]',
    orange: 'text-[#C2410C]',
    yellow: 'text-[#A16207]',
  };

  const isPrimary = tier === 'primary';
  const isNearby = tier === 'nearby';
  const isSite = tier === 'site';

  const primaryLastPx = Math.round(12.5 * zoneScale * 10) / 10;
  const primaryFirstPx = Math.round(12 * zoneScale * 10) / 10;
  const primaryNumPx = Math.round(12.5 * zoneScale * 10) / 10;
  const primaryPadY = Math.round(4.5 * zoneScale * 10) / 10;

  return (
    <div
      style={
        isPrimary
          ? { paddingTop: `${primaryPadY}px`, paddingBottom: `${primaryPadY}px` }
          : isSite
          ? { paddingTop: `${sitePadY}px`, paddingBottom: `${sitePadY}px` }
          : undefined
      }
      className={`flex items-baseline justify-between gap-2 border-b last:border-b-0 ${
        isPrimary
          ? 'border-slate-300/80'
          : isNearby
          ? 'py-[3px] border-slate-200/70'
          : 'border-slate-200/50'
      }`}
    >
      <div
        className={`min-w-0 flex-1 flex items-baseline gap-1.5 ${
          isSite ? 'flex-nowrap overflow-hidden whitespace-nowrap' : 'flex-wrap'
        }`}
      >
        <span
          style={
            isPrimary
              ? { fontSize: `${primaryLastPx}px` }
              : isSite
              ? { fontSize: `${siteFontSize}px`, lineHeight: 1.18 }
              : undefined
          }
          className={`font-display uppercase leading-tight tracking-tight ${
            isPrimary
              ? 'font-extrabold text-slate-950'
              : isNearby
              ? 'font-bold text-slate-800 text-[11px]'
              : 'font-semibold text-slate-700 shrink-0'
          }`}
        >
          {person.lastName}
        </span>
        <span
          style={
            isPrimary
              ? { fontSize: `${primaryFirstPx}px` }
              : isSite
              ? { fontSize: `${Math.max(5.5, siteFontSize - 0.5)}px`, lineHeight: 1.18 }
              : undefined
          }
          className={`leading-tight ${
            isPrimary
              ? 'font-semibold text-slate-900'
              : isNearby
              ? 'font-medium text-slate-700 text-[10.5px]'
              : 'font-normal text-slate-600 shrink-0'
          }`}
        >
          {person.firstName}
        </span>
        {zoneLabel && (
          <span
            style={
              isSite
                ? { fontSize: `${Math.max(5, siteFontSize - 1.5)}px`, lineHeight: 1.18 }
                : undefined
            }
            className={`font-medium truncate min-w-0 ${
              isSite ? 'text-slate-400' : 'text-[9px] text-slate-500'
            }`}
          >
            ({zoneLabel})
          </span>
        )}
      </div>
      <span
        style={
          isPrimary
            ? { fontSize: `${primaryNumPx}px` }
            : isSite
            ? { fontSize: `${siteFontSize}px`, lineHeight: 1.18 }
            : undefined
        }
        className={`font-mono-num leading-tight shrink-0 whitespace-nowrap ${
          numColorMap[accentColor]
        } ${
          isPrimary
            ? 'font-extrabold'
            : isNearby
            ? 'font-bold text-[11px]'
            : 'font-semibold'
        }`}
      >
        N° {person.internalNumber}
      </span>
    </div>
  );
};

const EmptySectionNotice: React.FC<{ label?: string }> = ({
  label = 'Aucun personnel affecté',
}) => <p className="text-[11px] italic text-slate-400 py-1.5">{label}</p>;

export const EmergencyPoster: React.FC<EmergencyPosterProps> = ({
  activeZone,
  columns,
  zonesById,
  settings,
  onRequestLogoUpload,
}) => {
  const activeZoneName = activeZone ? activeZone.name : 'ZONE NON DÉFINIE';
  const headerHeight = settings.headerHeightPx ?? 68;
  const headerTitleSize = Math.round(Math.min(56, Math.max(26, headerHeight * 0.48)));
  const zoneScale = settings.zoneScale ?? 1.15;
  const zoneBannerFontSize = Math.round(14 * zoneScale * 10) / 10;
  const zoneBannerPadY = Math.round(5 * zoneScale * 10) / 10;
  const companyLogoSizePx = settings.companyLogoSizePx ?? 54;
  const pictogramSizePx = settings.pictogramSizePx ?? 44;
  const roleBadgeSizePx = settings.roleBadgeSizePx ?? 24;

  const siteListContainerRef = useRef<HTMLDivElement>(null);
  const epiSiteListContainerRef = useRef<HTMLDivElement>(null);
  const [siteDensity, setSiteDensity] = useState<{ fontSize: number; padY: number }>({
    fontSize: 10,
    padY: 2,
  });
  const [epiSiteDensity, setEpiSiteDensity] = useState<{ fontSize: number; padY: number }>({
    fontSize: 10,
    padY: 2,
  });

  useLayoutEffect(() => {
    const computeDensity = (
      container: HTMLDivElement | null,
      count: number,
      setter: React.Dispatch<React.SetStateAction<{ fontSize: number; padY: number }>>
    ) => {
      if (!container || count === 0) {
        setter((prev) =>
          prev.fontSize === 10 && prev.padY === 2 ? prev : { fontSize: 10, padY: 2 }
        );
        return;
      }

      const availableHeight = container.clientHeight;
      if (availableHeight <= 0) return;

      const borderPerRow = count > 1 ? (count - 1) / count : 0;
      const targetPerRow = availableHeight / count;
      const maxTextAndPad = targetPerRow - borderPerRow;

      let nextFontSize = 10;
      let nextPadY = 2;

      if (maxTextAndPad < 15.8) {
        nextPadY = maxTextAndPad >= 13 ? 1 : maxTextAndPad >= 10.5 ? 0.5 : 0;
        const computedFont = Math.floor(((maxTextAndPad - nextPadY * 2) / 1.18) * 10) / 10;
        nextFontSize = Math.max(5.5, Math.min(10, computedFont));
      }

      setter((prev) =>
        prev.fontSize === nextFontSize && prev.padY === nextPadY
          ? prev
          : { fontSize: nextFontSize, padY: nextPadY }
      );
    };

    const updateAll = () => {
      computeDensity(siteListContainerRef.current, columns.sstSite.length, setSiteDensity);
      computeDensity(epiSiteListContainerRef.current, columns.epiSite.length, setEpiSiteDensity);
    };

    updateAll();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateAll);
    if (siteListContainerRef.current) observer.observe(siteListContainerRef.current);
    if (epiSiteListContainerRef.current) observer.observe(epiSiteListContainerRef.current);
    return () => observer.disconnect();
  }, [
    columns.sstSite.length,
    columns.sstZone.length,
    columns.sstNearby.length,
    columns.epiSite.length,
    columns.epiZone.length,
    columns.epiNearby.length,
    zoneScale,
    headerHeight,
  ]);

  return (
    <div
      className="poster-sheet bg-white text-slate-900 flex flex-col justify-between shadow-xl border-x-[12px] border-[#D91E18] overflow-hidden select-none"
      style={{
        width: '1188px',
        height: '840px', // Ratio exact A3 paysage (420 / 297 = 1.4141)
      }}
    >
      {/* 1. Bandeau supérieur rouge vif (hauteur paramétrable, titre centré uniquement) */}
      <header
        style={{ height: `${headerHeight}px` }}
        className="bg-[#D91E18] text-white px-6 flex items-center justify-center shrink-0"
      >
        <h1
          style={{ fontSize: `${headerTitleSize}px` }}
          className="font-display font-extrabold leading-none tracking-[0.07em] uppercase text-center"
        >
          ANNUAIRE D&apos;URGENCE
        </h1>
      </header>

      {/* 2. Corps principal : 3 colonnes */}
      <main className="flex-1 min-h-0 px-3 pt-2.5 pb-1.5 grid grid-cols-3 gap-3">
        {/* COLONNE GAUCHE : S.S.T (encadré vert) */}
        <section className="border-[2.5px] border-[#008749] rounded-md flex flex-col min-h-0 bg-white overflow-hidden">
          {/* En-tête SST — hauteur fixe h-[78px] alignée avec EPI et Évacuation */}
          <div className="h-[78px] bg-[#ECFDF3] border-b-2 border-[#008749] px-3 flex items-center gap-2.5 shrink-0">
            <SstPictogram
              sizePx={pictogramSizePx}
              customLogoUrl={settings.sstLogoDataUrl}
            />
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-[15px] text-[#006B39] leading-tight tracking-tight">
                S.S.T
              </h2>
              <p className="text-[10.5px] text-slate-700 leading-snug font-medium mt-0.5">
                Ils connaissent les gestes premiers secours en cas d&apos;accident...
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col divide-y divide-[#008749]/25 overflow-hidden">
            {/* Bloc 1 : Zone active — MIS EN ÉVIDENCE PRIORITAIRE */}
            <div className="px-3 pt-2 pb-2 bg-[#DCFCE7]/80 border-b-2 border-[#008749]/50 flex-shrink-0">
              <div
                style={{
                  fontSize: `${zoneBannerFontSize}px`,
                  paddingTop: `${zoneBannerPadY}px`,
                  paddingBottom: `${zoneBannerPadY}px`,
                }}
                className="bg-[#008749] text-white font-display font-extrabold uppercase tracking-wider px-3 rounded-sm mb-1.5 text-center shadow-xs leading-tight"
              >
                {activeZoneName}
              </div>
              {columns.sstZone.length > 0 ? (
                <div>
                  {columns.sstZone.map((p) => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      accentColor="green"
                      tier="primary"
                      zoneScale={zoneScale}
                    />
                  ))}
                </div>
              ) : (
                <EmptySectionNotice label="Aucun S.S.T dans cette zone" />
              )}
            </div>

            {/* Bloc 2 : PROCHE DE LA ZONE — Transparence intermédiaire */}
            <div className="px-3 py-1.5 flex-shrink-0">
              <div
                style={{ fontSize: `${zoneBannerFontSize}px` }}
                className="text-[#008749] font-display font-extrabold uppercase tracking-wider text-center leading-tight py-0.5 mb-1"
              >
                PROCHE DE LA ZONE
              </div>
              <div className="opacity-65">
                {columns.sstNearby.length > 0 ? (
                  <div>
                    {columns.sstNearby.map((p) => (
                      <PersonRow
                        key={p.id}
                        person={p}
                        zoneLabel={getNearbyDisplayZoneName(p, activeZone, zonesById)}
                        accentColor="green"
                        tier="nearby"
                      />
                    ))}
                  </div>
                ) : (
                  <EmptySectionNotice label="Aucun S.S.T à proximité" />
                )}
              </div>
            </div>

            {/* Bloc 3 : SITE — Plus grande transparence */}
            <div className="px-3 py-1.5 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div
                style={{ fontSize: `${zoneBannerFontSize}px` }}
                className="text-slate-400 font-display font-extrabold uppercase tracking-wider text-center leading-tight py-0.5 mb-1 shrink-0"
              >
                SITE
              </div>
              <div
                ref={siteListContainerRef}
                className="flex-1 min-h-0 overflow-hidden opacity-45"
              >
                {columns.sstSite.length > 0 ? (
                  <div className="flex flex-col">
                    {columns.sstSite.map((p) => (
                      <PersonRow
                        key={p.id}
                        person={p}
                        zoneLabel={zonesById.get(p.primaryZoneId)?.name}
                        accentColor="green"
                        tier="site"
                        siteFontSize={siteDensity.fontSize}
                        sitePadY={siteDensity.padY}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptySectionNotice label="Aucun autre S.S.T actif sur site" />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* COLONNE CENTRALE : ÉQUIPIERS DE PREMIÈRE INTERVENTION (encadré rouge) */}
        <section className="border-[2.5px] border-[#D91E18] rounded-md flex flex-col min-h-0 bg-white overflow-hidden">
          {/* En-tête EPI — hauteur fixe h-[78px] alignée avec SST et Évacuation */}
          <div className="h-[78px] bg-[#FEF2F2] border-b-2 border-[#D91E18] px-3 flex items-center gap-2.5 shrink-0">
            <EpiPictogram
              sizePx={pictogramSizePx}
              customLogoUrl={settings.epiLogoDataUrl}
            />
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-[13.5px] text-[#B91C1C] leading-[1.15] uppercase tracking-tight">
                ÉQUIPIERS DE PREMIÈRE INTERVENTION
              </h2>
              <p className="text-[10px] text-slate-700 leading-tight font-medium mt-0.5">
                Lutte contre le début d&apos;incendie et mise en sécurité...
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col divide-y divide-[#D91E18]/25 overflow-hidden">
            {/* Bloc 1 : Zone active — MIS EN ÉVIDENCE PRIORITAIRE */}
            <div className="px-3 pt-2 pb-2 bg-[#FEE2E2]/70 border-b-2 border-[#D91E18]/50 flex-shrink-0">
              <div
                style={{
                  fontSize: `${zoneBannerFontSize}px`,
                  paddingTop: `${zoneBannerPadY}px`,
                  paddingBottom: `${zoneBannerPadY}px`,
                }}
                className="bg-[#D91E18] text-white font-display font-extrabold uppercase tracking-wider px-3 rounded-sm mb-1.5 text-center shadow-xs leading-tight"
              >
                {activeZoneName}
              </div>
              {columns.epiZone.length > 0 ? (
                <div>
                  {columns.epiZone.map((p) => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      accentColor="red"
                      tier="primary"
                      zoneScale={zoneScale}
                    />
                  ))}
                </div>
              ) : (
                <EmptySectionNotice label="Aucun E.P.I dans cette zone" />
              )}
            </div>

            {/* Bloc 2 : PROCHE DE LA ZONE — Transparence intermédiaire */}
            <div
              className={
                columns.epiSite.length > 0
                  ? 'px-3 py-1.5 flex-shrink-0'
                  : 'px-3 py-2 flex-1 min-h-0 overflow-hidden'
              }
            >
              <div
                style={{ fontSize: `${zoneBannerFontSize}px` }}
                className="text-[#D91E18] font-display font-extrabold uppercase tracking-wider text-center leading-tight py-0.5 mb-1"
              >
                PROCHE DE LA ZONE
              </div>
              <div className="opacity-65">
                {columns.epiNearby.length > 0 ? (
                  <div>
                    {columns.epiNearby.map((p) => (
                      <PersonRow
                        key={p.id}
                        person={p}
                        zoneLabel={getNearbyDisplayZoneName(p, activeZone, zonesById)}
                        accentColor="red"
                        tier="nearby"
                      />
                    ))}
                  </div>
                ) : (
                  <EmptySectionNotice label="Aucun E.P.I à proximité" />
                )}
              </div>
            </div>

            {/* Bloc 3 : SITE (personnes choisies) — Plus grande transparence */}
            {columns.epiSite.length > 0 && (
              <div className="px-3 py-1.5 flex-1 min-h-0 flex flex-col overflow-hidden">
                <div
                  style={{ fontSize: `${zoneBannerFontSize}px` }}
                  className="text-slate-400 font-display font-extrabold uppercase tracking-wider text-center leading-tight py-0.5 mb-1 shrink-0"
                >
                  SITE
                </div>
                <div
                  ref={epiSiteListContainerRef}
                  className="flex-1 min-h-0 overflow-hidden opacity-45"
                >
                  <div className="flex flex-col">
                    {columns.epiSite.map((p) => (
                      <PersonRow
                        key={p.id}
                        person={p}
                        zoneLabel={zonesById.get(p.primaryZoneId)?.name}
                        accentColor="red"
                        tier="site"
                        siteFontSize={epiSiteDensity.fontSize}
                        sitePadY={epiSiteDensity.padY}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* COLONNE DROITE : ÉVACUATION SECOURS (encadré vert, Serre-file Orange / Guide Jaune) */}
        <section className="border-[2.5px] border-[#008749] rounded-md flex flex-col min-h-0 bg-white overflow-hidden">
          {/* En-tête Évacuation — hauteur fixe h-[78px] alignée avec SST et EPI */}
          <div className="h-[78px] bg-[#ECFDF3] border-b-2 border-[#008749] px-3 flex items-center gap-2.5 shrink-0">
            <EvacuationPictogram
              sizePx={pictogramSizePx}
              customLogoUrl={settings.evacuationLogoDataUrl}
            />
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-[15px] text-[#006B39] leading-tight uppercase tracking-tight">
                ÉVACUATION SECOURS
              </h2>
              <p className="text-[10.5px] text-slate-700 leading-snug font-medium mt-0.5">
                Coordination de l&apos;évacuation vers le point de rassemblement...
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 px-3 pt-2 pb-2 flex flex-col overflow-hidden gap-2.5">
            {/* Bandeau Zone Active mis en évidence et aligné avec les autres colonnes */}
            <div
              style={{
                fontSize: `${zoneBannerFontSize}px`,
                paddingTop: `${zoneBannerPadY}px`,
                paddingBottom: `${zoneBannerPadY}px`,
              }}
              className="bg-[#008749] text-white font-display font-extrabold uppercase tracking-wider px-3 rounded-sm shadow-xs shrink-0 text-center leading-tight"
            >
              {activeZoneName}
            </div>

            {/* Sous-bloc SERRE-FILE (Couleur ORANGE) */}
            <div className="flex-1 min-h-0 overflow-hidden rounded-md border-[1.5px] border-[#EA580C] bg-[#FFF7ED]/70 px-2.5 py-2">
              <div className="flex items-center gap-2 pb-1.5 mb-1.5 border-b border-[#EA580C]/40">
                <RoleLetterBadge
                  letter="S"
                  sizePx={roleBadgeSizePx}
                  customLogoUrl={settings.serreFileLogoDataUrl}
                />
                <h3 className="font-display font-extrabold text-[13px] text-[#C2410C] uppercase tracking-wide">
                  SERRE-FILE
                </h3>
              </div>
              {columns.evacSerreFile.length > 0 ? (
                <div>
                  {columns.evacSerreFile.map((p) => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      accentColor="orange"
                      tier="primary"
                      zoneScale={zoneScale}
                    />
                  ))}
                </div>
              ) : (
                <EmptySectionNotice label="Aucun serre-file dans cette zone" />
              )}
            </div>

            {/* Sous-bloc GUIDE D'ÉVACUATION (Couleur JAUNE) */}
            <div className="flex-1 min-h-0 overflow-hidden rounded-md border-[1.5px] border-[#CA8A04] bg-[#FEFCE8]/85 px-2.5 py-2">
              <div className="flex items-center gap-2 pb-1.5 mb-1.5 border-b border-[#CA8A04]/45">
                <RoleLetterBadge
                  letter="G"
                  sizePx={roleBadgeSizePx}
                  customLogoUrl={settings.guideLogoDataUrl}
                />
                <h3 className="font-display font-extrabold text-[13px] text-[#A16207] uppercase tracking-wide">
                  GUIDE D&apos;ÉVACUATION
                </h3>
              </div>
              {columns.evacGuide.length > 0 ? (
                <div>
                  {columns.evacGuide.map((p) => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      accentColor="yellow"
                      tier="primary"
                      zoneScale={zoneScale}
                    />
                  ))}
                </div>
              ) : (
                <EmptySectionNotice label="Aucun guide d'évacuation dans cette zone" />
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 3. Zone inférieure : 2 encadrés/formes d'appel d'urgence + Logo entreprise */}
      <section className="px-3 pb-2 pt-2 grid grid-cols-3 gap-3 items-stretch shrink-0">
        {settings.emergencyBoxShape === 'stacked' ? (
          <div className="col-span-2 flex flex-col gap-1.5 justify-center">
            {/* Bandeau empilé vert SST */}
            <div className="border-[2px] border-[#008749] bg-[#ECFDF3] rounded-full px-4 py-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#008749] text-white flex items-center justify-center shrink-0">
                  <PhoneCall className="w-3.5 h-3.5" />
                </div>
                <p className="text-[10.5px] font-semibold text-slate-800 truncate">
                  En l&apos;absence de S.S.T sur site, composez les numéros d&apos;urgence ci-dessous :
                </p>
              </div>
              <div className="flex items-center gap-2 font-display font-extrabold text-[11.5px] text-[#006B39] shrink-0 whitespace-nowrap">
                <span>
                  SAMU : <span className="font-mono-num text-[12.5px]">15</span>
                </span>
                <span className="text-slate-400">/</span>
                <span>
                  POMPIERS : <span className="font-mono-num text-[12.5px]">18</span>
                </span>
                <span className="text-slate-400">/</span>
                <span>
                  URGENCE EUROPÉEN : <span className="font-mono-num text-[12.5px]">112</span>
                </span>
              </div>
            </div>

            {/* Bandeau empilé rouge EPI */}
            <div className="border-[2px] border-[#D91E18] bg-[#FEF2F2] rounded-full px-4 py-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#D91E18] text-white flex items-center justify-center shrink-0">
                  <PhoneCall className="w-3.5 h-3.5" />
                </div>
                <p className="text-[10.5px] font-semibold text-slate-800 truncate">
                  En l&apos;absence d&apos;E.P.I sur site, composez les numéros d&apos;urgence ci-dessous :
                </p>
              </div>
              <div className="flex items-center gap-2 font-display font-extrabold text-[11.5px] text-[#B91C1C] shrink-0 whitespace-nowrap">
                <span>
                  POMPIERS : <span className="font-mono-num text-[12.5px]">18</span>
                </span>
                <span className="text-slate-400">/</span>
                <span>
                  URGENCE EUROPÉEN : <span className="font-mono-num text-[12.5px]">112</span>
                </span>
              </div>
            </div>
          </div>
        ) : settings.emergencyBoxShape === 'chamfer' ? (
          <>
            {/* Panneau biseauté vert SST */}
            <div
              className="bg-[#008749] p-[2px] flex"
              style={{
                clipPath:
                  'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
              }}
            >
              <div
                className="flex-1 bg-[#ECFDF3] px-4 py-2 flex items-center gap-2.5"
                style={{
                  clipPath:
                    'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                }}
              >
                <div className="w-8 h-8 rounded-full bg-[#008749] text-white flex items-center justify-center shrink-0">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-800 leading-tight">
                    En l&apos;absence de S.S.T sur site, composez les numéros d&apos;urgence ci-dessous :
                  </p>
                  <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 font-display font-extrabold text-[11px] text-[#006B39]">
                    <span>
                      SAMU : <span className="font-mono-num text-[12px]">15</span>
                    </span>
                    <span className="text-slate-400">/</span>
                    <span>
                      POMPIERS : <span className="font-mono-num text-[12px]">18</span>
                    </span>
                    <span className="text-slate-400">/</span>
                    <span>
                      URGENCE EUROPÉEN : <span className="font-mono-num text-[12px]">112</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panneau biseauté rouge EPI */}
            <div
              className="bg-[#D91E18] p-[2px] flex"
              style={{
                clipPath:
                  'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
              }}
            >
              <div
                className="flex-1 bg-[#FEF2F2] px-4 py-2 flex items-center gap-2.5"
                style={{
                  clipPath:
                    'polygon(13px 0, calc(100% - 13px) 0, 100% 13px, 100% calc(100% - 13px), calc(100% - 13px) 100%, 13px 100%, 0 calc(100% - 13px), 0 13px)',
                }}
              >
                <div className="w-8 h-8 rounded-full bg-[#D91E18] text-white flex items-center justify-center shrink-0">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-800 leading-tight">
                    En l&apos;absence d&apos;E.P.I sur site, composez les numéros d&apos;urgence ci-dessous :
                  </p>
                  <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 font-display font-extrabold text-[11px] text-[#B91C1C]">
                    <span>
                      POMPIERS : <span className="font-mono-num text-[12px]">18</span>
                    </span>
                    <span className="text-slate-400">/</span>
                    <span>
                      URGENCE EUROPÉEN : <span className="font-mono-num text-[12px]">112</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Forme asymétrique (rectangulaire à gauche, arrondie à droite) ou Encadré classique ('rounded') vert SST */}
            <div
              className={`border-[2px] border-[#008749] bg-[#ECFDF3] py-2 flex items-center gap-2.5 ${
                settings.emergencyBoxShape === 'rounded'
                  ? 'rounded-xl px-4'
                  : 'rounded-l-none rounded-r-full pl-3.5 pr-6'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#008749] text-white flex items-center justify-center shrink-0">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-slate-800 leading-tight">
                  En l&apos;absence de S.S.T sur site, composez les numéros d&apos;urgence ci-dessous :
                </p>
                <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 font-display font-extrabold text-[11px] text-[#006B39]">
                  <span>
                    SAMU : <span className="font-mono-num text-[12px]">15</span>
                  </span>
                  <span className="text-slate-400">/</span>
                  <span>
                    POMPIERS : <span className="font-mono-num text-[12px]">18</span>
                  </span>
                  <span className="text-slate-400">/</span>
                  <span>
                    URGENCE EUROPÉEN : <span className="font-mono-num text-[12px]">112</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Forme asymétrique (arrondie à gauche, rectangulaire à droite) ou Encadré classique ('rounded') rouge EPI */}
            <div
              className={`border-[2px] border-[#D91E18] bg-[#FEF2F2] py-2 flex items-center gap-2.5 ${
                settings.emergencyBoxShape === 'rounded'
                  ? 'rounded-xl px-4'
                  : 'rounded-l-full rounded-r-none pl-5 pr-3.5'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#D91E18] text-white flex items-center justify-center shrink-0">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-slate-800 leading-tight">
                  En l&apos;absence d&apos;E.P.I sur site, composez les numéros d&apos;urgence ci-dessous :
                </p>
                <div className="mt-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 font-display font-extrabold text-[11px] text-[#B91C1C]">
                  <span>
                    POMPIERS : <span className="font-mono-num text-[12px]">18</span>
                  </span>
                  <span className="text-slate-400">/</span>
                  <span>
                    URGENCE EUROPÉEN : <span className="font-mono-num text-[12px]">112</span>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Emplacement logo entreprise sous la colonne Évacuation */}
        <div className="border border-slate-300 rounded-xl bg-white px-3 py-1.5 flex items-center justify-center relative group overflow-hidden">
          {settings.companyLogoDataUrl ? (
            <img
              src={settings.companyLogoDataUrl}
              alt={settings.companyName || 'Logo entreprise'}
              style={{ height: `${companyLogoSizePx}px`, width: 'auto', maxWidth: '100%' }}
              className="object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-center">
              <p className="font-display font-extrabold text-[14px] tracking-wider text-slate-700 uppercase">
                {settings.companyName || 'LOGO ENTREPRISE'}
              </p>
              <p className="no-print text-[10px] text-slate-400 mt-0.5">
                Emplacement logo (ex. Cordon Group)
              </p>
            </div>
          )}

          {onRequestLogoUpload && (
            <button
              type="button"
              onClick={onRequestLogoUpload}
              className="no-print absolute inset-0 bg-slate-900/65 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Importer ou modifier le logo de l'entreprise"
            >
              <ImagePlus className="w-4 h-4" />
              <span>{settings.companyLogoDataUrl ? 'Changer le logo' : 'Importer un logo'}</span>
            </button>
          )}
        </div>
      </section>

      {/* 4. Bandeau de pied de page rouge obligatoire */}
      <footer className="bg-[#D91E18] text-white px-4 py-2 flex items-center justify-between gap-4 shrink-0">
        <p className="text-[12px] font-semibold tracking-wide whitespace-nowrap">
          {CONFIDENTIALITY_NOTICE}
        </p>
        <p className="text-[12px] font-bold font-mono-num whitespace-nowrap">
          Mise à jour : {settings.lastUpdatedDate}
        </p>
      </footer>
    </div>
  );
};
