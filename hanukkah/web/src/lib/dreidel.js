// כללי הסביבון (פונקציות טהורות): נ = כלום, ג = כל הקופה, ה = חצי (מעוגל כלפי מעלה), פ = שמים מטבע
export const LETTERS = ['נ', 'ג', 'ה', 'פ'];
export const WHO = { you: 'את/ה', pc: 'המחשב' };

export function newGame(coins = 10, maxRounds = 10) {
  return {
    coins: { you: coins, pc: coins },
    pot: 0,
    round: 1,
    maxRounds,
    turn: 'you',
    over: false,
    winner: null, // 'you' | 'pc' | 'draw'
    last: null,
  };
}

export function applyLetter(state, letter) {
  if (state.over) return state;
  const who = state.turn;
  const other = who === 'you' ? 'pc' : 'you';
  const coins = { ...state.coins };
  let pot = state.pot;
  let ante = false;
  // קופה ריקה: כולם שמים מטבע אחד
  if (pot === 0) {
    ante = true;
    for (const k of ['you', 'pc']) {
      if (coins[k] > 0) {
        coins[k] -= 1;
        pot += 1;
      }
    }
  }
  let gained = 0;
  let put = 0;
  if (letter === 'ג') {
    gained = pot;
  } else if (letter === 'ה') {
    gained = Math.ceil(pot / 2);
  } else if (letter === 'פ' && coins[who] > 0) {
    coins[who] -= 1;
    put = 1;
    pot += 1;
  }
  coins[who] += gained;
  pot -= gained;

  let round = state.round;
  if (who === 'pc') round += 1;
  const over = coins.you === 0 || coins.pc === 0 || round > state.maxRounds;
  let winner = null;
  if (over) winner = coins.you > coins.pc ? 'you' : coins.pc > coins.you ? 'pc' : 'draw';
  return {
    ...state,
    coins,
    pot,
    round: Math.min(round, state.maxRounds),
    turn: other,
    over,
    winner,
    last: { who, letter, gained, put, ante },
  };
}
