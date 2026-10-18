// מסך "משהו השתבש" במקום דף לבן אם רכיב קורס
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-4 text-center text-ink">
        <h1 className="text-2xl font-black">משהו השתבש</h1>
        <p className="text-muted">נסו לטעון את הדף מחדש.</p>
        <button onClick={() => window.location.reload()} className="rounded-full bg-ink px-6 py-3 font-bold text-white hover:opacity-90 dark:bg-lime dark:text-ink">
          טעינה מחדש
        </button>
      </div>
    );
  }
}
