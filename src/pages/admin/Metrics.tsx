import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { metricsTree, type Metric, type MetricStatus, type NorthStar } from '../../data/metrics';
import { Badge, Button, Card, PageHeader, PageSkeleton, usePageLoading } from '../../components/ui';
import { Settings as SettingsIcon } from '../../components/icons';
import { useRouter } from '../../lib/router';
import { cx } from '../../lib/utils';

const STATUS: Record<MetricStatus, { label: string; tone?: 'green' | 'yellow' | 'red' }> = {
  ok: { label: 'В цели', tone: 'green' },
  warn: { label: 'Близко', tone: 'yellow' },
  bad: { label: 'Вне цели', tone: 'red' },
  info: { label: 'Наблюдаем' },
};

function StatusBadge({ s }: { s: MetricStatus }) {
  return <Badge tone={STATUS[s].tone}>{STATUS[s].label}</Badge>;
}

function Code({ code, dark }: { code: string; dark?: boolean }) {
  return <span className={cx('m-code', dark && 'dark')}>{code}</span>;
}

/** Строка метрики-драйвера или диагностики. */
function MetricRow({ m }: { m: Metric }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="m-row" data-testid={`metric-${m.code}`}>
      <button type="button" className="m-row-main" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
        <Code code={m.code} />
        <span className="grow">
          <span className="m-name">{m.name}</span>
          {m.hint && <span className="xs muted m-hint">{m.hint}</span>}
        </span>
        <span className="m-val num">{m.display}</span>
        <StatusBadge s={m.status} />
      </button>
      {m.parts && (
        <div className="m-parts">
          <div className="m-stack" role="img" aria-label={m.parts.map((p) => `${p.label} ${Math.round(p.value * 100)}%`).join(', ')}>
            {m.parts.filter((p) => p.value > 0).map((p) => <i key={p.label} style={{ width: `${p.value * 100}%`, background: p.color }} title={`${p.label}: ${Math.round(p.value * 100)}%`} />)}
          </div>
          <div className="m-legend">
            {m.parts.map((p) => <span key={p.label} className="xs"><i style={{ background: p.color }} />{p.label} <b className="num">{Math.round(p.value * 100)}%</b></span>)}
          </div>
        </div>
      )}
      {open && (
        <div className="m-detail small">
          <div><span className="muted">Формула: </span>{m.formula}</div>
          {(m.target || m.baseline) && <div className="row-sm row-wrap mt-4">{m.target && <span><span className="muted">Цель: </span>{m.target}</span>}{m.baseline && <span><span className="muted">Сейчас в банке: </span>{m.baseline}</span>}</div>}
        </div>
      )}
    </div>
  );
}

function NorthStarCard({ ns }: { ns: NorthStar }) {
  const tone = ns.status === 'ok' ? 'var(--orange)' : ns.status === 'warn' ? '#f2b705' : ns.status === 'bad' ? 'var(--red)' : 'var(--muted)';
  return (
    <section className="card m-ns" data-testid={`metric-${ns.code}`}>
      <div className="m-ns-head">
        <div className="row-sm between">
          <Code code={ns.code} dark />
          <StatusBadge s={ns.status} />
        </div>
        <h3 className="mt-12">{ns.name}</h3>
        <div className="row between mt-8" style={{ alignItems: 'flex-end' }}>
          <div className="m-big num">{ns.display}</div>
          {ns.target && <div className="small muted" style={{ textAlign: 'right' }}>цель<br /><b className="text-2">{ns.target}</b></div>}
        </div>
        {ns.progress !== undefined && <div className="m-bar mt-12"><i style={{ width: `${Math.min(1, ns.progress) * 100}%`, background: tone }} /></div>}
        {ns.hint && <p className="xs muted mt-8">{ns.hint}</p>}
        <details className="m-formula xs mt-8"><summary>Как считаем</summary>{ns.formula}</details>
      </div>
      <div className="m-drivers">{ns.drivers.map((m) => <MetricRow key={m.code} m={m} />)}</div>
    </section>
  );
}

function ThresholdCard({ m }: { m: Metric }) {
  const max = m.target ? Number(m.target.replace(/[^\d,]/g, '').replace(',', '.')) / 100 : 0;
  const scale = Math.max(max * 2, m.value ?? 0, 0.01);
  return (
    <section className="card" data-testid={`metric-${m.code}`}>
      <div className="row-sm between"><Code code={m.code} /><StatusBadge s={m.status} /></div>
      <h3 className="mt-12">{m.name}</h3>
      <div className="row between mt-8" style={{ alignItems: 'flex-end' }}>
        <div className="m-big num" style={{ fontSize: 30 }}>{m.display}</div>
        <div className="small muted">порог <b className="text-2">{m.target}</b></div>
      </div>
      <div className="m-thr mt-12" aria-hidden="true">
        <i className={cx(m.status)} style={{ width: `${Math.min(1, (m.value ?? 0) / scale) * 100}%` }} />
        <b style={{ left: `${(max / scale) * 100}%` }} />
      </div>
      {m.hint && <p className="xs muted mt-8">{m.hint}</p>}
      <p className="xs muted mt-8">{m.formula}</p>
    </section>
  );
}

export default function Metrics() {
  const db = useDB();
  const { navigate } = useRouter();
  const loading = usePageLoading('metrics', 350);
  const t = useMemo(() => metricsTree(db), [db]);
  if (loading) return <PageSkeleton />;
  const all = [...t.northStars, ...t.northStars.flatMap((n) => n.drivers), ...t.thresholds, ...t.diagnostics.flatMap((g) => g.items)];
  const off = all.filter((m) => m.status === 'bad').length;

  return (
    <div className="stack-24">
      <PageHeader
        title="Метрики программы"
        crumbs="Администрирование"
        subtitle="Три целевые метрики, их драйверы, пороги злоупотреблений и диагностика. Нажмите на метрику, чтобы увидеть формулу."
        actions={<Button variant="secondary" icon={SettingsIcon} onClick={() => navigate('/admin/settings')}>Цели и пороги</Button>}
      />
      {off > 0 && <div className="alert warn small">Вне цели: {off} {off === 1 ? 'метрика' : off < 5 ? 'метрики' : 'метрик'}. Это повод разобраться, а не автоматический вывод о нарушении.</div>}

      <div className="grid g3 m-ns-grid">{t.northStars.map((ns) => <NorthStarCard key={ns.code} ns={ns} />)}</div>

      <div>
        <div className="row between mb-12"><h2>Пороги</h2><span className="small muted">Защита от накруток: превышение уходит в сигналы на проверку</span></div>
        <div className="grid g3">{t.thresholds.map((m) => <ThresholdCard key={m.code} m={m} />)}</div>
      </div>

      <div>
        <div className="row between mb-12"><h2>Диагностика</h2><span className="small muted">Помогают понять, почему двигаются целевые метрики</span></div>
        <div className="grid g3 m-diag">
          {t.diagnostics.map((g) => (
            <Card key={g.title} title={g.title} className="pad-sm">
              <div className="m-drivers flush">{g.items.map((m) => <MetricRow key={m.code} m={m} />)}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
