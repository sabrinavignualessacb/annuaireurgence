import React from 'react';

interface PictogramProps {
  className?: string;
  sizePx?: number;
  customLogoUrl?: string | null;
}

export const SstPictogram: React.FC<PictogramProps> = ({
  className = '',
  sizePx = 44,
  customLogoUrl,
}) => {
  if (customLogoUrl) {
    return (
      <img
        src={customLogoUrl}
        alt="Logo S.S.T"
        style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
        className={`object-contain shrink-0 rounded ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
      className={`shrink-0 ${className}`}
      aria-label="Pictogramme SST"
    >
      <rect x="2" y="2" width="60" height="60" rx="8" fill="#008749" />
      <rect x="6" y="6" width="52" height="52" rx="5" stroke="#FFFFFF" strokeWidth="2" />
      {/* Croix de premiers secours */}
      <rect x="27" y="13" width="10" height="24" rx="1.5" fill="#FFFFFF" />
      <rect x="20" y="20" width="24" height="10" rx="1.5" fill="#FFFFFF" />
      {/* Bandeau texte SST */}
      <rect x="10" y="41" width="44" height="14" rx="3" fill="#FFFFFF" />
      <text
        x="32"
        y="51.5"
        textAnchor="middle"
        fill="#008749"
        fontSize="11.5"
        fontWeight="800"
        fontFamily="Plus Jakarta Sans, Arial, sans-serif"
        letterSpacing="0.8"
      >
        S.S.T
      </text>
    </svg>
  );
};

export const EpiPictogram: React.FC<PictogramProps> = ({
  className = '',
  sizePx = 44,
  customLogoUrl,
}) => {
  if (customLogoUrl) {
    return (
      <img
        src={customLogoUrl}
        alt="Logo E.P.I"
        style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
        className={`object-contain shrink-0 rounded ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
      className={`shrink-0 ${className}`}
      aria-label="Pictogramme EPI"
    >
      <rect x="2" y="2" width="60" height="60" rx="8" fill="#D91E18" />
      <rect x="6" y="6" width="52" height="52" rx="5" stroke="#FFFFFF" strokeWidth="2" />
      {/* Flamme stylisée */}
      <path
        d="M33.5 12C33.5 12 41 18.5 41 25.5C41 30.8 37.2 35 32 35C26.8 35 23 30.8 23 25.5C23 21.8 25.2 18.2 27.2 16.2C27.2 16.2 26.8 20.5 29.4 22.1C29.4 17.8 31.8 14.2 33.5 12Z"
        fill="#FFFFFF"
      />
      {/* Bandeau texte EPI */}
      <rect x="10" y="41" width="44" height="14" rx="3" fill="#FFFFFF" />
      <text
        x="32"
        y="51.5"
        textAnchor="middle"
        fill="#D91E18"
        fontSize="11.5"
        fontWeight="800"
        fontFamily="Plus Jakarta Sans, Arial, sans-serif"
        letterSpacing="0.8"
      >
        E.P.I
      </text>
    </svg>
  );
};

export const EvacuationPictogram: React.FC<PictogramProps> = ({
  className = '',
  sizePx = 44,
  customLogoUrl,
}) => {
  if (customLogoUrl) {
    return (
      <img
        src={customLogoUrl}
        alt="Logo Évacuation Secours"
        style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
        className={`object-contain shrink-0 rounded ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
      className={`shrink-0 ${className}`}
      aria-label="Pictogramme Évacuation Secours"
    >
      <rect x="2" y="2" width="60" height="60" rx="8" fill="#008749" />
      {/* Porte de sortie */}
      <rect x="38" y="12" width="16" height="36" rx="1.5" fill="#FFFFFF" />
      <rect x="41" y="15" width="10" height="30" fill="#008749" />
      {/* Personnage qui court vers la sortie */}
      <circle cx="24" cy="18" r="4.5" fill="#FFFFFF" />
      <path
        d="M17 28L24 25L32 27L37 24"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 25L22 37L14 48"
        stroke="#FFFFFF"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23 36L31 41L34 50"
        stroke="#FFFFFF"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Flèche directionnelle */}
      <path
        d="M11 52H36M36 52L31 47M36 52L31 57"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const RoleLetterBadge: React.FC<{
  letter: 'S' | 'G';
  sizePx?: number;
  customLogoUrl?: string | null;
}> = ({ letter, sizePx = 24, customLogoUrl }) => {
  if (customLogoUrl) {
    return (
      <img
        src={customLogoUrl}
        alt={letter === 'S' ? 'Logo Serre-file' : "Logo Guide d'évacuation"}
        style={{ width: `${sizePx}px`, height: `${sizePx}px` }}
        className="object-contain shrink-0 rounded"
        referrerPolicy="no-referrer"
      />
    );
  }

  const styles =
    letter === 'S'
      ? 'bg-[#EA580C] text-white border border-[#C2410C]'
      : 'bg-[#FACC15] text-[#422006] border border-[#CA8A04]';

  const fontSizePx = Math.max(11, Math.round(sizePx * 0.56));

  return (
    <span
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        fontSize: `${fontSizePx}px`,
      }}
      className={`inline-flex items-center justify-center rounded-full font-display font-extrabold leading-none shrink-0 ${styles}`}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
};
