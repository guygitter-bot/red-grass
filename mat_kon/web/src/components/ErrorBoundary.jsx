import { Component } from 'react';
import { reportClientError } from '../lib/api';
import { idbDel } from '../lib/idb';

// רשת ביטחון: תקלה במסך אחד (למשל נתון פגום) לא משאירה מסך לבן
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('mat-kon crashed', error, info?.componentStack);
    reportClientError(window.location.hash || 'home', `${error?.message || error}`.slice(0, 300));
  }

  reset = async () => {
    await idbDel('matkon_recipes').catch(() => {});
    try {
      // הנתונים השמורים במכשיר ייטענו מחדש מהשרת; הכניסה לחשבון נשמרת
      for (const k of Object.keys(localStorage)) {
        if (/^matkon_(recipes|shopping|plan|pantry|custom_categories)$/.test(k)) localStorage.removeItem(k);
      }
    } catch {
      // אחסון חסום
    }
    window.location.hash = '';
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#fffbf5]" dir="rtl">
        <div className="max-w-sm text-center">
          <div className="text-5xl mb-3">🍳</div>
          <h1 className="text-xl font-bold mb-2">משהו השתבש</h1>
          <p className="text-stone-600 mb-5">אפשר לטעון את הספר מחדש מהשרת. שום מתכון לא נמחק.</p>
          <button onClick={this.reset} className="w-full rounded-2xl bg-orange-500 text-white font-bold py-3">טעינה מחדש</button>
        </div>
      </div>
    );
  }
}
