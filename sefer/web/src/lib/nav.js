// מעבר בין מסכים: משנים את הכתובת (אחרי #), ו-App מציג את המסך המתאים
export const go = (path) => { window.location.hash = `#/${path}`; };
export const back = () => { if (window.history.length > 1) window.history.back(); else go(''); };
