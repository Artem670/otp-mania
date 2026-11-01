import { useDB } from '../../data/store';
import { managerQuarter, me as selectMe } from '../../data/selectors';
import { fmt, quarterLabel } from '../../lib/utils';
import { Button, Card, Coin, PageHeader, PageSkeleton, Progress, usePageLoading } from '../../components/ui';
import { Award, Ban, CircleCheck, CircleX, ListChecks, Scale } from '../../components/icons';
import { useRouter } from '../../lib/router';

/** Регламент: краткий блок можно встраивать прямо в форму начисления. */
export function RulesSummary() {
  const db = useDB();
  const s = db.settings;
  return (
    <div className="col" style={{ gap: 8 }}>
      {s.accrualCategories.map((c) => (
        <div key={c.id} className="row between small"><span>{c.name}</span><span className="num muted">{fmt(c.min ?? 0)}–{fmt(c.max ?? 0)}</span></div>
      ))}
    </div>
  );
}

export default function Rules() {
  const db = useDB();
  const m = selectMe(db)!;
  const { navigate } = useRouter();
  const loading = usePageLoading('rules', 250);
  const s = db.settings;
  const q = managerQuarter(db, m.id);
  if (loading) return <PageSkeleton />;
  return (
    <div className="stack-24">
      <PageHeader title="Регламент начисления РуКоинов" crumbs="Кабинет руководителя" subtitle="Короткая шпаргалка, чтобы сверяться прямо во время начисления."
        actions={<Button icon={Award} onClick={() => navigate('/manager/accrual')}>Перейти к начислению</Button>} />
      <div className="grid g3">
        <Card className="dark">
          <div className="muted small">Ваш фонд на {quarterLabel(Date.now())}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }} className="num mt-4">{fmt(q.fund)} <Coin ru /></div>
          <div className="mt-12"><Progress value={q.used / q.fund} tone="orange" label="Использовано" /></div>
          <div className="small muted mt-8">Выдано {fmt(q.used)}, осталось {fmt(q.left)}</div>
        </Card>
        <Card>
          <div className="muted small">Лимит одного начисления</div>
          <div style={{ fontSize: 28, fontWeight: 700 }} className="num mt-4">{fmt(s.maxPerAccrual)}</div>
          <div className="small muted mt-8">на одного сотрудника за раз</div>
        </Card>
        <Card>
          <div className="muted small">Лимит на сотрудника в месяц</div>
          <div style={{ fontSize: 28, fontWeight: 700 }} className="num mt-4">{fmt(s.maxPerEmployeeMonth)}</div>
          <div className="small muted mt-8">от всех руководителей вместе</div>
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Основания и рекомендуемые диапазоны">
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Основание</th><th>Когда использовать</th><th className="right">Диапазон</th></tr></thead>
            <tbody>{s.accrualCategories.map((c) => <tr key={c.id}><td className="strong">{c.name}</td><td className="small text-2">{c.description}</td><td className="right num nowrap">{fmt(c.min ?? 0)}–{fmt(c.max ?? 0)}</td></tr>)}</tbody>
          </table></div>
        </Card>
        <div className="stack-16">
          <Card title="Правила" action={<ListChecks size={18} />}>
            <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>{s.rules.map((r, i) => <li key={i}>{r}</li>)}</ol>
          </Card>
          <Card title="Ограничения" action={<Scale size={18} />}>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
              <li>Начислять можно только сотрудникам своего подразделения.</li>
              <li>Комментарий обязателен: не короче {s.minCommentLength} символов и без формулировок вроде «за работу».</li>
              <li>Фонд не переносится на следующий квартал.</li>
              <li>KPI считает выполнение плана, охват команды и равномерность.</li>
            </ul>
          </Card>
        </div>
      </div>
      <div className="grid g2">
        <Card title="Примеры комментариев">
          <div className="col" style={{ gap: 10 }}>
            {s.examples.map((e, i) => (
              <div key={i} className="grid g2" style={{ gap: 10 }}>
                <div className="alert small" style={{ background: 'var(--green-soft)' }}><CircleCheck size={16} color="var(--green)" />{e.good}</div>
                <div className="alert err small"><CircleX size={16} />{e.bad}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Запрещённые сценарии" action={<Ban size={18} />}>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>{s.forbidden.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <div className="alert info small mt-16">Система не наказывает автоматически: подозрительные паттерны уходят администратору на проверку.</div>
        </Card>
      </div>
    </div>
  );
}
