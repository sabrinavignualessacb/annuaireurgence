export type EmergencyRole = 'SST' | 'EPI' | 'GUIDE' | 'SERRE_FILE';

export interface Zone {
  id: string;
  name: string;
  nearbyZoneIds: string[];
}

export interface Person {
  id: string;
  lastName: string;
  firstName: string;
  internalNumber: string;
  roles: EmergencyRole[];
  primaryZoneId: string;
  nearbyZoneIds: string[];
  trainingExpiryDate: string; // YYYY-MM-DD
  isActive: boolean;
}

export type EmergencyBoxShape = 'pills' | 'stacked' | 'rounded' | 'chamfer';

export interface PosterSettings {
  companyLogoDataUrl: string | null;
  companyName: string;
  lastUpdatedDate: string; // DD/MM/YYYY
  autoUpdateDate: boolean;
  headerHeightPx: number; // Hauteur du bandeau rouge Annuaire d'urgence
  zoneScale: number; // Facteur d'agrandissement de la zone active (1.0 à 1.55)
  emergencyBoxShape: EmergencyBoxShape;
}

export interface AppData {
  zones: Zone[];
  people: Person[];
  activeZoneId: string;
  settings: PosterSettings;
}

export const ROLE_LABELS: Record<EmergencyRole, string> = {
  SST: 'S.S.T (Secouriste)',
  EPI: 'E.P.I (Équipier Première Intervention)',
  GUIDE: "Guide d'évacuation",
  SERRE_FILE: 'Serre-file',
};

export const ROLE_SHORT_LABELS: Record<EmergencyRole, string> = {
  SST: 'SST',
  EPI: 'EPI',
  GUIDE: 'Guide',
  SERRE_FILE: 'Serre-file',
};

export const CONFIDENTIALITY_NOTICE =
  'Ce document est soumis à la politique de confidentialité : interne';
