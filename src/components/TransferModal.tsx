import { useMemo, useState } from 'react';
import { useDB } from '../data/store';
import { api } from '../data/api';
import { deptName, me as selectMe, transfersThisMonth } from '../data/selectors';
import { fmt } from '../lib/utils';
import { Avatar, Button, Coin, Field, Modal, Progress, useAction } from './ui';
import { Search } from './icons';

/** Перевод коинов коллеге с месячным лимитом. */
export function TransferModal({ open, onClose, initialTo }: { open: boolean; onClose: () => void; initialTo?: string }) {
  const db = useDB();
  const u = selectMe(db)!;
  const [to, setTo] = useState<string | null>(initialTo ?? null);
  const [q, setQ] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const { run, busy } = useAction();
  const limit = db.settings.transferLimitMonth;
  const used = transfersThisMonth(db, u.id);
  const left = Math.max(0, Math.min(limit - used, u.coins));
  const target = to ? db.users.find((x) => x.id === to) : null;
  const people = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.users.filter((x) => x.id !== u.id && (!s || (x.name + ' ' + x.title + ' ' + deptName(db, x.deptId)).toLowerCase().includes(s))).sort((a, b) => a.name.localeCompare(b.name, 'ru')).slice(0, 30);
  }, [db, q, u.id]);
  const n = Number(amount);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!to) e.to = 'Выберите коллегу';
    if (!amount) e.amount = 'Введите сумму';
    else if (!Number.isInteger(n) || n <= 0) e.amount = 'Целое число коинов';
    else if (n > left) e.amount = left ? `Можно перевести не больше ${fmt(left)}` : 'Лимит на этот месяц исчерпан';
    setErr(e);
    if (Object.keys(e).length) return;
    const ok = await run('tr', () => api.transferCoins(to!, n, msg).then(() => true), `Переведено ${fmt(n)} коинов: ${target?.name}`);
    if (ok) { setAmount(''); setMsg(''); setTo(initialTo ?? null); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Перевести коины коллеге" subtitle={`Можно просто так или в знак уважения. Лимит: ${fmt(limit)} коинов в месяц`}
      footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button loading={busy === 'tr'} onClick={submit} disabled={!left} data-testid="transfer-submit">Перевести</Button></>}>
      <div className="col" style={{ gap: 14 }}>
        <div>
          <div className="row between small"><span className="muted">Использовано в этом месяце</span><span className="num"><b>{fmt(used)}</b> из {fmt(limit)} <Coin /></span></div>
          <div className="mt-8"><Progress value={limit ? used / limit : 1} tone="orange" thin label="Лимит переводов" /></div>
        </div>
        <Field label="Кому" error={err.to}>
          {target ? (
            <div className="row card soft pad-sm" style={{ borderRadius: 14 }}>
              <Avatar user={target} size={36} />
              <div className="grow"><b className="small">{target.name}</b><div className="xs muted">{target.title}, {deptName(db, target.deptId)}</div></div>
              <Button size="sm" variant="secondary" onClick={() => setTo(null)}>Изменить</Button>
            </div>
          ) : (
            <>
              <div className="input-wrap"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, должность или отдел" aria-label="Поиск коллеги" data-testid="transfer-search" /></div>
              <div className="pick-list mt-8" role="listbox" aria-label="Коллеги" style={{ maxHeight: 200 }}>
                {people.length ? people.map((p) => (
                  <button key={p.id} type="button" className="pick-item" role="option" aria-selected={false} onClick={() => { setTo(p.id); setErr((x) => ({ ...x, to: '' })); }}>
                    <Avatar user={p} size={28} /><span className="grow"><span className="small strong">{p.name}</span><div className="xs muted">{p.title} · {deptName(db, p.deptId)}</div></span>
                  </button>
                )) : <div className="empty small">Никого не нашли по запросу «{q}»</div>}
              </div>
            </>
          )}
        </Field>
        <Field label="Сколько коинов" error={err.amount} hint={left ? `Доступно сейчас: ${fmt(left)}` : 'В этом месяце больше переводить нельзя'} htmlFor="tr-amount">
          <div className="input-wrap"><input id="tr-amount" className={err.amount ? 'input err' : 'input'} style={{ paddingLeft: 14 }} inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '')); setErr((x) => ({ ...x, amount: '' })); }} placeholder="Например, 300" /><span className="input-suffix">коинов</span></div>
        </Field>
        <div className="chips">{[100, 300, 500].filter((v) => v <= left).map((v) => <button key={v} type="button" className="chip" onClick={() => setAmount(String(v))}>{v}</button>)}{left > 0 && <button type="button" className="chip" onClick={() => setAmount(String(left))}>Всё доступное</button>}</div>
        <Field label="Сообщение (необязательно)" hint={`${msg.length}/140`} htmlFor="tr-msg">
          <input id="tr-msg" className="input" maxLength={140} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Например: за помощь с отчётом" />
        </Field>
      </div>
    </Modal>
  );
}
