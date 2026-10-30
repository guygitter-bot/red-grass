// מצב צ'אט משותף: ההודעות נשמרות ברמת המודול, כך שהמסך המלא והחלון הצף מציגים אותו דבר
import { useSyncExternalStore } from 'react';
import { api } from './api';

let state = { messages: [], loaded: false, busy: false, answering: false, notice: null, seenT: 0 };
let loading = false;
const subs = new Set();

function set(patch) {
  state = { ...state, ...patch };
  subs.forEach((fn) => fn());
}

const errNotice = (e) => ({ role: 'assistant', text: e.message, t: Date.now(), error: true });

const lastBot = (messages) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user' && !messages[i].error) return messages[i];
  }
  return null;
};

// הודעת בוט אחרונה שעוד לא נראתה (לנקודה על הכפתור הצף)
export function hasUnseen(s) {
  const b = lastBot(s.messages);
  return !!b && (b.t || 0) > s.seenT;
}

export function lastBotLine(s) {
  const b = lastBot(s.messages);
  if (!b) return '';
  const line = String(b.text || '').split('\n').map((l) => l.replace(/[#*_`>]/g, '').trim()).find(Boolean);
  return line || '';
}

export function markSeen() {
  const b = lastBot(state.messages);
  if (b && (b.t || 0) > state.seenT) set({ seenT: b.t });
}

export function loadChat() {
  if (state.loaded || loading) return;
  loading = true;
  api('/chat/history')
    .then((r) => {
      const b = lastBot(r.messages);
      set({ messages: r.messages, seenT: b ? b.t || 0 : 0 });
    })
    .catch((e) => set({ notice: errNotice(e) }))
    .finally(() => {
      loading = false;
      set({ loaded: true });
    });
}

export async function sendChat(msg) {
  const text = String(msg || '').trim();
  if (!text || state.busy) return;
  set({ notice: null, busy: true, messages: [...state.messages, { role: 'user', text, t: Date.now() }] });
  try {
    const r = await api('/chat', { text });
    set({ messages: r.messages });
  } catch (e) {
    set({ notice: errNotice(e) });
  } finally {
    set({ busy: false });
  }
}

// אישור / דחיית הצעה של הבוט
export async function answerProposal(id, approve) {
  if (state.answering) return;
  set({ answering: true, notice: null });
  try {
    const r = await api('/chat/approve', { id, approve });
    set({ messages: r.messages });
  } catch (e) {
    set({ notice: errNotice(e) });
  } finally {
    set({ answering: false });
  }
}

export async function clearChat() {
  try {
    await api('/chat/clear');
    set({ messages: [], notice: null });
  } catch (e) {
    set({ notice: errNotice(e) });
  }
}

const subscribe = (fn) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};

export function useChat() {
  return useSyncExternalStore(subscribe, () => state);
}
