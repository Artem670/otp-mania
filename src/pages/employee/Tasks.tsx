import { useMemo, useState } from 'react';
import { useDB } from '../../data/store';
import { api, profileComplete } from '../../data/api';
import { COIN_RULES } from '../../data/seed';
import { me as selectMe } from '../../data/selectors';
import type { CoinRule } from '../../data/types';
import { useRouter } from '../../lib/router';
import { cx, fmt, fmtDate } from '../../lib/utils';
import { Avatar, Badge, Button, Card, Coin, Field, Modal, PageHeader, PageSkeleton, Progress, useAction, usePageLoading, useToast } from '../../components/ui';
import { Check, Upload } from '../../components/icons';
import { SendThanksForm } from './Thanks';

/** Сколько заданий новичка ещё не выполнено (для бейджа в меню). */
export function openTasksCount(db: ReturnType<typeof useDB>, userId: string) {
  const rules = (db.settings.coinRules ?? COIN_RULES).filter((r) => r.onboarding && r.amount > 0);
  return rules.filter((r) => !db.txs.some((t) => t.userId === userId && t.kind === 'bonus' && t.refId === r.id)).length;
}

const HOW_TEXT: Record<CoinRule['how'], string> = { auto: 'автоматически', hr: 'из HR-систем и LMS', manual: 'по решению администратора' };

export default function TasksPage() {
  const db = useDB();
  const u = selectMe(db)!;
  const loading = usePageLoading('tasks');
  const { navigate } = useRouter();
  const { run, busy } = useAction();
  const toast = useToast();
  const rules = db.settings.coinRules ?? COIN_RULES;
  const [profileOpen, setProfileOpen] = useState(false);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [petName, setPetName] = useState('');
  const got = useMemo(() => {
    const m = new Map<string, number>();
    db.txs.filter((t) => t.userId === u.id && t.kind === 'bonus' && t.refId).forEach((t) => m.set(t.refId!, Math.max(m.get(t.refId!) ?? 0, t.ts)));
    return m;
  }, [db, u.id]);
  const history = useMemo(() => db.txs.filter((t) => t.userId === u.id && t.kind === 'bonus').sort((a, b) => b.ts - a.ts), [db, u.id]);
  if (loading) return <PageSkeleton />;

  const onboarding = rules.filter((r) => r.onboarding && r.amount > 0);
  const events = rules.filter((r) => !r.onboarding && r.amount > 0);
  const done = onboarding.filter((r) => got.has(r.id));
  const left = onboarding.filter((r) => !got.has(r.id)).reduce((a, r) => a + r.amount, 0);
  const earned = history.reduce((a, t) => a + t.amount, 0);
  const pulsePending = db.accruals.some((a) => a.employeeId === u.id) || db.orders.some((o) => o.userId === u.id && o.status === 'delivered');

  const action = (r: CoinRule) => {
    switch (r.id) {
      case 'r-profile': return <Button size="sm" onClick={() => setProfileOpen(true)} data-testid="task-profile">Заполнить</Button>;
      case 'r-first-thanks': return <Button size="sm" onClick={() => setThanksOpen(true)} data-testid="task-thanks">Поблагодарить</Button>;
      case 'r-pet-name': return (
        <form className="row-sm" onSubmit={(e) => { e.preventDefault(); run('pet', () => api.renamePet(petName), `Питомца зовут ${petName.trim()}`).then(() => setPetName('')); }}>
          <input className="input" style={{ width: 150, height: 32 }} value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Имя питомца" maxLength={20} aria-label="Имя питомца" data-testid="task-pet-input" />
          <Button size="sm" type="submit" loading={busy === 'pet'} disabled={petName.trim().length < 2 || petName.trim() === u.pet.name}>Назвать</Button>
        </form>
      );
      case 'r-first-pulse': return pulsePending ? <Button size="sm" variant="secondary" onClick={() => navigate('/cabinet')}>К опросу</Button> : <span className="xs muted">появится после первого начисления или заказа</span>;
      default: return null;
    }
  };

  return (
    <div className="stack-24">
      <PageHeader title="Задания" subtitle="За первые шаги в программе и за события на работе начисляются коины. Каждое задание засчитывается автоматически, как только вы его выполнили." />

      <div className="card dark row row-wrap between" style={{ gap: 20 }}>
        <div>
          <div className="muted small">Первые шаги</div>
          <div style={{ fontSize: 28, fontWeight: 700 }} className="num" data-testid="tasks-progress">{done.length} из {onboarding.length}</div>
          <div className="muted small">{left > 0 ? <>ещё можно получить {fmt(left)} <Coin /></> : 'все задания выполнены'}</div>
        </div>
        <div className="grow" style={{ maxWidth: 420 }}>
          <Progress value={onboarding.length ? done.length / onboarding.length : 1} tone="orange" label="Прогресс заданий" />
          <div className="xs muted mt-8">Всего за задания и события получено {fmt(earned)} коинов</div>
        </div>
      </div>

      <Card title="Первые шаги" subtitle="Разовые задания для знакомства с программой">
        <div className="col" style={{ gap: 8 }}>
          {onboarding.map((r) => {
            const ts = got.get(r.id);
            return (
              <div key={r.id} className={cx('task-row', ts && 'done')} data-testid={`task-${r.id}`}>
                <span className={cx('check', ts && 'on')} style={{ borderRadius: '50%' }}>{ts && <Check size={13} />}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="small strong">{r.title}</span>
                  <div className="xs muted">{ts ? `выполнено ${fmtDate(ts)}` : r.id === 'r-profile' ? profileHint(u) : 'разово'}</div>
                </span>
                <span className="small strong num nowrap">+{fmt(r.amount)} <Coin /></span>
                {!ts && <span className="task-action">{action(r)}</span>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Коины за события" subtitle="Начисляются сами: из кадровой системы, системы обучения или от администратора программы">
        <table className="table">
          <thead><tr><th>Событие</th><th>Как начисляется</th><th className="right">Коинов</th></tr></thead>
          <tbody>
            {events.map((r) => (
              <tr key={r.id}>
                <td className="small">{r.title}{r.note && <div className="xs muted">{r.note}{r.once ? ', разово' : ''}</div>}{!r.note && r.once && <div className="xs muted">разово</div>}</td>
                <td className="small">{HOW_TEXT[r.how]}{r.id === 'r-birthday' && !u.birthday && <div><button className="link xs" onClick={() => setProfileOpen(true)}>указать дату рождения</button></div>}</td>
                <td className="right num">+{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="xs muted mt-8">За «спасибо» коины не начисляются: благодарности растят ваш рейтинг признания, который видит руководитель.</div>
      </Card>

      <Card title="История начислений">
        {!history.length ? <div className="empty small">Пока ничего. Начните с первых шагов выше.</div> : (
          <table className="table">
            <thead><tr><th>За что</th><th className="right">Коинов</th><th className="right">Когда</th></tr></thead>
            <tbody>{history.slice(0, 20).map((t) => <tr key={t.id}><td className="small">{t.title}</td><td className="right num">+{fmt(t.amount)}</td><td className="right xs muted">{fmtDate(t.ts)}</td></tr>)}</tbody>
          </table>
        )}
      </Card>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} onSaved={(b) => { setProfileOpen(false); if (b > 0) toast('success', `+${fmt(b)} коинов за заполненный профиль`); }} />}
      <Modal open={thanksOpen} onClose={() => setThanksOpen(false)} title="Поблагодарить коллегу" subtitle="Бесплатно. Благодарность увидит коллега и его руководитель">
        <SendThanksForm onSent={() => setThanksOpen(false)} compact />
      </Modal>
    </div>
  );
}

function profileHint(u: { avatar?: string; phone?: string; birthday?: string; about?: string }) {
  const miss = [!u.avatar && 'фото', !u.phone && 'телефон', !u.birthday && 'дата рождения', !(u.about && u.about.trim().length >= 10) && 'о себе'].filter(Boolean);
  return miss.length ? `осталось: ${miss.join(', ')}` : 'всё заполнено';
}

/** Форма профиля: фото, телефон, дата рождения, о себе. */
export function ProfileModal({ onClose, onSaved }: { onClose: () => void; onSaved: (bonus: number) => void }) {
  const db = useDB();
  const u = selectMe(db)!;
  const toast = useToast();
  const { run, busy } = useAction();
  const [avatar, setAvatar] = useState(u.avatar ?? '');
  const [phone, setPhone] = useState(u.phone ?? '');
  const [birthday, setBirthday] = useState(u.birthday ?? '');
  const [about, setAbout] = useState(u.about ?? '');
  const onPhoto = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('error', 'Нужен файл изображения: JPG или PNG');
    if (f.size > 1.5 * 1024 * 1024) return toast('error', 'Фото должно быть не больше 1,5 МБ');
    const r = new FileReader();
    r.onload = () => setAvatar(String(r.result));
    r.readAsDataURL(f);
  };
  const preview = { ...u, avatar: avatar || undefined };
  const already = db.txs.some((t) => t.userId === u.id && t.kind === 'bonus' && t.refId === 'r-profile');
  const filled = profileComplete({ ...u, avatar, phone, birthday, about });
  const save = async () => {
    const b = await run('profile', () => api.updateProfile({ avatar, phone, birthday, about }), 'Профиль сохранён');
    if (b !== undefined) onSaved(b);
  };
  return (
    <Modal open onClose={onClose} title="Профиль" subtitle="Коллеги увидят фото и «О себе», телефон и дата рождения нужны для связи и поздравлений"
      footer={<><Button variant="ghost" onClick={onClose}>Отмена</Button><Button loading={busy === 'profile'} onClick={save} data-testid="profile-save">Сохранить</Button></>}>
      <div className="col" style={{ gap: 14 }}>
        <label className="row-sm" style={{ cursor: 'pointer', alignItems: 'center' }}>
          <Avatar user={preview} size={64} />
          <span className="btn secondary sm"><Upload size={14} />{avatar ? 'Заменить фото' : 'Загрузить фото'}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} aria-label="Фото профиля" data-testid="profile-photo" />
        </label>
        <Field label="Телефон" htmlFor="pf-phone"><input id="pf-phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 000-00-00" /></Field>
        <Field label="Дата рождения" htmlFor="pf-bday" hint="В этот день придёт поздравление и коины"><input id="pf-bday" type="date" className="input" value={birthday} onChange={(e) => setBirthday(e.target.value)} max={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="О себе" htmlFor="pf-about" hint={`${about.trim().length}/300, минимум 10 символов`}><textarea id="pf-about" className="input" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} placeholder="Чем занимаетесь, что любите, в чём можете помочь коллегам" /></Field>
        {!already && <div className={cx('alert small', filled ? 'info' : '')}>{filled ? 'Всё заполнено: после сохранения начислим коины за задание' : 'Заполните все четыре поля, чтобы получить коины за задание'}</div>}
      </div>
    </Modal>
  );
}
