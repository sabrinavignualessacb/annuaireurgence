import * as XLSX from 'xlsx';
import { AppData, EmergencyRole, Person, Zone } from '../types';
import {
  getTodayFrenchDate,
  isValidInternalNumber,
  normalizeInternalNumber,
} from './validation';

export function exportAppDataToJson(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `annuaire-urgence-${dateTag}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsvTemplate(): void {
  const headers = [
    'NOM',
    'Prenom',
    'Numero_Interne',
    'Roles',
    'Zone_Principale',
    'Date_Validite_Formation',
    'Actif',
  ];
  const sampleRows = [
    ['DUPONT', 'Jean', '7947', 'SST;GUIDE', 'SALLE DE PAUSE', '2027-06-30', 'OUI'],
    ['MARTIN', 'Sophie', '7974/7311', 'EPI;SERRE_FILE', 'BUREAUX R.D.C.', '2027-03-15', 'OUI'],
  ];
  const csvContent = [
    headers.join(';'),
    ...sampleRows.map((row) => row.join(';')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modele-import-annuaire-urgence.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function validateAndParseJsonImport(rawText: string): AppData {
  const parsed = JSON.parse(rawText) as Partial<AppData>;
  if (!parsed || !Array.isArray(parsed.zones) || !Array.isArray(parsed.people)) {
    throw new Error('Structure JSON invalide : champs "zones" et "people" requis.');
  }

  const zones: Zone[] = parsed.zones
    .filter((z) => z && typeof z.name === 'string' && z.name.trim().length > 0)
    .map((z) => ({
      id: String(z.id || `zone-${crypto.randomUUID()}`),
      name: z.name.trim().toUpperCase(),
      nearbyZoneIds: Array.isArray(z.nearbyZoneIds) ? z.nearbyZoneIds.map(String) : [],
    }));

  if (zones.length === 0) {
    throw new Error('Le fichier JSON doit contenir au moins une zone valide.');
  }

  const validZoneIds = new Set(zones.map((z) => z.id));
  const fallbackZoneId = zones[0].id;

  const people: Person[] = parsed.people
    .filter((p) => p && typeof p.lastName === 'string' && typeof p.firstName === 'string')
    .map((p) => ({
      id: String(p.id || `p-${crypto.randomUUID()}`),
      lastName: p.lastName.trim().toUpperCase(),
      firstName: p.firstName.trim(),
      internalNumber: normalizeInternalNumber(String(p.internalNumber || '0000')),
      roles: Array.isArray(p.roles)
        ? p.roles.filter((r): r is EmergencyRole =>
            ['SST', 'EPI', 'GUIDE', 'SERRE_FILE'].includes(r)
          )
        : [],
      primaryZoneId: validZoneIds.has(String(p.primaryZoneId))
        ? String(p.primaryZoneId)
        : fallbackZoneId,
      coveredZoneIds: Array.isArray(p.coveredZoneIds)
        ? p.coveredZoneIds.filter(
            (zid) => validZoneIds.has(String(zid)) && String(zid) !== String(p.primaryZoneId)
          )
        : [],
      nearbyZoneIds: Array.isArray(p.nearbyZoneIds)
        ? p.nearbyZoneIds.filter((zid) => validZoneIds.has(String(zid)))
        : [],
      trainingExpiryDate: typeof p.trainingExpiryDate === 'string' ? p.trainingExpiryDate : '',
      isActive: typeof p.isActive === 'boolean' ? p.isActive : true,
    }));

  return {
    zones,
    people,
    activeZoneId: validZoneIds.has(String(parsed.activeZoneId))
      ? String(parsed.activeZoneId)
      : fallbackZoneId,
    settings: {
      companyLogoDataUrl:
        parsed.settings && typeof parsed.settings.companyLogoDataUrl === 'string'
          ? parsed.settings.companyLogoDataUrl
          : null,
      companyLogoSizePx:
        parsed.settings &&
        typeof parsed.settings.companyLogoSizePx === 'number' &&
        parsed.settings.companyLogoSizePx >= 24 &&
        parsed.settings.companyLogoSizePx <= 96
          ? parsed.settings.companyLogoSizePx
          : 54,
      sstLogoDataUrl:
        parsed.settings && typeof parsed.settings.sstLogoDataUrl === 'string'
          ? parsed.settings.sstLogoDataUrl
          : null,
      epiLogoDataUrl:
        parsed.settings && typeof parsed.settings.epiLogoDataUrl === 'string'
          ? parsed.settings.epiLogoDataUrl
          : null,
      evacuationLogoDataUrl:
        parsed.settings && typeof parsed.settings.evacuationLogoDataUrl === 'string'
          ? parsed.settings.evacuationLogoDataUrl
          : null,
      serreFileLogoDataUrl:
        parsed.settings && typeof parsed.settings.serreFileLogoDataUrl === 'string'
          ? parsed.settings.serreFileLogoDataUrl
          : null,
      guideLogoDataUrl:
        parsed.settings && typeof parsed.settings.guideLogoDataUrl === 'string'
          ? parsed.settings.guideLogoDataUrl
          : null,
      pictogramSizePx:
        parsed.settings &&
        typeof parsed.settings.pictogramSizePx === 'number' &&
        parsed.settings.pictogramSizePx >= 28 &&
        parsed.settings.pictogramSizePx <= 68
          ? parsed.settings.pictogramSizePx
          : 44,
      roleBadgeSizePx:
        parsed.settings &&
        typeof parsed.settings.roleBadgeSizePx === 'number' &&
        parsed.settings.roleBadgeSizePx >= 18 &&
        parsed.settings.roleBadgeSizePx <= 48
          ? parsed.settings.roleBadgeSizePx
          : 24,
      companyName:
        parsed.settings && typeof parsed.settings.companyName === 'string'
          ? parsed.settings.companyName
          : 'ENTREPRISE',
      lastUpdatedDate:
        parsed.settings && typeof parsed.settings.lastUpdatedDate === 'string'
          ? parsed.settings.lastUpdatedDate
          : getTodayFrenchDate(),
      autoUpdateDate:
        parsed.settings && typeof parsed.settings.autoUpdateDate === 'boolean'
          ? parsed.settings.autoUpdateDate
          : true,
      headerHeightPx:
        parsed.settings &&
        typeof parsed.settings.headerHeightPx === 'number' &&
        parsed.settings.headerHeightPx >= 48 &&
        parsed.settings.headerHeightPx <= 140
          ? parsed.settings.headerHeightPx
          : 68,
      zoneScale:
        parsed.settings &&
        typeof parsed.settings.zoneScale === 'number' &&
        parsed.settings.zoneScale >= 0.95 &&
        parsed.settings.zoneScale <= 1.6
          ? parsed.settings.zoneScale
          : 1.15,
      emergencyBoxShape:
        parsed.settings &&
        ['pills', 'stacked', 'rounded', 'chamfer'].includes(
          String(parsed.settings.emergencyBoxShape)
        )
          ? (parsed.settings.emergencyBoxShape as 'pills' | 'stacked' | 'rounded' | 'chamfer')
          : 'pills',
    },
  };
}

function normalizeHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseRolesCell(raw: string): EmergencyRole[] {
  const upper = raw.toUpperCase();
  const roles: EmergencyRole[] = [];
  if (upper.includes('SST') || upper.includes('S.S.T') || upper.includes('SECOUR')) {
    roles.push('SST');
  }
  if (upper.includes('EPI') || upper.includes('E.P.I') || upper.includes('INTERVENTION')) {
    roles.push('EPI');
  }
  if (upper.includes('GUIDE')) {
    roles.push('GUIDE');
  }
  if (upper.includes('SERRE')) {
    roles.push('SERRE_FILE');
  }
  return Array.from(new Set(roles));
}

function parseDateCell(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    // Numéro de série Excel
    const date = XLSX.SSF.parse_date_code(val);
    if (date && date.y && date.m && date.d) {
      return `${String(date.y).padStart(4, '0')}-${String(date.m).padStart(2, '0')}-${String(
        date.d
      ).padStart(2, '0')}`;
    }
  }
  const str = String(val).trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const frMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(str);
  if (frMatch) {
    return `${frMatch[3]}-${frMatch[2].padStart(2, '0')}-${frMatch[1].padStart(2, '0')}`;
  }
  return '';
}

function parseActiveCell(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val ?? '')
    .trim()
    .toLowerCase();
  if (!s) return true;
  if (['non', 'no', 'false', '0', 'inactif', 'desactive', 'désactivé'].includes(s)) {
    return false;
  }
  return true;
}

export interface SpreadsheetImportResult {
  newPeople: Person[];
  createdZones: Zone[];
  skippedRows: number;
  warnings: string[];
}

export async function parseSpreadsheetFile(
  file: File,
  existingZones: Zone[]
): Promise<SpreadsheetImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Le fichier ne contient aucune feuille lisible.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('Aucune ligne de données trouvée dans le fichier.');
  }

  const zoneByName = new Map<string, Zone>();
  existingZones.forEach((z) => zoneByName.set(z.name.trim().toUpperCase(), z));

  const createdZones: Zone[] = [];
  const newPeople: Person[] = [];
  const warnings: string[] = [];
  let skippedRows = 0;

  rawRows.forEach((row, idx) => {
    const mapped: Record<string, unknown> = {};
    Object.entries(row).forEach(([k, v]) => {
      mapped[normalizeHeaderKey(k)] = v;
    });

    const lastName = String(
      mapped.nom ?? mapped.lastname ?? mapped.name ?? ''
    )
      .trim()
      .toUpperCase();
    const firstName = String(
      mapped.prenom ?? mapped.firstname ?? ''
    ).trim();
    const rawNumber = String(
      mapped.numerointerne ??
        mapped.numero ??
        mapped.num ??
        mapped.tel ??
        mapped.interne ??
        mapped.internalnumber ??
        ''
    ).trim();
    const normalizedNum = normalizeInternalNumber(rawNumber);

    if (!lastName && !firstName) {
      skippedRows++;
      return;
    }

    if (!isValidInternalNumber(normalizedNum)) {
      warnings.push(
        `Ligne ${idx + 2} (${lastName || '?'} ${firstName}) : numéro interne "${rawNumber}" invalide (4 chiffres attendus).`
      );
      skippedRows++;
      return;
    }

    const rawRoles = String(mapped.roles ?? mapped.role ?? mapped.fonctions ?? '');
    const roles = parseRolesCell(rawRoles);
    if (roles.length === 0) {
      warnings.push(
        `Ligne ${idx + 2} (${lastName} ${firstName}) : aucun rôle reconnu (SST, EPI, Guide, Serre-file).`
      );
    }

    const rawZoneCell = String(
      mapped.zoneprincipale ??
        mapped.zones ??
        mapped.zone ??
        mapped.secteur ??
        existingZones[0]?.name ??
        'ZONE 1'
    );

    const zoneNames = rawZoneCell
      .split(/[;,|]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    if (zoneNames.length === 0) {
      zoneNames.push(existingZones[0]?.name || 'NOUVELLE ZONE');
    }

    const resolvedZoneIds: string[] = zoneNames.map((zName) => {
      let zone = zoneByName.get(zName);
      if (!zone) {
        zone = {
          id: `zone-${crypto.randomUUID()}`,
          name: zName,
          nearbyZoneIds: [],
        };
        zoneByName.set(zone.name, zone);
        createdZones.push(zone);
      }
      return zone.id;
    });

    const primaryZoneId = resolvedZoneIds[0];
    const coveredZoneIds = Array.from(
      new Set(resolvedZoneIds.slice(1).filter((id) => id !== primaryZoneId))
    );

    const expiryRaw =
      mapped.datevaliditeformation ??
      mapped.validite ??
      mapped.expiration ??
      mapped.dateexpiration ??
      mapped.trainingexpirydate ??
      '';
    const trainingExpiryDate = parseDateCell(expiryRaw);
    const isActive = parseActiveCell(mapped.actif ?? mapped.active ?? mapped.statut ?? 'OUI');

    newPeople.push({
      id: `p-${crypto.randomUUID()}`,
      lastName: lastName || 'INCONNU',
      firstName: firstName || '—',
      internalNumber: normalizedNum,
      roles,
      primaryZoneId,
      coveredZoneIds,
      nearbyZoneIds: [],
      trainingExpiryDate,
      isActive,
    });
  });

  return {
    newPeople,
    createdZones,
    skippedRows,
    warnings,
  };
}
