import { Component } from 'react';

// רשת ביטחון: תקלה במסך אחד לא משאירה מסך לבן. מציגים את פרטי השגיאה (כדי לדעת מה לתקן)
// ואפשר לחזור ללוח או לטעון מחדש. שום נתון לא נמחק.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: '' };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('seder crashed', error, info?.componentStack);
    const where = (info?.componentStack || '').trim().split('\n').slice(0, 4).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*$/, '')).join(' ← ');
    this.setState({ info: where });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    const details = `${error?.name || 'Error'}: ${error?.message || error}\n${info}\n${navigator.userAgent}`;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-3">😕</div>
          <h2 className="text-xl font-bold mb-2">משהו השתבש במסך הזה</h2>
          <p className="text-stone-600 text-sm mb-4">שום משימה לא נמחקה. אפשר לחזור ולהמשיך. צילום מסך של הפרטים למטה יעזור לתקן.</p>
          <pre dir="ltr" className="text-left text-[11px] leading-snug whitespace-pre-wrap break-all bg-stone-100 text-stone-700 rounded-xl p-3 mb-4 max-h-48 overflow-auto">{details}</pre>
          <div className="flex gap-2">
            <button onClick={() => { this.setState({ error: null, info: '' }); this.props.onReset?.(); }} className="flex-1 rounded-2xl bg-violet-600 text-white font-bold py-3">חזרה</button>
            <button onClick={() => window.location.reload()} className="flex-1 rounded-2xl border border-stone-200 py-3">טעינה מחדש</button>
          </div>
        </div>
      </div>
    );
  }
}
