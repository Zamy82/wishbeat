// Logo-Komponenten für DJ Zamy.
// Ein Master-Component <DjLogo /> rendert je nach `style` das gewählte Design.
// Alle Varianten sind SVG-basiert, scalable, verlustfrei.

export type LogoStyle =
  | "vinyl"
  | "equalizer"
  | "headphones"
  | "wave"
  | "monogram";

export const LOGO_STYLES: { id: LogoStyle; label: string; description: string }[] = [
  {
    id: "vinyl",
    label: "Vinyl",
    description: "Schallplatte mit Z als Label - klassisch DJ"
  },
  {
    id: "equalizer",
    label: "Equalizer",
    description: "5 Tonbalken im Neon-Verlauf - energetisch"
  },
  {
    id: "headphones",
    label: "Kopfhörer",
    description: "Stilisierte DJ-Kopfhörer in Pink-Cyan"
  },
  {
    id: "wave",
    label: "Soundwave Z",
    description: "Buchstabe Z als Audio-Wellenform - modern"
  },
  {
    id: "monogram",
    label: "Monogramm",
    description: "DJ + Z im Kreis - klassisch elegant"
  }
];

interface Props {
  style: LogoStyle;
  size?: number;
  className?: string;
  monochrome?: boolean; // für Druck / einfarbige Anwendung
}

export default function DjLogo({
  style,
  size = 48,
  className = "",
  monochrome = false
}: Props) {
  const props = { size, monochrome, className };
  switch (style) {
    case "vinyl":
      return <VinylLogo {...props} />;
    case "equalizer":
      return <EqualizerLogo {...props} />;
    case "headphones":
      return <HeadphonesLogo {...props} />;
    case "wave":
      return <WaveLogo {...props} />;
    case "monogram":
      return <MonogramLogo {...props} />;
  }
}

interface VariantProps {
  size: number;
  monochrome: boolean;
  className: string;
}

function VinylLogo({ size, monochrome, className }: VariantProps) {
  const labelColor = monochrome ? "#0a0a12" : "url(#vinyl-grad)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-label="DJ Zamy — Vinyl-Logo"
    >
      <defs>
        <linearGradient id="vinyl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff2e93" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Vinyl-Platte */}
      <circle cx="50" cy="50" r="48" fill={monochrome ? "#0a0a12" : "#0a0a12"} />
      {/* Rillen */}
      <circle cx="50" cy="50" r="44" fill="none" stroke="#1a1a2e" strokeWidth="0.5" opacity="0.8" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#1a1a2e" strokeWidth="0.5" opacity="0.6" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#1a1a2e" strokeWidth="0.5" opacity="0.5" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="#1a1a2e" strokeWidth="0.5" opacity="0.4" />
      {/* Label */}
      <circle cx="50" cy="50" r="24" fill={labelColor} />
      {/* Z */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontSize="28"
        fontWeight="900"
        fill="#ffffff"
        fontFamily="system-ui, sans-serif"
      >
        Z
      </text>
      {/* Center-Loch */}
      <circle cx="50" cy="50" r="2.5" fill="#0a0a12" />
    </svg>
  );
}

function EqualizerLogo({ size, monochrome, className }: VariantProps) {
  const colors = monochrome
    ? ["#0a0a12", "#0a0a12", "#0a0a12", "#0a0a12", "#0a0a12"]
    : ["#ff2e93", "#d946ef", "#a855f7", "#7c3aed", "#22d3ee"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-label="DJ Zamy — Equalizer-Logo"
    >
      <rect x="8" y="60" width="12" height="32" fill={colors[0]} rx="3" />
      <rect x="26" y="38" width="12" height="54" fill={colors[1]} rx="3" />
      <rect x="44" y="20" width="12" height="72" fill={colors[2]} rx="3" />
      <rect x="62" y="32" width="12" height="60" fill={colors[3]} rx="3" />
      <rect x="80" y="50" width="12" height="42" fill={colors[4]} rx="3" />
    </svg>
  );
}

function HeadphonesLogo({ size, monochrome, className }: VariantProps) {
  const color = monochrome ? "#0a0a12" : "url(#hp-grad)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-label="DJ Zamy — Kopfhörer-Logo"
    >
      <defs>
        <linearGradient id="hp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff2e93" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Bügel */}
      <path
        d="M 20 55 Q 50 12 80 55"
        stroke={color}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      {/* Linke Ohrmuschel */}
      <rect x="10" y="50" width="22" height="32" rx="8" fill={color} />
      <rect x="14" y="54" width="14" height="24" rx="5" fill="#0a0a12" opacity="0.4" />
      {/* Rechte Ohrmuschel */}
      <rect x="68" y="50" width="22" height="32" rx="8" fill={color} />
      <rect x="72" y="54" width="14" height="24" rx="5" fill="#0a0a12" opacity="0.4" />
    </svg>
  );
}

function WaveLogo({ size, monochrome, className }: VariantProps) {
  const color = monochrome ? "#0a0a12" : "url(#wave-grad)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-label="DJ Zamy — Soundwave-Z-Logo"
    >
      <defs>
        <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff2e93" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {/* Z-Form aus Wellen */}
      {/* Oberer Strich */}
      <path
        d="M 12 25 L 88 25"
        stroke={color}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Diagonale als Wellenlinie */}
      <path
        d="M 88 25 Q 70 40, 50 50 T 12 75"
        stroke={color}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Unterer Strich */}
      <path
        d="M 12 75 L 88 75"
        stroke={color}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Mini-Wellen oben + unten als Equalizer-Akzent */}
      <line x1="20" y1="40" x2="20" y2="48" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <line x1="30" y1="38" x2="30" y2="50" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <line x1="70" y1="50" x2="70" y2="62" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <line x1="80" y1="52" x2="80" y2="60" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function MonogramLogo({ size, monochrome, className }: VariantProps) {
  const color = monochrome ? "#0a0a12" : "url(#mono-grad)";
  const djColor = monochrome ? "#666" : "#22d3ee";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-label="DJ Zamy — Monogramm-Logo"
    >
      <defs>
        <linearGradient id="mono-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff2e93" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* Äußerer Ring */}
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="3" />
      {/* "DJ" oben */}
      <text
        x="50"
        y="36"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill={djColor}
        letterSpacing="3"
        fontFamily="system-ui, sans-serif"
      >
        DJ
      </text>
      {/* Linie zwischen */}
      <line x1="32" y1="42" x2="68" y2="42" stroke={color} strokeWidth="1.5" opacity="0.5" />
      {/* "Zamy" — Z groß + amy klein, zusammen als Wortmarke */}
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        <tspan fontSize="38" fontWeight="900">Z</tspan>
        <tspan fontSize="16" fontWeight="700" fontStyle="italic" dx="1">amy</tspan>
      </text>
    </svg>
  );
}
