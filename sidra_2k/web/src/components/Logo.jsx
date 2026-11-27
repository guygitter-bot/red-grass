// סמלי הקבוצות: הלוגו האמיתי מהאתר של ה-NBA (cdn.nba.com, מאושר ב-CSP שב-public/_headers).
// אם הוא לא נטען (בלי אינטרנט, או שהכתובת השתנתה) – מוצג ציור משלנו בצבעי הקבוצה.
import { useState } from 'react';
import { TEAM } from '../lib/series';

function Lakers() {
  return (
    <svg viewBox="0 0 200 200" aria-label="לייקרס" role="img">
      <circle cx="100" cy="100" r="92" fill="#fdb927" />
      <circle cx="100" cy="100" r="84" fill="#552583" />
      <g fill="none" stroke="#fdb927" strokeWidth="5">
        <circle cx="100" cy="100" r="62" />
        <path d="M38 100h124M100 38v124" />
        <path d="M58 56c22 22 22 66 0 88M142 56c-22 22-22 66 0 88" />
      </g>
      <rect x="18" y="80" width="164" height="42" rx="6" fill="#fdb927" transform="skewX(-10) translate(17 0)" />
      <text x="104" y="114" textAnchor="middle" fontFamily="Oswald,Impact,sans-serif" fontWeight="700" fontStyle="italic" fontSize="34" fill="#552583" letterSpacing="1">
        LAKERS
      </text>
    </svg>
  );
}

function Spurs() {
  return (
    <svg viewBox="0 0 200 200" aria-label="ספרס" role="img">
      <path d="M100 8 182 40v62c0 46-36 78-82 92-46-14-82-46-82-92V40z" fill="#c4ced4" />
      <path d="M100 18 172 46v56c0 40-31 68-72 81-41-13-72-41-72-81V46z" fill="#121418" />
      <g transform="translate(100 82)">
        <g fill="#c4ced4">
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d="M0 -44 7 -12 0 -4 -7 -12z" transform={`rotate(${i * 36})`} />
          ))}
        </g>
        <circle r="13" fill="#121418" stroke="#c4ced4" strokeWidth="5" />
      </g>
      <text x="100" y="160" textAnchor="middle" fontFamily="Oswald,Impact,sans-serif" fontWeight="700" fontSize="36" fill="#c4ced4" letterSpacing="4">
        SPURS
      </text>
    </svg>
  );
}

function Kings() {
  return (
    <svg viewBox="0 0 200 200" aria-label="קינגס" role="img">
      <circle cx="100" cy="100" r="92" fill="#8a969c" />
      <circle cx="100" cy="100" r="84" fill="#121418" />
      <circle cx="100" cy="100" r="74" fill="none" stroke="#5a2d81" strokeWidth="8" />
      <path d="M52 112 60 62l24 26 16-34 16 34 24-26 8 50z" fill="#c4ced4" />
      <rect x="52" y="116" width="96" height="10" rx="3" fill="#c4ced4" />
      <circle cx="60" cy="60" r="6" fill="#5a2d81" />
      <circle cx="100" cy="50" r="6" fill="#5a2d81" />
      <circle cx="140" cy="60" r="6" fill="#5a2d81" />
      <text x="100" y="158" textAnchor="middle" fontFamily="Oswald,Impact,sans-serif" fontWeight="700" fontSize="30" fill="#c4ced4" letterSpacing="4">
        KINGS
      </text>
    </svg>
  );
}

const DRAWN = { LAL: Lakers, SAS: Spurs, SAC: Kings };

export default function Logo({ team, className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`block ${className}`}>
      {failed || !TEAM[team] ? (
        (() => {
          const Drawn = DRAWN[team] || Lakers;
          return <Drawn />;
        })()
      ) : (
        <img
          src={`https://cdn.nba.com/logos/nba/${TEAM[team].nba}/primary/L/logo.svg`}
          alt={`${TEAM[team].city} ${TEAM[team].name}`}
          className="h-full w-full object-contain"
          draggable="false"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
