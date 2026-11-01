import { useMemo } from 'react';
import { useDB } from '../data/store';
import { api } from '../data/api';
import { me as selectMe, userById } from '../data/selectors';
import type { PulseQuestion } from '../data/types';
import { DAY } from '../lib/utils';
import { useAction } from './ui';

/** Короткий пульс-опрос (метрики B2 и «желанность наград»): по одному вопросу о последнем начислении и последней награде. */
export function PulseCard() {
  const db = useDB();
  const u = selectMe(db)!;
  const { run, busy } = useAction();
  const questions = useMemo(() => {
    const answered = new Set(db.pulses.filter((p) => p.userId === u.id).map((p) => p.q + ':' + p.refId));
    const out: { q: PulseQuestion; refId: string; title: string; text: string }[] = [];
    const acc = [...db.accruals].reverse().find((a) => a.employeeId === u.id && Date.now() - a.ts < 30 * DAY);
    if (acc && !answered.has('contribution:' + acc.id)) out.push({ q: 'contribution', refId: acc.id, title: 'Признание было про ваш вклад?', text: `${userById(db, acc.managerId)?.name ?? 'Руководитель'} начислил(а) ${acc.amount.toLocaleString('ru-RU')} РуКоинов: «${acc.comment}». Насколько это отражает то, что вы сделали?` });
    const ord = [...db.orders].reverse().find((o) => o.userId === u.id && !o.wheel && o.status === 'delivered' && Date.now() - o.ts < 60 * DAY);
    if (ord && !answered.has('desire:' + ord.id)) out.push({ q: 'desire', refId: ord.id, title: 'Насколько вам хотелось эту награду?', text: `${ord.items.map((i) => i.name).join(', ')}` });
    return out;
  }, [db, u.id]);
  if (!questions.length) return null;
  return (
    <section className="card accent" data-testid="pulse-card">
      <div className="row between row-wrap"><h3>Пульс за 10 секунд</h3><span className="xs muted">ответы помогают настроить программу</span></div>
      <div className="grid g2 mt-12">
        {questions.map((x) => (
          <div key={x.q} className="col" style={{ gap: 8 }}>
            <b>{x.title}</b>
            <span className="small text-2">{x.text}</span>
            <div className="pulse-q" role="group" aria-label={x.title}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" disabled={!!busy} onClick={() => run(x.q + s, () => api.answerPulse(x.q, x.refId, s), 'Спасибо за ответ!')} data-testid={`pulse-${x.q}-${s}`}>{s}</button>
              ))}
            </div>
            <span className="xs muted">1 совсем нет, 5 точно да</span>
          </div>
        ))}
      </div>
    </section>
  );
}
