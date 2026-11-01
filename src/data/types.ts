// Модель данных ОТП Мания. Один источник правды для всех разделов.

export type Role = 'employee' | 'manager' | 'admin';
export type Currency = 'coins' | 'rucoins';

export interface Department {
  id: string;
  name: string;
  city: string;
  managerId: string | null;
}

export interface Pet {
  name: string;
  xp: number;
  fedAt: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  title: string;
  deptId: string;
  role: Role;
  coins: number;
  rucoins: number;
  color: string;
  avatar?: string;
  joinedAt: number;
  lastActiveAt: number;
  pet: Pet;
}

export type TxKind =
  | 'accrual'
  | 'conversion_out'
  | 'conversion_in'
  | 'order'
  | 'pool'
  | 'refund'
  | 'pet'
  | 'wheel';

export interface Tx {
  id: string;
  ts: number;
  userId: string;
  kind: TxKind;
  currency: Currency;
  amount: number; // + зачисление, − списание
  title: string;
  refId?: string;
}

export interface Accrual {
  id: string;
  ts: number;
  managerId: string;
  employeeId: string;
  amount: number;
  categoryId: string;
  comment: string;
}

export interface Conversion {
  id: string;
  ts: number;
  userId: string;
  rucoins: number;
  coins: number;
  rate: number;
}

export interface Thanks {
  id: string;
  ts: number;
  fromId: string;
  toId: string;
  categoryId: string;
  message: string;
}

export type ProductCategory =
  | 'clothes'
  | 'accessories'
  | 'electronics'
  | 'certificates'
  | 'merch'
  | 'experiences'
  | 'charity'
  | 'perks';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number; // в коинах
  costRub: number; // закупочная стоимость для банка
  stock: number;
  active: boolean;
  description: string;
  icon: string;
  tone: string;
  minLevel?: number; // уровень питомца, с которого товар доступен; если не задан, берётся по категории
  currency?: Currency; // за что продаётся: коины (по умолчанию) или РуКоины (нематериальные награды)
  limited?: boolean; // уникальная или лимитированная позиция (метрика C4)
  stockouts?: { from: number; to?: number }[]; // периоды, когда товара не было в наличии (метрика C3)
}

export type OrderStatus = 'new' | 'processing' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  costRub: number;
}

export interface Order {
  id: string;
  ts: number;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  csi?: number;
  wheel?: boolean; // приз из колеса удачи
  currency?: Currency; // списанная валюта, по умолчанию коины
}

export interface PoolContribution {
  userId: string;
  amount: number;
  ts: number;
}

export type PoolStatus = 'active' | 'completed' | 'cancelled';

export interface Pool {
  id: string;
  title: string;
  description: string;
  goal: string;
  target: number;
  deadline: number;
  scope: string; // 'all' или id подразделения
  organizerId: string;
  image: string; // id пресета или data URL
  contributions: PoolContribution[];
  status: PoolStatus;
  createdAt: number;
  kind?: PoolKind; // по умолчанию командный
}

/** Командный сбор (выезд, квиз, кофемашина) или благотворительный (банк удваивает собранное). */
export type PoolKind = 'team' | 'charity';
export const POOL_KIND_LABELS: Record<PoolKind, string> = { team: 'Для команды', charity: 'Благотворительность' };

export interface Notification {
  id: string;
  userId: string;
  ts: number;
  text: string;
  read: boolean;
  link?: string;
}

export interface EventItem {
  id: string;
  title: string;
  date: number;
  place: string;
  description: string;
  capacity: number;
  attendees: string[];
}

export interface NewsItem {
  id: string;
  ts: number;
  title: string;
  body: string;
  tag: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number;
  owner: string;
  due: string;
}

export interface Article {
  id: string;
  title: string;
  category: string;
  body: string;
}

export interface Category {
  id: string;
  name: string;
  min?: number;
  max?: number;
  description?: string;
  formal?: boolean; // формальная активность (метрика E3): посещение, обязательное обучение, опросы
}

/** Пульс-опрос сотрудника по шкале 1–5. */
export type PulseQuestion = 'contribution' | 'desire';
export interface Pulse {
  id: string;
  ts: number;
  userId: string;
  q: PulseQuestion; // contribution: «признание было про мой вклад», desire: желанность награды
  score: number;
  refId?: string; // начисление или заказ, о котором вопрос
}

/** Цели и пороги метрик программы. */
export interface MetricTargets {
  er: number; // Engagement rate, доля
  coverage: number; // A1 охват, доля
  csi: number; // CSI, из 5
  bankBudgetRub: number; // бюджет программы в масштабе банка, ₽
  mutualMax: number; // E1, доля
  top1Max: number; // E2, доля
  formalMax: number; // E3, доля
}

export interface Settings {
  conversionRate: number; // сколько коинов за 1 РуКоин
  coinCostRub: number; // стоимость 1 коина для банка, ₽
  budgetRub: number; // годовой бюджет программы, ₽
  quarterFundDefault: number; // фонд руководителя на квартал по умолчанию
  managerFunds: Record<string, number>;
  maxPerAccrual: number;
  maxPerEmployeeMonth: number;
  spinPrice: number; // цена прокрутки колеса, коинов
  spinLimit: number; // прокруток в месяц на человека
  wheelPrizes: WheelPrize[];
  metricTargets: MetricTargets;
  minCommentLength: number;
  accrualCategories: Category[];
  thanksCategories: Category[];
  rules: string[];
  forbidden: string[];
  examples: { good: string; bad: string }[];
}

export interface WheelPrize {
  id: string;
  name: string;
  short: string; // подпись на колесе
  prob: number; // вероятность, %
  costRub: number; // себестоимость для банка
  coins?: number; // если приз: возврат коинов
  digital?: boolean; // выдаётся сразу, без склада
}

export type SignalStatus = 'new' | 'review' | 'confirmed' | 'dismissed';

export interface CartLine {
  productId: string;
  qty: number;
}

export interface DB {
  version: number;
  seededAt: number;
  users: User[];
  departments: Department[];
  txs: Tx[];
  accruals: Accrual[];
  conversions: Conversion[];
  thanks: Thanks[];
  products: Product[];
  orders: Order[];
  pools: Pool[];
  notifications: Notification[];
  events: EventItem[];
  news: NewsItem[];
  goals: Goal[];
  articles: Article[];
  pulses: Pulse[];
  settings: Settings;
  signalStatus: Record<string, SignalStatus>;
  carts: Record<string, CartLine[]>;
  sessionUserId: string | null;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  clothes: 'Одежда',
  accessories: 'Аксессуары',
  electronics: 'Электроника',
  certificates: 'Сертификаты',
  merch: 'Мерч компании',
  experiences: 'Впечатления',
  charity: 'Благотворительность',
  perks: 'За РуКоины',
};

export const ROLE_LABELS: Record<Role, string> = {
  employee: 'Сотрудник',
  manager: 'Руководитель',
  admin: 'Администратор',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  processing: 'Собирается',
  delivered: 'Выдан',
  cancelled: 'Отменён',
};

export const POOL_STATUS_LABELS: Record<PoolStatus, string> = {
  active: 'Идёт сбор',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export const SIGNAL_STATUS_LABELS: Record<SignalStatus, string> = {
  new: 'Новый',
  review: 'На проверке',
  confirmed: 'Подтверждён',
  dismissed: 'Не нарушение',
};
