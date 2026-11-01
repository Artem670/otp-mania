import { useMemo } from 'react';
import { useDB } from '../../data/store';
import { managerKpi, me as selectMe } from '../../data/selectors';
import { ago, fmt, fmtNum, fmtPct, quarterLabel } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Coin, PageHeader, PageSkeleton, Progress, Stat, usePageLoading } from '../../components/ui';
import { BarChart, Donut } from '../../components/charts';
import { Award, Info, Scale, Target, Users } from '../../components/icons';
import { useRouter } from '../../lib/router';

export default function Kpi() {
  const db = useDB();
  const m = selectMe(db)!;
  const { navigate } = useRouter();
  const loading = usePageLoading('kpi');
  const k = useMemo(() => managerKpi(db, m.id), [db, m.id]);
  if (loading) return <PageSkeleton />;
  const scoreTone = k.score >= 0.8 ? 'green' : k.score >= 0.55 ? 'yellow' : 'red';
  const zero = k.perEmployee.filter((p) => p.amount === 0);
  const maxAmt = Math.max(1, ...k.perEmployee.map((p) => p.amount));
  return (
    <div className="stack-24">
      <PageHeader title="KPI руководителя" crumbs="Кабинет руководителя" subtitle={`${quarterLabel(Date.now())}. KPI учитывает не только объём, но и охват команды и равномерность признания.`}
        actions={<Button icon={Award} onClick={() => navigate('/manager/accrual')}>Начислить РуКоины</Button>} />
      <div className="grid g4">
        <Stat icon={Target} label="План начисления" value={<>{fmt(k.fund)} <Coin ru /></>} hint="фонд на квартал" />
        <Stat label="Начислено фактически" value={<>{fmt(k.used)} <Coin ru /></>} hint={`${fmtPct(k.planPct)} плана`} />
        <Stat icon={Users} label="Получили признание" value={`${k.recognized} из ${k.team.length}`} hint={`${fmtPct(k.notRecognizedShare)} команды ещё без РуКоинов`} />
        <Stat icon={Scale} label="Равномерность" value={fmtNum(k.evenness)} hint={`индекс Джини ${fmtNum(k.gini)}`} />
      </div>
      <div className="grid g-main">
        <Card title="Итоговый KPI" subtitle="40% выполнение плана + 30% охват команды + 30% равномерность">
          <div className="row row-wrap" style={{ gap: 28, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1 }} className="num" data-testid="kpi-score">{Math.round(k.score * 100)}%</div>
              <div className="mt-8"><Badge tone={scoreTone as 'green' | 'yellow' | 'red'}>{k.score >= 0.8 ? 'Отлично' : k.score >= 0.55 ? 'Есть куда расти' : 'Ниже нормы'}</Badge></div>
            </div>
            <div className="grow col" style={{ gap: 14, minWidth: 240 }}>
              {[
                { label: 'Выполнение плана', v: Math.min(1, k.planPct), w: '40%' },
                { label: 'Охват команды', v: k.coverage, w: '30%' },
                { label: 'Равномерность', v: k.evenness, w: '30%' },
              ].map((x) => (
                <div key={x.label}>
                  <div className="row between small mb-8"><span>{x.label} <span className="muted">· вес {x.w}</span></span><b className="num">{Math.round(x.v * 100)}%</b></div>
                  <Progress value={x.v} tone={x.v >= 0.8 ? 'green' : 'orange'} label={x.label} />
                </div>
              ))}
            </div>
          </div>
          <div className="alert small mt-16"><Info size={16} />Перевыполнение плана не добавляет баллов, а начисление всего фонда одному-двум людям снижает равномерность. Высокий KPI получают те, кто отмечает каждого по реальному вкладу.</div>
        </Card>
        <Card title="Распределение по категориям" subtitle="РуКоины текущего квартала">
          {k.cats.length ? <Donut data={k.cats} center={<div><div className="strong num">{fmt(k.used)}</div><div className="xs muted">РуКоинов</div></div>} /> : <p className="muted small">В этом квартале начислений ещё не было</p>}
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Динамика начислений" subtitle="РуКоины по месяцам, последние полгода">
          <BarChart data={k.months} highlightLast />
        </Card>
        <Card title="Признание по сотрудникам" subtitle="Кто сколько получил в этом квартале">
          {k.perEmployee.map((p) => (
            <div key={p.user.id} className="row" style={{ padding: '6px 0' }}>
              <Avatar user={p.user} size={28} />
              <div className="grow"><div className="row between small"><span className="ellipsis">{p.user.name}</span><b className="num">{fmt(p.amount)}</b></div>
                <div className="progress thin mt-4"><i style={{ width: `${(p.amount / maxAmt) * 100}%`, background: p.amount ? undefined : 'transparent' }} /></div></div>
            </div>
          ))}
          {zero.length > 0 && <div className="alert warn small mt-12"><Info size={16} /><span>Ещё не получили признание: {zero.map((z) => `${z.user.name} (${z.last ? `последнее ${ago(z.last)}` : 'ни разу'})`).join(', ')}.</span></div>}
        </Card>
      </div>
    </div>
  );
}
