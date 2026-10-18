// הלוגו של Isport (public/logo.webp – רקע שקוף, מתאים לרקע כהה). גם האייקונים (icon-192/512) נוצרו ממנו
export default function Logo({ className = 'h-12' }) {
  return <img src="logo.webp" alt="Isport" className={`w-auto select-none ${className}`} draggable="false" />;
}
