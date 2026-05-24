// Variation B — "Compass"
// Dark fintech feel. Bottom tab bar. Ring gauge. Status-coded category cards.

const C_BG = '#0c1014';
const C_BG_2 = '#141a21';
const C_BG_3 = '#1c242d';
const C_LINE = 'rgba(255,255,255,0.07)';
const C_LINE_2 = 'rgba(255,255,255,0.14)';
const C_TEXT = '#ecebe6';
const C_TEXT_2 = 'rgba(236,235,230,0.65)';
const C_TEXT_3 = 'rgba(236,235,230,0.42)';
const C_OK = '#7ec48a';
const C_WARN = '#e3b658';
const C_OVER = '#e57565';
const C_ACCENT = '#9cc6ff';

const C_FONT_UI = '"Helvetica Neue", Helvetica, "SF Pro Text", system-ui, sans-serif';
const C_FONT_NUM = '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace';

const compassStyles = {
  shell: {
    width: '100%', height: '100%', background: C_BG, color: C_TEXT,
    fontFamily: C_FONT_UI, display: 'flex', flexDirection: 'column',
    fontSize: 14, letterSpacing: '-0.005em',
  },
  topbar: { padding: '54px 20px 4px' },
  body: { flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 110 },
  tabbar: {
    position: 'absolute', left: 14, right: 14, bottom: 18,
    background: 'rgba(20,26,33,0.85)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `0.5px solid ${C_LINE_2}`, borderRadius: 22,
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    padding: '8px 6px',
  },
};

function cFmt(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}
function cFmtK(n) {
  if (n >= 100000) return (n / 100000).toFixed(n >= 1000000 ? 0 : 1) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return Math.round(n).toString();
}
function cFmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Ring gauge ─────────────────────────────────────────────────────────────
function CompassRing({ pct, status, size = 200, stroke = 12 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, pct);
  const offset = c * (1 - clamped);
  const color = status === 'over' ? C_OVER : status === 'warn' ? C_WARN : C_OK;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C_BG_3} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.7,.3,1), stroke .3s' }}
      />
      {pct > 1 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={C_OVER} strokeWidth={2} strokeOpacity={0.6} strokeDasharray="2 4"
          transform={`rotate(${-90 + clamped * 360} ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

// ─── Friend balance card ─────────────────────────────────────────────────────
function FriendBalanceCard({ balance, friendName }) {
  const isPositive = balance > 0;
  const isZero = balance === 0;
  const color = isZero ? C_TEXT_3 : isPositive ? C_OK : C_WARN;
  const label = isZero
    ? 'Settled up'
    : isPositive
      ? `${friendName} owes us`
      : `We owe ${friendName}`;
  return (
    <div style={{
      marginTop: 12, padding: '12px 14px',
      background: C_BG_2, borderRadius: 14,
      border: `0.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Friend balance</div>
        <div style={{ fontSize: 13, fontWeight: 500, color, marginTop: 3 }}>{label}</div>
      </div>
      {!isZero && (
        <div style={{ fontFamily: C_FONT_NUM, fontSize: 20, fontWeight: 500, color }}>
          ₹{cFmt(Math.abs(balance))}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
function CompassDashboard({ state, summary, onJump }) {
  const VARIABLE_BUDGETS = state.variableBudgets || window.ExpenseStore.VARIABLE_BUDGETS;
  const { totalActual, totalBudget, pct, status, byCategory, variableActual, variableBudget, fixedActual, fixedBudget } = summary;
  const friend = window.ExpenseStore.summarizeFriend(state);

  const color = status === 'over' ? C_OVER : status === 'warn' ? C_WARN : C_OK;
  const statusText = status === 'over' ? 'Over budget' : status === 'warn' ? `Near ${state.settings.warningThreshold}% threshold` : 'On track';

  const daysTotal = 12; // 25 Jun → 6 Jul inclusive
  const tripStart = new Date('2026-06-25');
  const today = new Date();
  let dayIdx = Math.floor((today - tripStart) / 86400000) + 1;
  if (dayIdx < 1) dayIdx = null;

  return (
    <div style={{ padding: '8px 20px 20px' }}>
      {/* Hero ring */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <CompassRing pct={pct} status={status} size={220} stroke={14} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C_TEXT_3, fontWeight: 600 }}>Total spent</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
            <span style={{ fontFamily: C_FONT_NUM, fontSize: 13, color: C_TEXT_2 }}>₹</span>
            <span style={{ fontFamily: C_FONT_NUM, fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>{cFmt(totalActual)}</span>
          </div>
          <div style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_3, marginTop: 6 }}>of ₹ {cFmt(totalBudget)}</div>
          <div style={{
            marginTop: 10, padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${color}55`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
            <span style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: '0.06em' }}>{(pct * 100).toFixed(1)}% · {statusText}</span>
          </div>
        </div>
      </div>

      {/* Trip strip */}
      <div style={{ marginTop: 20, padding: '12px 14px', background: C_BG_2, borderRadius: 14, border: `0.5px solid ${C_LINE}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: C_TEXT_3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Trip</span>
          <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_3 }}>
            {dayIdx ? `Day ${dayIdx}/${daysTotal}` : `Starts 25 Jun`}
          </span>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 3 }}>
          {Array.from({ length: daysTotal }).map((_, i) => {
            const active = dayIdx && i < dayIdx;
            return (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: active ? C_ACCENT : C_BG_3,
              }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: C_FONT_NUM, fontSize: 10, color: C_TEXT_3 }}>
          <span>25 Jun</span><span>6 Jul</span>
        </div>
      </div>

      {/* Split cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div style={{ padding: '12px 14px', background: C_BG_2, borderRadius: 14, border: `0.5px solid ${C_LINE}` }}>
          <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Fixed</div>
          <div style={{ fontFamily: C_FONT_NUM, fontSize: 18, marginTop: 4 }}>₹{cFmtK(fixedActual)}</div>
          <div style={{ fontFamily: C_FONT_NUM, fontSize: 10, color: C_TEXT_3, marginTop: 2 }}>of {cFmtK(fixedBudget)} · locked</div>
        </div>
        <div style={{ padding: '12px 14px', background: C_BG_2, borderRadius: 14, border: `0.5px solid ${C_LINE}` }}>
          <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Variable</div>
          <div style={{ fontFamily: C_FONT_NUM, fontSize: 18, marginTop: 4, color: variableActual > variableBudget ? C_OVER : C_TEXT }}>₹{cFmtK(variableActual)}</div>
          <div style={{ fontFamily: C_FONT_NUM, fontSize: 10, color: C_TEXT_3, marginTop: 2 }}>of {cFmtK(variableBudget)} · live</div>
        </div>
      </div>

      {/* Friend balance */}
      {friend.transactions.length > 0 && (
        <FriendBalanceCard balance={friend.balance} friendName={friend.friendName} />
      )}

      {/* Category cards */}
      <div style={{ marginTop: 22, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Variable categories</div>
        <div style={{ fontSize: 11, color: C_TEXT_3 }}>{VARIABLE_BUDGETS.length} live</div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {VARIABLE_BUDGETS.map(c => {
          const spent = byCategory[c.category] || 0;
          const pct = c.budget > 0 ? spent / c.budget : 0;
          const over = spent > c.budget;
          const near = pct >= 0.8 && !over;
          const dotColor = over ? C_OVER : near ? C_WARN : C_OK;
          return (
            <div key={c.category} style={{
              padding: '12px 14px', background: C_BG_2, borderRadius: 12, border: `0.5px solid ${C_LINE}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{c.category}</span>
                </div>
                <div style={{ fontFamily: C_FONT_NUM, fontSize: 13, color: over ? C_OVER : C_TEXT }}>₹{cFmtK(spent)}</div>
              </div>
              <div style={{ position: 'relative', height: 3, marginTop: 10, background: C_BG_3, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, pct * 100)}%`, background: dotColor, borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: C_FONT_NUM, fontSize: 10, color: C_TEXT_3 }}>
                <span>{(pct * 100).toFixed(0)}%</span>
                <span>{over ? `₹${cFmtK(spent - c.budget)} over` : `₹${cFmtK(c.budget - spent)} left`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Add tab ────────────────────────────────────────────────────────────────
function CompassAdd({ state, onDone, editing, onCancelEdit }) {
  const VARIABLE_BUDGETS = state.variableBudgets || window.ExpenseStore.VARIABLE_BUDGETS;
  const { PEOPLE } = window.ExpenseStore;
  const friendName = state.settings.friendName || 'Friend';
  const paidByOptions = [...PEOPLE, friendName];

  const initPerson = editing
    ? (editing.paidBy === 'friend' ? friendName : editing.person)
    : PEOPLE[0];

  const [amount, setAmount] = React.useState(editing ? String(editing.amount) : '');
  const [currency, setCurrency] = React.useState(editing ? editing.currency : 'CHF');
  const [category, setCategory] = React.useState(editing ? editing.category : (VARIABLE_BUDGETS[0]?.category ?? ''));
  const [person, setPerson] = React.useState(initPerson);
  const [note, setNote] = React.useState(editing ? editing.note : '');
  const [sharedWithFriend, setSharedWithFriend] = React.useState(
    editing ? !!editing.sharedWithFriend : initPerson === friendName
  );
  const [splitRatio, setSplitRatio] = React.useState(editing?.splitRatio || '50-50');

  const n = parseFloat(amount) || 0;
  const inr = currency === 'CHF' ? Math.round(n * state.settings.chfRate) : Math.round(n);
  const canSave = n > 0;

  const isFriendPaying = person === friendName;
  const paidBy = isFriendPaying ? 'friend' : 'us';
  const familyRatio = splitRatio === '75-25' ? 0.75 : splitRatio === '0-100' ? 0 : 0.5;
  const friendShare = Math.round(inr * (1 - familyRatio));
  const familyShare = Math.round(inr * familyRatio);
  const familyShareCHF = +(n * familyRatio).toFixed(2);
  const friendShareCHF = +(n * (1 - familyRatio)).toFixed(2);

  function handlePersonChange(p) {
    setPerson(p);
    if (p === friendName) setSharedWithFriend(true);
  }

  function save() {
    if (!canSave) return;
    const entry = { amount: n, currency, category, person, note, sharedWithFriend, paidBy, splitRatio };
    if (editing) {
      window.ExpenseStore.updateEntry(editing.id, entry);
    } else {
      window.ExpenseStore.addEntry(entry);
    }
    onDone();
  }

  return (
    <div style={{ padding: '4px 20px 30px' }}>
      {editing && (
        <div style={{
          padding: '10px 12px', marginBottom: 14, background: 'rgba(156,198,255,0.08)',
          border: `0.5px solid ${C_ACCENT}33`, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: C_ACCENT, fontWeight: 500 }}>Editing entry</span>
          <button onClick={onCancelEdit} style={{
            background: 'none', border: 0, color: C_ACCENT, fontSize: 12,
            cursor: 'pointer', fontWeight: 500,
          }}>Cancel</button>
        </div>
      )}

      {/* Amount big card */}
      <div style={{
        padding: '20px 18px 18px', background: C_BG_2, borderRadius: 18,
        border: `0.5px solid ${C_LINE}`,
      }}>
        <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Amount</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
          <span style={{ fontFamily: C_FONT_NUM, fontSize: 22, color: C_TEXT_2 }}>{currency === 'CHF' ? 'CHF' : '₹'}</span>
          <input
            inputMode="decimal" placeholder="0" value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            style={{
              flex: 1, fontFamily: C_FONT_NUM, fontSize: 40, fontWeight: 500,
              border: 0, outline: 0, background: 'transparent', color: C_TEXT,
              letterSpacing: '-0.02em', padding: 0, minWidth: 0, width: '100%',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontFamily: C_FONT_NUM, fontSize: 12, color: C_TEXT_2 }}>
            {n > 0 ? (currency === 'CHF' ? `≈ ₹ ${cFmt(inr)}` : `≈ CHF ${(n / state.settings.chfRate).toFixed(2)}`) : ' '}
          </span>
          <span style={{ fontFamily: C_FONT_NUM, fontSize: 10, color: C_TEXT_3 }}>@ {state.settings.chfRate} ₹/CHF</span>
        </div>

        {/* Currency segmented */}
        <div style={{
          marginTop: 14, display: 'flex', padding: 3, gap: 0,
          background: C_BG_3, borderRadius: 10, position: 'relative',
        }}>
          {['CHF', 'INR'].map(c => (
            <button key={c} onClick={() => setCurrency(c)} style={{
              flex: 1, padding: '8px 0', border: 0, cursor: 'pointer',
              background: currency === c ? C_BG_2 : 'transparent',
              boxShadow: currency === c ? '0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 14px rgba(0,0,0,0.4)' : 'none',
              color: currency === c ? C_TEXT : C_TEXT_3,
              fontFamily: C_FONT_UI, fontSize: 12, fontWeight: 600,
              borderRadius: 8, letterSpacing: '0.04em',
              transition: 'all .15s',
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Category chips */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Category</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {VARIABLE_BUDGETS.map(c => {
            const active = category === c.category;
            return (
              <button key={c.category} onClick={() => setCategory(c.category)} style={{
                padding: '8px 12px', border: `0.5px solid ${active ? C_TEXT : C_LINE_2}`,
                background: active ? C_TEXT : 'transparent',
                color: active ? C_BG : C_TEXT, borderRadius: 999,
                fontFamily: C_FONT_UI, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                transition: 'all .12s',
              }}>{c.category}</button>
            );
          })}
        </div>
      </div>

      {/* Person */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Paid by</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {paidByOptions.map(p => {
            const active = person === p;
            const isFriend = p === friendName;
            const activeColor = isFriend ? '#c8a8e9' : C_ACCENT;
            const activeBg = isFriend ? 'rgba(200,168,233,0.12)' : 'rgba(156,198,255,0.12)';
            return (
              <button key={p} onClick={() => handlePersonChange(p)} style={{
                padding: '10px 0', border: `0.5px solid ${active ? activeColor : C_LINE_2}`,
                background: active ? activeBg : C_BG_2,
                color: active ? activeColor : C_TEXT, borderRadius: 12,
                fontFamily: C_FONT_UI, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 999,
                  background: active ? activeColor : C_BG_3,
                  color: active ? C_BG : C_TEXT_2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>{p[0]}</div>
                <span>{p}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Note */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Note</div>
        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Optional — what was it for?" rows={2}
          style={{
            width: '100%', border: `0.5px solid ${C_LINE_2}`, outline: 0,
            background: C_BG_2, color: C_TEXT, padding: '10px 12px',
            fontFamily: C_FONT_UI, fontSize: 13, resize: 'none', borderRadius: 10,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Split section */}
      {isFriendPaying ? (
        <div style={{ marginTop: 18, padding: '14px', background: C_BG_2, borderRadius: 14, border: `0.5px solid #c8a8e955` }}>
          <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
            {friendName} paid · how much do we owe?
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['50-50','50-50'], ['75-25','75-25'], ['0-100','Full owe']].map(([r, lbl]) => (
              <button key={r} onClick={() => setSplitRatio(r)} style={{
                flex: 1, padding: '8px 0', border: `0.5px solid ${splitRatio === r ? '#c8a8e9' : C_LINE_2}`,
                background: splitRatio === r ? 'rgba(200,168,233,0.12)' : 'transparent',
                color: splitRatio === r ? '#c8a8e9' : C_TEXT_3,
                fontFamily: C_FONT_NUM, fontSize: 11, fontWeight: 600,
                borderRadius: 8, cursor: 'pointer',
              }}>{lbl}</button>
            ))}
          </div>
          {n > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: C_BG_3, borderRadius: 8, marginTop: 10 }}>
              {currency === 'CHF' ? (
                <>
                  <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_2 }}>We owe CHF {familyShareCHF.toFixed(2)} <span style={{ color: C_TEXT_3 }}>(₹{cFmt(familyShare)})</span></span>
                  <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_3 }}>·</span>
                  <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_2 }}>{friendName} CHF {friendShareCHF.toFixed(2)} <span style={{ color: C_TEXT_3 }}>(₹{cFmt(friendShare)})</span></span>
                </>
              ) : (
                <>
                  <span style={{ fontFamily: C_FONT_NUM, fontSize: 12, color: C_TEXT_2 }}>We owe ₹{cFmt(familyShare)}</span>
                  <span style={{ fontFamily: C_FONT_NUM, fontSize: 12, color: C_TEXT_3 }}>·</span>
                  <span style={{ fontFamily: C_FONT_NUM, fontSize: 12, color: C_TEXT_2 }}>{friendName} ₹{cFmt(friendShare)}</span>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 18, padding: '14px', background: C_BG_2, borderRadius: 14, border: `0.5px solid ${sharedWithFriend ? C_ACCENT + '55' : C_LINE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: sharedWithFriend ? C_ACCENT : C_TEXT }}>
              Split with {friendName}
            </span>
            <button type="button" onClick={() => setSharedWithFriend(v => !v)} style={{
              width: 36, height: 20, borderRadius: 999, border: 0, cursor: 'pointer',
              background: sharedWithFriend ? C_ACCENT : C_BG_3, position: 'relative',
              flexShrink: 0, transition: 'background .15s',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: sharedWithFriend ? 18 : 3,
                width: 14, height: 14, borderRadius: 999, background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left .15s',
              }} />
            </button>
          </div>
          {sharedWithFriend && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: C_TEXT_3, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Split (family : {friendName})</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['50-50', '75-25'].map(r => (
                    <button key={r} onClick={() => setSplitRatio(r)} style={{
                      flex: 1, padding: '8px 0', border: `0.5px solid ${splitRatio === r ? C_ACCENT : C_LINE_2}`,
                      background: splitRatio === r ? 'rgba(156,198,255,0.12)' : 'transparent',
                      color: splitRatio === r ? C_ACCENT : C_TEXT_3,
                      fontFamily: C_FONT_NUM, fontSize: 11, fontWeight: 600,
                      borderRadius: 8, cursor: 'pointer',
                    }}>{r}</button>
                  ))}
                </div>
              </div>
              {n > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: C_BG_3, borderRadius: 8 }}>
                  {currency === 'CHF' ? (
                    <>
                      <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_2 }}>Family CHF {familyShareCHF.toFixed(2)} <span style={{ color: C_TEXT_3 }}>(₹{cFmt(familyShare)})</span></span>
                      <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_3 }}>·</span>
                      <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_2 }}>{friendName} CHF {friendShareCHF.toFixed(2)} <span style={{ color: C_TEXT_3 }}>(₹{cFmt(friendShare)})</span></span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontFamily: C_FONT_NUM, fontSize: 12, color: C_TEXT_2 }}>Family ₹{cFmt(familyShare)}</span>
                      <span style={{ fontFamily: C_FONT_NUM, fontSize: 12, color: C_TEXT_3 }}>·</span>
                      <span style={{ fontFamily: C_FONT_NUM, fontSize: 12, color: C_TEXT_2 }}>{friendName} ₹{cFmt(friendShare)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button disabled={!canSave} onClick={save} style={{
        width: '100%', marginTop: 20, padding: '15px 0', border: 0, cursor: canSave ? 'pointer' : 'not-allowed',
        background: canSave ? C_TEXT : C_BG_3, color: canSave ? C_BG : C_TEXT_3,
        fontFamily: C_FONT_UI, fontSize: 14, fontWeight: 600, borderRadius: 14,
        letterSpacing: '0.02em',
      }}>{editing ? 'Save changes' : 'Add expense'}</button>
    </div>
  );
}

// ─── History ────────────────────────────────────────────────────────────────
function CompassHistory({ state, onEdit }) {
  const [expanded, setExpanded] = React.useState(null);
  const groups = {};
  state.entries.forEach(e => {
    const key = cFmtDate(e.ts);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  const keys = Object.keys(groups);

  if (state.entries.length === 0) {
    return (
      <div style={{ padding: '80px 30px', textAlign: 'center', color: C_TEXT_2 }}>
        <div style={{
          width: 48, height: 48, margin: '0 auto', borderRadius: 999,
          background: C_BG_2, border: `0.5px solid ${C_LINE_2}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: C_FONT_NUM, fontSize: 22, color: C_TEXT_3,
        }}>∅</div>
        <div style={{ fontSize: 14, marginTop: 14, fontWeight: 500 }}>No expenses yet</div>
        <div style={{ fontSize: 12, marginTop: 4, color: C_TEXT_3 }}>Tap the + below to record the first.</div>
      </div>
    );
  }

  function personColor(p) {
    return p === 'Asha' ? '#e89b7e' : p === 'Ajit' ? '#9cc6ff' : p === 'Nishant' ? '#b6e1a3' : '#c8a8e9';
  }

  return (
    <div style={{ padding: '4px 20px 30px' }}>
      {keys.map(k => {
        const dayTotal = groups[k].reduce((a, b) => a + b.amountINR, 0);
        return (
          <div key={k} style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              padding: '6px 0', marginBottom: 4,
            }}>
              <span style={{ fontSize: 11, color: C_TEXT_3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{k}</span>
              <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_3 }}>₹ {cFmt(dayTotal)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups[k].map(e => {
                const open = expanded === e.id;
                return (
                  <div key={e.id} style={{
                    background: C_BG_2, borderRadius: 12, border: `0.5px solid ${C_LINE}`,
                    overflow: 'hidden',
                  }}>
                    <button onClick={() => setExpanded(open ? null : e.id)} style={{
                      width: '100%', padding: '12px 14px', textAlign: 'left',
                      background: 'transparent', border: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 999,
                        background: personColor(e.person),
                        color: C_BG, fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>{e.person[0]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {e.note || e.category}
                          </span>
                          {e.sharedWithFriend && (
                            <span style={{
                              fontSize: 9, color: C_ACCENT, border: `0.5px solid ${C_ACCENT}`,
                              borderRadius: 4, padding: '1px 4px', flexShrink: 0, fontWeight: 600,
                              letterSpacing: '0.04em',
                            }}>split</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C_TEXT_3, marginTop: 2 }}>
                          {e.category} · {e.person}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: C_FONT_NUM, fontSize: 14, color: C_TEXT }}>₹{cFmt(e.amountINR)}</div>
                        {e.currency === 'CHF' && (
                          <div style={{ fontFamily: C_FONT_NUM, fontSize: 10, color: C_TEXT_3 }}>CHF {e.amount.toFixed(2)}</div>
                        )}
                      </div>
                    </button>
                    {open && (
                      <div style={{
                        display: 'flex', gap: 0, borderTop: `0.5px solid ${C_LINE}`,
                      }}>
                        <button onClick={() => onEdit(e)} style={{
                          flex: 1, padding: '11px 0', background: 'transparent', border: 0,
                          color: C_ACCENT, fontFamily: C_FONT_UI, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', borderRight: `0.5px solid ${C_LINE}`,
                        }}>Edit</button>
                        <button onClick={() => {
                          if (confirm('Delete this entry?')) window.ExpenseStore.deleteEntry(e.id);
                        }} style={{
                          flex: 1, padding: '11px 0', background: 'transparent', border: 0,
                          color: C_OVER, fontFamily: C_FONT_UI, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer',
                        }}>Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sync status dot ────────────────────────────────────────────────────────
function SyncDot() {
  const syncStatus = window.ExpenseStore.useSyncStatus();
  const MAP = {
    local:      { color: C_TEXT_3, title: 'Local only — no sheet connected' },
    connecting: { color: C_TEXT_3, title: 'Connecting to Google Sheets…' },
    syncing:    { color: C_ACCENT,  title: 'Syncing…' },
    ok:         { color: C_OK,      title: 'Synced with Google Sheets' },
    error:      { color: C_OVER,    title: 'Sync error — check connection' },
  };
  const { color, title } = MAP[syncStatus] || MAP.local;
  // Pulse animation for 'syncing'
  const pulse = syncStatus === 'syncing' || syncStatus === 'connecting';
  return (
    <span title={title} style={{
      width: 6, height: 6, borderRadius: 999, background: color, flexShrink: 0,
      animation: pulse ? 'syncPulse 1s ease-in-out infinite' : 'none',
    }} />
  );
}

// ─── App shell ──────────────────────────────────────────────────────────────
function CompassApp() {
  const state = window.ExpenseStore.useStore();
  const summary = window.ExpenseStore.summarize(state);
  const [tab, setTab] = React.useState('home');
  const [editing, setEditing] = React.useState(null);

  function startEdit(entry) { setEditing(entry); setTab('add'); }
  function finishEdit() { setEditing(null); setTab('history'); }

  const dot = summary.status === 'over' ? C_OVER : summary.status === 'warn' ? C_WARN : C_OK;

  return (
    <div style={compassStyles.shell}>
      <style>{`@keyframes syncPulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
      <div style={compassStyles.topbar}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>Switzerland</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <SyncDot />
              <span style={{ fontSize: 11, color: C_TEXT_3, fontFamily: C_FONT_NUM }}>25 Jun → 6 Jul · 3 travellers</span>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', background: C_BG_2, borderRadius: 999, border: `0.5px solid ${C_LINE_2}`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />
            <span style={{ fontFamily: C_FONT_NUM, fontSize: 11, color: C_TEXT_2 }}>{(summary.pct * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
      <div style={compassStyles.body}>
        {tab === 'home' && <CompassDashboard state={state} summary={summary} />}
        {tab === 'add' && <CompassAdd state={state} editing={editing} onDone={finishEdit} onCancelEdit={() => { setEditing(null); setTab('history'); }} />}
        {tab === 'history' && <CompassHistory state={state} onEdit={startEdit} />}
      </div>
      <div style={compassStyles.tabbar}>
        <TabBtn label="Home" icon="home" active={tab === 'home'} onClick={() => { setEditing(null); setTab('home'); }} />
        <button onClick={() => { setEditing(null); setTab('add'); }} style={{
          width: 48, height: 48, borderRadius: 999, border: 0, cursor: 'pointer',
          background: tab === 'add' ? C_ACCENT : C_TEXT, color: C_BG,
          fontSize: 22, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(156,198,255,0.3)',
        }}>+</button>
        <TabBtn label="History" icon="list" active={tab === 'history'} onClick={() => { setEditing(null); setTab('history'); }} />
      </div>
    </div>
  );
}

function TabBtn({ label, icon, active, onClick }) {
  const color = active ? C_TEXT : C_TEXT_3;
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '6px 0', background: 'transparent', border: 0, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      color, fontFamily: C_FONT_UI, fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {icon === 'home' && <path d="M3 11L12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />}
        {icon === 'list' && <><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" fill={color} /><circle cx="4" cy="12" r="1" fill={color} /><circle cx="4" cy="18" r="1" fill={color} /></>}
      </svg>
      <span>{label}</span>
    </button>
  );
}

Object.assign(window, { CompassApp });
