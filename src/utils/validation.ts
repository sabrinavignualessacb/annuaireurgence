export type TrainingStatus = 'valid' | 'expiring_soon' | 'expired';

/**
 * Normalise un numéro interne (supprime les espaces autour du '/').
 */
export function normalizeInternalNumber(value: string): string {
  return value.replace(/\s*\/\s*/g, '/').replace(/\s+/g, '').trim();
}

/**
 * Valide un numéro interne sur 4 chiffres (ex: 7947) ou deux numéros sur 4 chiffres séparés par '/' (ex: 7974/7311).
 */
export function isValidInternalNumber(value: string): boolean {
  const normalized = normalizeInternalNumber(value);
  return /^\d{4}(\/\d{4})?$/.test(normalized);
}

/**
 * Retourne la date locale du jour au format ISO YYYY-MM-DD.
 */
export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retourne la date locale du jour au format français DD/MM/YYYY.
 */
export function getTodayFrenchDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${d}/${m}/${y}`;
}

/**
 * Formate une date ISO YYYY-MM-DD en DD/MM/YYYY.
 */
export function formatIsoToFrenchDate(isoDate: string): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * Calcule le nombre de jours restants avant expiration (négatif si expirée).
 */
export function getDaysUntilExpiry(trainingExpiryDate: string): number | null {
  if (!trainingExpiryDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trainingExpiryDate.trim());
  if (!match) return null;

  const todayStr = getTodayIsoDate();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const expiryUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Math.round((expiryUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

export function getTrainingStatus(trainingExpiryDate: string): TrainingStatus {
  const days = getDaysUntilExpiry(trainingExpiryDate);
  if (days === null) return 'valid';
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'valid';
}

export function isTrainingExpired(trainingExpiryDate: string): boolean {
  return getTrainingStatus(trainingExpiryDate) === 'expired';
}

export function isPersonEligibleForPoster(person: {
  isActive: boolean;
  trainingExpiryDate: string;
}): boolean {
  return person.isActive && !isTrainingExpired(person.trainingExpiryDate);
}
