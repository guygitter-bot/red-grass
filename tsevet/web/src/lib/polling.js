// מרווח רענון לפי מצב השיחה / הצוות (באלפיות שנייה)
export function convInterval(conv) {
  if (conv?.busy) return 2000;
  if (conv?.pending) return 6000;
  return 20000;
}

export function teamInterval(team) {
  const busy = team?.agents?.some((a) => a.busy) || team?.convs?.some((c) => c.busy);
  return busy ? 5000 : 30000;
}
