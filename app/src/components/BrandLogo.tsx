import React from "react";

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 28,
  showText = true,
  className = "",
  textClassName = "font-bold text-[16px] tracking-tight text-[var(--text-primary)]"
}) => {
  return (
    <div className={`inline-flex items-center ${showText ? "gap-2" : ""} ${className}`}>
      <div style={{ width: size, height: size }} className="shrink-0 transition-transform duration-200 hover:scale-105">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%" className="w-full h-full drop-shadow-xs">
          <rect x="6" y="6" width="108" height="108" rx="28" fill="#00966d" />
          <rect x="6.75" y="6.75" width="106.5" height="106.5" rx="27.25" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.5" />

          <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
            <line x1="33" y1="36" x2="87" y2="36" strokeWidth="8" />
            <line x1="33" y1="49" x2="73" y2="49" strokeWidth="8" />
            <line x1="43" y1="36" x2="43" y2="88" strokeWidth="8.5" />
            <path d="M43,36 H66 C78,36 85,44 85,55 C85,66 78,73 65,73 H43" strokeWidth="8" />
            <path d="M61,72 L82,88" strokeWidth="8.5" />
          </g>
          <circle cx="64" cy="55" r="3.5" fill="#ff385c" />
        </svg>
      </div>

      {showText && (
        <span className={textClassName}>
          RoomMate<span className="text-[#00966d] dark:text-[#00e599]">ExpenseTracker</span>
        </span>
      )}
    </div>
  );
};
