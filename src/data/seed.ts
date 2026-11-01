import type {
  Accrual, Article, Category, Conversion, DB, Department, EventItem, Goal, NewsItem, Order, Pool, Product, Settings, Thanks, Tx, User,
} from './types';
import { DAY, mulberry32, quarterStart } from '../lib/utils';
import { isUnlocked, pickPrize } from './selectors';

export const DB_VERSION = 6;
export const DEMO_PASSWORD = 'demo';

export const DEMO_ACCOUNTS = {
  employee: 'a.smirnov@mania.demo',
  manager: 'i.belova@mania.demo',
  admin: 's.yusupova@mania.demo',
} as const;

const COLORS = ['#9E6FC3', '#1F1F24', '#6E6E78', '#FF6A13', '#8E8E99', '#3A3A42', '#6E9E00', '#5B5B66'];

export const DEPTS: Omit<Department, 'managerId'>[] = [
  { id: 'retail', name: 'Розничный бизнес', city: 'Пермь' },
  { id: 'mortgage', name: 'Ипотечное кредитование', city: 'Москва' },
  { id: 'it', name: 'IT и цифровые сервисы', city: 'Москва' },
  { id: 'cc', name: 'Контакт-центр', city: 'Самара' },
  { id: 'risk', name: 'Риск-менеджмент', city: 'Москва' },
  { id: 'hr', name: 'HR и внутренние коммуникации', city: 'Москва' },
];

export const DEPTS_PUBLIC = DEPTS.map((d) => ({ id: d.id, name: d.name }));

// [имя, email-префикс, должность, подразделение, роль]
const PEOPLE: [string, string, string, string, User['role']][] = [
  ['Ирина Белова', 'i.belova', 'Руководитель отдела', 'retail', 'manager'],
  ['Алексей Смирнов', 'a.smirnov', 'Аналитик продаж', 'retail', 'employee'],
  ['Анна Котова', 'a.kotova', 'Старший аналитик', 'retail', 'employee'],
  ['Мария Сафина', 'm.safina', 'Менеджер по кредитам', 'retail', 'employee'],
  ['Денис Орлов', 'd.orlov', 'Клиентский менеджер', 'retail', 'employee'],
  ['Ольга Ким', 'o.kim', 'Клиентский менеджер', 'retail', 'employee'],
  ['Игорь Лебедев', 'i.lebedev', 'Специалист офиса', 'retail', 'employee'],
  ['Полина Гусева', 'p.guseva', 'Специалист офиса', 'retail', 'employee'],

  ['Олег Карпов', 'o.karpov', 'Руководитель направления', 'mortgage', 'manager'],
  ['Павел Зуев', 'p.zuev', 'Ипотечный брокер', 'mortgage', 'employee'],
  ['Екатерина Волкова', 'e.volkova', 'Ипотечный брокер', 'mortgage', 'employee'],
  ['Тимур Байрамов', 't.bayramov', 'Кредитный эксперт', 'mortgage', 'employee'],
  ['Светлана Морозова', 's.morozova', 'Кредитный эксперт', 'mortgage', 'employee'],
  ['Глеб Никитин', 'g.nikitin', 'Специалист по сделкам', 'mortgage', 'employee'],
  ['Юлия Соколова', 'y.sokolova', 'Специалист по сделкам', 'mortgage', 'employee'],

  ['Андрей Мельник', 'a.melnik', 'Руководитель разработки', 'it', 'manager'],
  ['Наталья Ершова', 'n.ershova', 'Frontend-разработчик', 'it', 'employee'],
  ['Руслан Гарипов', 'r.garipov', 'QA-инженер', 'it', 'employee'],
  ['Кирилл Фомин', 'k.fomin', 'Backend-разработчик', 'it', 'employee'],
  ['Дарья Ковалёва', 'd.kovaleva', 'Продуктовый дизайнер', 'it', 'employee'],
  ['Максим Егоров', 'm.egorov', 'DevOps-инженер', 'it', 'employee'],
  ['Вера Титова', 'v.titova', 'Системный аналитик', 'it', 'employee'],

  ['Роман Гаврилов', 'r.gavrilov', 'Руководитель контакт-центра', 'cc', 'manager'],
  ['Елена Захарова', 'e.zakharova', 'Старший оператор', 'cc', 'employee'],
  ['Артём Попов', 'a.popov', 'Оператор', 'cc', 'employee'],
  ['Ксения Белых', 'k.belykh', 'Оператор', 'cc', 'employee'],
  ['Никита Сорокин', 'n.sorokin', 'Оператор', 'cc', 'employee'],
  ['Алина Мухина', 'a.mukhina', 'Специалист по качеству', 'cc', 'employee'],
  ['Степан Ильин', 's.ilyin', 'Оператор', 'cc', 'employee'],

  ['Татьяна Крылова', 't.krylova', 'Руководитель риск-менеджмента', 'risk', 'manager'],
  ['Михаил Зайцев', 'm.zaytsev', 'Риск-аналитик', 'risk', 'employee'],
  ['Ольга Дмитриева', 'o.dmitrieva', 'Риск-аналитик', 'risk', 'employee'],
  ['Виктор Андреев', 'v.andreev', 'Специалист по взысканию', 'risk', 'employee'],
  ['Лариса Фёдорова', 'l.fedorova', 'Андеррайтер', 'risk', 'employee'],
  ['Евгений Новиков', 'e.novikov', 'Андеррайтер', 'risk', 'employee'],

  ['Светлана Юсупова', 's.yusupova', 'HR-бизнес-партнёр', 'hr', 'admin'],
  ['Мадина Алиева', 'm.alieva', 'Специалист по коммуникациям', 'hr', 'employee'],
  ['Георгий Лукин', 'g.lukin', 'Специалист по обучению', 'hr', 'employee'],
];

// Почти не пользуются системой: нужны для блока вовлечённости
const INACTIVE = new Set(['p.guseva', 'y.sokolova', 'v.titova', 's.ilyin', 'e.novikov']);

export const ACCRUAL_CATEGORIES: Category[] = [
  { id: 'help', name: 'Помощь коллегам', min: 1000, max: 3000, description: 'Подменил, помог разобраться, поддержал в сложный момент' },
  { id: 'hard', name: 'Выполнение сложной задачи', min: 3000, max: 8000, description: 'Результат выше плана или задача сверх обычной нагрузки' },
  { id: 'initiative', name: 'Инициативность', min: 2000, max: 6000, description: 'Предложил и сам внедрил улучшение' },
  { id: 'team', name: 'Достижение командных целей', min: 2000, max: 5000, description: 'Вклад в общий результат отдела' },
  { id: 'growth', name: 'Вклад в развитие компании', min: 3000, max: 8000, description: 'Наставничество, обучение, проекты на весь банк' },
];

export const THANKS_CATEGORIES: Category[] = [
  { id: 'help', name: 'Помог с задачей' },
  { id: 'client', name: 'Клиент доволен' },
  { id: 'mentor', name: 'Наставник' },
  { id: 'idea', name: 'Классная идея' },
  { id: 'support', name: 'Поддержал' },
  { id: 'team', name: 'Командный игрок' },
];

const COMMENTS: Record<string, string[]> = {
  help: ['Подменил коллегу на выдаче в загруженный день', 'Помог новичку разобраться с CRM за два дня', 'Взял на себя сложного клиента и закрыл обращение', 'Помогла соседнему отделу с выгрузкой к дедлайну'],
  hard: ['Перевыполнил план по кредитным картам на 18%', 'Закрыл сложную сделку с нестандартным залогом', 'Довёл релиз до продакшена без единого инцидента', 'Разобрал просроченный портфель на 40 договоров'],
  initiative: ['Автоматизировал сверку: минус 6 часов ручной работы в неделю', 'Предложил новый скрипт звонка, конверсия выросла на 9%', 'Собрал дашборд по оттоку клиентов для всего отдела', 'Запустил чек-лист проверки заявок, ошибок стало вдвое меньше'],
  team: ['Отдел закрыл квартальный план, вклад в ключевые сделки', 'Команда вышла на NPS 72, личный вклад в обработку жалоб', 'Сдали проект миграции в срок, ключевая роль в тестировании'],
  growth: ['Провёл три обучающих сессии для новых сотрудников', 'Наставник для двух стажёров, оба вышли на план', 'Выступил на внутренней конференции с кейсом отдела'],
};

const THANKS_MESSAGES = [
  'Спасибо, что выручил с отчётом, без тебя бы не успели',
  'Огромное спасибо за помощь со сложным клиентом!',
  'Благодарю за терпение и подробные объяснения',
  'Твоя идея с шаблоном сэкономила нам неделю',
  'Спасибо, что подменила в пятницу',
  'Классно провёл встречу, всё стало понятно',
  'Спасибо за поддержку в запуске проекта',
  'Без тебя релиз бы точно сдвинулся. Спасибо!',
];

export const PRODUCTS: Product[] = [
  { id: 'p-hoodie', name: 'Худи «Мания»', category: 'clothes', price: 9000, costRub: 1500, stock: 40, active: true, description: 'Плотный хлопок, свободный крой, вышивка на груди. Размеры XS–XXL.', icon: 'shirt', tone: '#9E6FC3' },
  { id: 'p-tee', name: 'Футболка базовая', category: 'clothes', price: 3500, costRub: 600, stock: 120, active: true, description: 'Хлопок 100%, минималистичный принт на спине.', icon: 'shirt', tone: '#1F1F24' },
  { id: 'p-jacket', name: 'Флисовая куртка', category: 'clothes', price: 14000, costRub: 2600, stock: 25, active: true, description: 'Тёплая куртка на молнии для офиса и прогулок.', icon: 'snowflake', tone: '#6E6E78' },
  { id: 'p-beanie', name: 'Шапка-бини', category: 'clothes', price: 2500, costRub: 400, stock: 60, active: true, description: 'Мягкая вязка, нашивка с логотипом программы.', icon: 'snowflake', tone: '#FF6A13' },
  { id: 'p-mug', name: 'Термокружка 400 мл', category: 'accessories', price: 2800, costRub: 450, stock: 90, active: true, description: 'Держит тепло до 6 часов, подходит для кофемашины.', icon: 'coffee', tone: '#6E9E00' },
  { id: 'p-backpack', name: 'Рюкзак для ноутбука', category: 'accessories', price: 8500, costRub: 1600, stock: 35, active: true, description: 'Отделение под ноутбук 16", карман для зарядки, влагозащита.', icon: 'backpack', tone: '#1F1F24' },
  { id: 'p-umbrella', name: 'Зонт-автомат', category: 'accessories', price: 3200, costRub: 550, stock: 50, active: true, description: 'Купол 105 см, система антиветер.', icon: 'umbrella', tone: '#8E8E99' },
  { id: 'p-shopper', name: 'Шоппер', category: 'accessories', price: 1500, costRub: 250, stock: 150, active: true, description: 'Плотный хлопок, внутренний карман.', icon: 'shoppingbag', tone: '#9E6FC3' },
  { id: 'p-headphones', name: 'Беспроводные наушники', category: 'electronics', price: 24000, costRub: 4200, stock: 12, active: true, description: 'Шумоподавление, до 30 часов работы.', icon: 'headphones', tone: '#3A3A42' },
  { id: 'p-powerbank', name: 'Пауэрбанк 10 000 мА·ч', category: 'electronics', price: 6000, costRub: 1100, stock: 45, active: true, description: 'Быстрая зарядка, два порта USB-C.', icon: 'battery', tone: '#FF6A13' },
  { id: 'p-speaker', name: 'Портативная колонка', category: 'electronics', price: 12000, costRub: 2300, stock: 18, active: true, description: 'Защита от воды IP67, 12 часов музыки.', icon: 'speaker', tone: '#6E6E78' },
  { id: 'p-watch', name: 'Фитнес-браслет', category: 'electronics', price: 15000, costRub: 2700, stock: 20, active: true, description: 'Пульс, сон, шаги и уведомления.', icon: 'watch', tone: '#1F1F24' },
  { id: 'p-cert-mp', name: 'Сертификат на маркетплейс, 1 000 ₽', category: 'certificates', price: 5000, costRub: 1000, stock: 999, active: true, description: 'Электронный код придёт на рабочую почту.', icon: 'gift', tone: '#9E6FC3' },
  { id: 'p-cert-sport', name: 'Сертификат в спортзал, 3 000 ₽', category: 'certificates', price: 15000, costRub: 3000, stock: 999, active: true, description: 'Сеть фитнес-клубов в городах присутствия банка.', icon: 'dumbbell', tone: '#3A3A42' },
  { id: 'p-cert-books', name: 'Сертификат в книжный, 1 000 ₽', category: 'certificates', price: 5000, costRub: 1000, stock: 999, active: true, description: 'Бумажные и электронные книги.', icon: 'book', tone: '#6E9E00' },
  { id: 'p-cert-cinema', name: 'Сертификат в кино, 500 ₽', category: 'certificates', price: 2500, costRub: 500, stock: 999, active: true, description: 'Два билета на любой сеанс.', icon: 'film', tone: '#8E8E99' },
  { id: 'p-toy', name: 'Игрушка ОТуПик', category: 'merch', price: 2000, costRub: 350, stock: 80, active: true, description: 'Мягкая игрушка для детей сотрудников.', icon: 'baby', tone: '#9E6FC3', minLevel: 2 },
  { id: 'p-stickers', name: 'Набор стикеров', category: 'merch', price: 600, costRub: 80, stock: 300, active: true, description: '12 виниловых стикеров для ноутбука.', icon: 'sticker', tone: '#FF6A13' },
  { id: 'p-notebook', name: 'Блокнот в точку', category: 'merch', price: 1200, costRub: 200, stock: 140, active: true, description: 'Формат A5, 160 страниц, твёрдая обложка.', icon: 'notebook', tone: '#1F1F24' },
  { id: 'p-pet', name: 'Набор для питомца', category: 'merch', price: 1800, costRub: 300, stock: 60, active: true, description: 'Миска и бандана с принтом программы.', icon: 'paw', tone: '#6E6E78' },
  { id: 'p-dayoff', name: 'Дополнительный выходной', category: 'experiences', price: 12000, costRub: 0, stock: 999, active: true, description: 'Согласуется с руководителем. Не чаще раза в квартал.', icon: 'palm', tone: '#6E9E00' },
  { id: 'p-lunch', name: 'Обед с членом правления', category: 'experiences', price: 40000, costRub: 0, stock: 4, active: true, description: 'Неформальная встреча, 4 места в квартал.', icon: 'utensils', tone: '#1F1F24' },
  { id: 'p-masterclass', name: 'Мастер-класс по выбору', category: 'experiences', price: 7000, costRub: 1200, stock: 30, active: true, description: 'Гончарный, кулинарный или фото.', icon: 'sparkles', tone: '#FF6A13' },
  { id: 'p-ski', name: 'Выезд на горнолыжку с командой', category: 'experiences', price: 80000, costRub: 15000, stock: 6, active: true, description: 'Выходные на курорте для команды до 6 человек.', icon: 'mountain', tone: '#3A3A42' },
];

const SETTINGS: Settings = {
  conversionRate: 1,
  coinCostRub: 0.2,
  budgetRub: 450_000,
  quarterFundDefault: 100_000,
  managerFunds: {},
  maxPerAccrual: 8000,
  maxPerEmployeeMonth: 15000,
  minCommentLength: 20,
  spinPrice: 1000,
  spinLimit: 20,
  wheelPrizes: [
    { id: 'w-badge', name: 'Бейдж или рамка в профиле', short: 'Бейдж', prob: 28, costRub: 0, digital: true },
    { id: 'w-stickers', name: 'Значок или стикерпак ОТуПик', short: 'Стикерпак', prob: 21, costRub: 40 },
    { id: 'w-back', name: 'Возврат 500 коинов', short: '+500 коинов', prob: 15, costRub: 0, coins: 500 },
    { id: 'w-early', name: 'Ранний доступ к следующему дропу', short: 'Ранний доступ', prob: 15, costRub: 0, digital: true },
    { id: 'w-remote', name: 'День удалёнки', short: 'Удалёнка', prob: 5, costRub: 0, digital: true },
    { id: 'w-cashback', name: 'Повышенный кэшбек на категорию на месяц', short: 'Кэшбек', prob: 5, costRub: 500, digital: true },
    { id: 'w-late', name: 'Поздний приход или ранний уход', short: 'Поздний приход', prob: 5, costRub: 0, digital: true },
    { id: 'w-toy', name: 'Игрушка ОТуПик', short: 'Игрушка', prob: 5, costRub: 350 },
    { id: 'w-dayoff', name: 'Дополнительный выходной', short: 'Выходной', prob: 0.8, costRub: 0, digital: true },
    { id: 'w-hoodie', name: 'Джекпот: лимитированное худи ОТуПик', short: 'Худи', prob: 0.1, costRub: 2500 },
    { id: 'w-cert', name: 'Джекпот: сертификат 1 000 ₽ на выбор', short: 'Сертификат', prob: 0.1, costRub: 1000, digital: true },
  ],
  accrualCategories: ACCRUAL_CATEGORIES,
  thanksCategories: THANKS_CATEGORIES,
  rules: [
    'Начисляйте за конкретный результат и пишите, что именно сделал сотрудник.',
    'Используйте рекомендованный диапазон категории. Верхняя граница для действительно выдающегося вклада.',
    'Распределяйте фонд в течение квартала, а не в последние дни.',
    'Старайтесь отметить каждого, кто внёс вклад: KPI учитывает охват и равномерность.',
    'Сверяйтесь с рейтингом благодарностей: он подсказывает, кого отмечают коллеги.',
  ],
  forbidden: [
    'Начисления «по кругу» одним и тем же людям без новых результатов.',
    'Массовые одинаковые начисления всей команде ради выполнения плана.',
    'Начисления без комментария или с формальным текстом «за работу».',
    'Перераспределение фонда по договорённости с сотрудником.',
    'Начисление родственникам и себе через подставных лиц.',
  ],
  examples: [
    { good: 'Автоматизировал сверку платежей: минус 6 часов ручной работы в неделю для всего отдела.', bad: 'За работу.' },
    { good: 'Взял три смены коллеги на больничном, план офиса выполнен на 104%.', bad: 'Молодец, так держать.' },
  ],
};

const NEWS: Omit<NewsItem, 'ts'>[] = [
  { id: 'n1', title: 'Обновлённая ОТП Мания: две валюты и новый магазин', body: 'Теперь руководители отмечают вклад РуКоинами, а коины можно тратить в обновлённом магазине. Благодарности коллегам стали бесплатными и формируют рейтинг признания.', tag: 'Программа' },
  { id: 'n2', title: 'Зимний дроп мерча: худи, шапки и термокружки', body: 'Новая коллекция появится в магазине 15 ноября. Количество ограничено.', tag: 'Магазин' },
  { id: 'n3', title: 'Итоги третьего квартала', body: 'Банк выполнил план по розничному кредитованию на 107%. Спасибо каждой команде за вклад.', tag: 'Банк' },
  { id: 'n4', title: 'Стартовал сбор на подарки для приюта', body: 'Присоединяйтесь к благотворительному сбору: каждые 1 000 коинов превращаются в 200 ₽ для фонда.', tag: 'Сборы' },
  { id: 'n5', title: 'Новый курс по клиентскому сервису', body: 'В базе знаний доступен курс из 6 уроков. Прохождение засчитывается в развитие.', tag: 'Обучение' },
];

const GOALS: Goal[] = [
  { id: 'g1', title: 'Клиентоцентричность', description: 'NPS розничного бизнеса не ниже 70 пунктов', progress: 0.82, owner: 'Розничный бизнес', due: 'Декабрь 2026' },
  { id: 'g2', title: 'Цифровые продажи', description: '45% продаж кредитных продуктов через мобильное приложение', progress: 0.64, owner: 'IT и цифровые сервисы', due: 'Декабрь 2026' },
  { id: 'g3', title: 'Качество портфеля', description: 'Доля просрочки 90+ ниже 4,5%', progress: 0.71, owner: 'Риск-менеджмент', due: 'Декабрь 2026' },
  { id: 'g4', title: 'Вовлечённость сотрудников', description: '80% сотрудников активно пользуются программой признания', progress: 0.58, owner: 'HR', due: 'Март 2027' },
];

const ARTICLES: Article[] = [
  { id: 'kb1', title: 'Как работают коины и РуКоины', category: 'ОТП Мания', body: 'РуКоины начисляет руководитель за вклад в работу. Их можно конвертировать в коины по курсу из настроек программы. Коины тратятся в магазине, на питомца и на сборы с коллегами.' },
  { id: 'kb2', title: 'Регламент начисления РуКоинов', category: 'ОТП Мания', body: 'Начисление делается с указанием категории и комментария. Для каждой категории есть рекомендованный диапазон. Действуют лимиты на одно начисление и на сотрудника в месяц.' },
  { id: 'kb3', title: 'Как оформить заказ в магазине', category: 'ОТП Мания', body: 'Добавьте товары в корзину и нажмите «Оформить заказ». Система проверит баланс и спишет коины. Электронные сертификаты приходят на почту, физические товары выдаются в офисе.' },
  { id: 'kb4', title: 'Правила корпоративных сборов', category: 'ОТП Мания', body: 'Сбор создаёт руководитель. Если сбор отменён, коины возвращаются участникам полностью.' },
  { id: 'kb5', title: 'Оформление отпуска', category: 'Кадры', body: 'Заявление подаётся через портал не позднее чем за 14 дней до начала отпуска.' },
  { id: 'kb6', title: 'Информационная безопасность: 10 правил', category: 'Безопасность', body: 'Не передавайте пароли, блокируйте компьютер, проверяйте отправителя писем.' },
];

function buildEvents(now: number): EventItem[] {
  return [
    { id: 'ev1', title: 'Новогодний корпоратив', date: now + 46 * DAY, place: 'Москва, лофт «Цех»', description: 'Ужин, музыка и награждение героев года.', capacity: 300, attendees: [] },
    { id: 'ev2', title: 'Хакатон «Цифровой банк»', date: now + 18 * DAY, place: 'Онлайн', description: '48 часов, команды до 5 человек. Победители получают РуКоины.', capacity: 120, attendees: [] },
    { id: 'ev3', title: 'Забег «Зелёный марафон»', date: now + 9 * DAY, place: 'Пермь, набережная', description: 'Дистанции 5 и 10 км, футболки участникам.', capacity: 80, attendees: [] },
    { id: 'ev4', title: 'Лекция о финансовой грамотности', date: now + 4 * DAY, place: 'Онлайн', description: 'Как устроены вклады, кредиты и инвестиции.', capacity: 500, attendees: [] },
  ];
}

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const round100 = (n: number) => Math.round(n / 100) * 100;

export function createSeed(now = Date.now()): DB {
  const r = mulberry32(20261101);
  const START = new Date(new Date(now - 240 * DAY).setHours(0, 0, 0, 0)).getTime();
  let n = 0;
  const id = (p: string) => `${p}${(++n).toString(36)}`;

  const users: User[] = PEOPLE.map(([name, mail, title, deptId, role], i) => ({
    id: mail.replace('.', '_'),
    name,
    email: `${mail}@mania.demo`,
    password: DEMO_PASSWORD,
    title,
    deptId,
    role,
    coins: 0,
    rucoins: 0,
    color: COLORS[i % COLORS.length],
    joinedAt: START - Math.floor(r() * 900) * DAY,
    lastActiveAt: START,
    pet: { name: 'Пятак', xp: Math.round((r() * r() * 26000) / 100) * 100, fedAt: START },
  }));
  const U = (mail: string) => users.find((u) => u.email.startsWith(mail + '@'))!;
  const inactive = new Set(users.filter((u) => INACTIVE.has(u.email.split('@')[0])).map((u) => u.id));

  const departments: Department[] = DEPTS.map((d) => ({
    ...d,
    managerId: users.find((u) => u.deptId === d.id && u.role === 'manager')?.id ?? null,
  }));
  const teamOf = (deptId: string) => users.filter((u) => u.deptId === deptId && u.role !== 'manager');

  const txs: Tx[] = [];
  const accruals: Accrual[] = [];
  const conversions: Conversion[] = [];
  const thanks: Thanks[] = [];
  const orders: Order[] = [];
  const products = PRODUCTS.map((p) => ({ ...p }));

  const touch = (u: User, ts: number) => { if (ts > u.lastActiveAt) u.lastActiveAt = ts; };

  const accrue = (m: User, e: User, ts: number, categoryId: string, amount: number, comment?: string) => {
    const cat = ACCRUAL_CATEGORIES.find((c) => c.id === categoryId)!;
    const a: Accrual = { id: id('ac'), ts, managerId: m.id, employeeId: e.id, amount, categoryId, comment: comment ?? pick(r, COMMENTS[categoryId]) };
    accruals.push(a);
    e.rucoins += amount;
    txs.push({ id: id('tx'), ts, userId: e.id, kind: 'accrual', currency: 'rucoins', amount, title: `${cat.name}: ${m.name}`, refId: a.id });
    touch(m, ts);
  };

  const convert = (u: User, ts: number, ru: number) => {
    if (ru <= 0 || u.rucoins < ru) return;
    const coins = ru * SETTINGS.conversionRate;
    const c: Conversion = { id: id('cv'), ts, userId: u.id, rucoins: ru, coins, rate: SETTINGS.conversionRate };
    conversions.push(c);
    u.rucoins -= ru; u.coins += coins;
    txs.push({ id: id('tx'), ts, userId: u.id, kind: 'conversion_out', currency: 'rucoins', amount: -ru, title: 'Конвертация в коины', refId: c.id });
    txs.push({ id: id('tx'), ts, userId: u.id, kind: 'conversion_in', currency: 'coins', amount: coins, title: 'Конвертация из РуКоинов', refId: c.id });
    touch(u, ts);
  };

  const buy = (u: User, ts: number, p: Product, qty = 1) => {
    const total = p.price * qty;
    if (u.coins < total || p.stock < qty) return;
    const age = (now - ts) / DAY;
    const status: Order['status'] = age > 10 ? (r() < 0.06 ? 'cancelled' : 'delivered') : age > 3 ? 'processing' : 'new';
    const o: Order = { id: id('or'), ts, userId: u.id, items: [{ productId: p.id, name: p.name, qty, price: p.price, costRub: p.costRub }], total, status };
    if (status === 'delivered') o.csi = r() < 0.75 ? 5 : r() < 0.7 ? 4 : 3;
    orders.push(o);
    u.coins -= total; p.stock -= qty;
    txs.push({ id: id('tx'), ts, userId: u.id, kind: 'order', currency: 'coins', amount: -total, title: `Заказ: ${p.name}`, refId: o.id });
    if (status === 'cancelled') {
      u.coins += total; p.stock += qty;
      txs.push({ id: id('tx'), ts: ts + DAY, userId: u.id, kind: 'refund', currency: 'coins', amount: total, title: `Возврат за отменённый заказ`, refId: o.id });
    }
    touch(u, ts);
  };

  const feedPet = (u: User, ts: number, cost: number, xp: number) => {
    if (u.coins < cost) return;
    u.coins -= cost; u.pet.xp += xp; u.pet.fedAt = ts;
    txs.push({ id: id('tx'), ts, userId: u.id, kind: 'pet', currency: 'coins', amount: -cost, title: 'Питомец: уход' });
    touch(u, ts);
  };

  const sayThanks = (from: User, to: User, ts: number) => {
    thanks.push({ id: id('th'), ts, fromId: from.id, toId: to.id, categoryId: pick(r, THANKS_CATEGORIES).id, message: pick(r, THANKS_MESSAGES) });
    touch(from, ts);
  };

  // Сборы
  const pools: Pool[] = [
    { id: 'pool1', title: 'Кофемашина на третий этаж', description: 'Общая кофемашина для отдела розничного бизнеса.', goal: 'Купить кофемашину с капучинатором', target: 120000, deadline: now + 20 * DAY, scope: 'retail', organizerId: U('i.belova').id, image: 'coffee', contributions: [], status: 'active', createdAt: now - 25 * DAY },
    { id: 'pool2', title: 'Подарки приюту для собак', description: 'Благотворительный сбор всего банка. Корм, лежанки и лекарства.', goal: 'Передать приюту подарки к Новому году', target: 150000, deadline: now + 35 * DAY, scope: 'all', organizerId: U('s.yusupova').id, image: 'heart', contributions: [], status: 'active', createdAt: now - 30 * DAY },
    { id: 'pool3', title: 'Командный квест после релиза', description: 'Отмечаем запуск нового мобильного банка.', goal: 'Квест-комната для команды из 7 человек', target: 60000, deadline: now + 12 * DAY, scope: 'it', organizerId: U('a.melnik').id, image: 'party', contributions: [], status: 'active', createdAt: now - 14 * DAY },
    { id: 'pool4', title: 'Подарок Елене на юбилей', description: 'Совместный подарок старшему оператору.', goal: 'Сертификат в SPA', target: 30000, deadline: now - 40 * DAY, scope: 'cc', organizerId: U('r.gavrilov').id, image: 'gift', contributions: [], status: 'completed', createdAt: now - 70 * DAY },
    { id: 'pool5', title: 'Настольные игры в комнату отдыха', description: 'Пополняем полку настолок.', goal: 'Пять новых игр', target: 40000, deadline: now - 15 * DAY, scope: 'mortgage', organizerId: U('o.karpov').id, image: 'game', contributions: [], status: 'cancelled', createdAt: now - 60 * DAY },
    { id: 'pool6', title: 'Тимбилдинг на природе', description: 'Летний выезд риск-менеджмента.', goal: 'Аренда базы на день', target: 80000, deadline: now - 100 * DAY, scope: 'risk', organizerId: U('t.krylova').id, image: 'trees', contributions: [], status: 'completed', createdAt: now - 150 * DAY },
  ];
  const contribute = (u: User, p: Pool, ts: number, amount: number) => {
    if (u.coins < amount) return;
    u.coins -= amount;
    p.contributions.push({ userId: u.id, amount, ts });
    txs.push({ id: id('tx'), ts, userId: u.id, kind: 'pool', currency: 'coins', amount: -amount, title: `Сбор: ${p.title}`, refId: p.id });
    touch(u, ts);
  };

  const mgr = (d: string) => users.find((u) => u.deptId === d && u.role === 'manager')!;
  const qStart = quarterStart(now);
  const prevQEnd = qStart;

  // Симуляция по дням
  for (let day = 0; day < 240; day++) {
    const ts0 = START + day * DAY;
    const ts = () => Math.min(now - 3600_000, ts0 + Math.floor((9 + r() * 9.5) * 3600_000));
    const inCurrentQ = ts0 >= qStart;

    for (const d of DEPTS) {
      if (d.id === 'hr') continue;
      const m = mgr(d.id);
      const team = teamOf(d.id);
      let p = 0.3;
      if (d.id === 'risk' && inCurrentQ) p = 0; // фонд почти не используется
      if (d.id === 'mortgage') p = 0.12;
      if (d.id === 'cc' && inCurrentQ) p = 0;
      if (d.id === 'it' && ts0 >= quarterStart(qStart - DAY) && ts0 < qStart) p = 0.08;
      let k = r() < p ? 1 : 0;
      while (k-- > 0) {
        let e = pick(r, team);
        let cat = pick(r, ACCRUAL_CATEGORIES);
        let amount = round100(cat.min! + r() * (cat.max! - cat.min!));
        const t = ts();
        const ms0 = new Date(new Date(t).getFullYear(), new Date(t).getMonth(), 1).getTime();
        const got = accruals.filter((a) => a.employeeId === e.id && a.ts >= ms0).reduce((x, a) => x + a.amount, 0);
        if (got + amount > SETTINGS.maxPerEmployeeMonth) continue;
        accrue(m, e, t, cat.id, amount);
      }
    }

    for (const u of users) {
      if (inactive.has(u.id)) continue;
      if (u.rucoins > 0 && r() < 0.06) convert(u, ts(), u.rucoins >= 2000 && r() < 0.5 ? round100(u.rucoins * (0.5 + r() * 0.5)) : u.rucoins);
      if (u.coins > 2000 && r() < 0.035) {
        const affordable = products.filter((x) => x.price <= u.coins && x.stock > 0 && isUnlocked(x, u.pet.xp));
        if (affordable.length) buy(u, ts(), pick(r, affordable));
      }
      if (u.coins > 600 && r() < 0.02) feedPet(u, ts(), pick(r, [500, 1500, 3000]), 0);
      if (u.coins > 3000 && r() < 0.025) {
        const t = ts();
        const prize = pickPrize(SETTINGS.wheelPrizes, r());
        u.coins -= SETTINGS.spinPrice;
        txs.push({ id: id('tx'), ts: t, userId: u.id, kind: 'wheel', currency: 'coins', amount: -SETTINGS.spinPrice, title: `Колесо удачи: ${prize.name}` });
        if (prize.coins) { u.coins += prize.coins; txs.push({ id: id('tx'), ts: t, userId: u.id, kind: 'refund', currency: 'coins', amount: prize.coins, title: 'Выигрыш в колесе удачи' }); }
        else orders.push({ id: id('or'), ts: t, userId: u.id, items: [{ productId: prize.id, name: prize.name, qty: 1, price: 0, costRub: prize.costRub }], total: 0, status: prize.digital || now - t > 10 * DAY ? 'delivered' : 'new', wheel: true });
        touch(u, t);
      }
      if (r() < 0.025) {
        const colleagues = users.filter((x) => x.id !== u.id && (x.deptId === u.deptId || r() < 0.15));
        sayThanks(u, pick(r, colleagues), ts());
      }
      for (const p of pools) {
        if (p.scope !== 'all' && p.scope !== u.deptId) continue;
        if (ts0 < p.createdAt || ts0 > Math.min(p.deadline, now)) continue;
        if (p.contributions.some((c) => c.userId === u.id)) continue;
        const raised = p.contributions.reduce((a, c) => a + c.amount, 0);
        if (p.status !== 'cancelled' && raised >= p.target) continue;
        if (u.coins >= 1000 && r() < 0.07) contribute(u, p, ts(), Math.min(u.coins, pick(r, [1000, 2000, 3000, 5000])));
      }
    }
  }

  // Питомцы: опыт из истории ухода
  for (const u of users) {
    const spent = -txs.filter((t) => t.userId === u.id && t.kind === 'pet').reduce((a, t) => a + t.amount, 0);
    u.pet.xp = Math.max(u.pet.xp, Math.round(spent * 1.1));
  }

  // Сценарии для мониторинга: конец квартала в IT, концентрация в контакт-центре, рост в ипотеке
  const itTeam = teamOf('it');
  itTeam.slice(0, 6).forEach((e, i) => accrue(mgr('it'), e, prevQEnd - (4 - (i % 4)) * DAY + 3600_000 * (10 + i), 'team', 5000, 'Закрыли квартальный план команды, вклад в релиз и поддержку'));
  const ccTeam = teamOf('cc');
  [26, 21, 15, 9, 3].forEach((d) => accrue(mgr('cc'), U('e.zakharova'), now - d * DAY, 'help', 3000, 'Помогла операторам с потоком обращений в пиковые часы'));
  [18, 6].forEach((d, i) => accrue(mgr('cc'), ccTeam.filter((x) => x.email !== 'e.zakharova@mania.demo')[i], now - d * DAY, 'help', 3000, 'Подменил коллегу на смене в загруженный день'));
  const mt = teamOf('mortgage');
  [24, 19, 13, 8, 2].forEach((d) => accrue(mgr('mortgage'), U('p.zuev'), now - d * DAY, 'hard', 3000, 'Закрыл сделку с нестандартным залогом в срок'));
  mt.filter((x) => x.email !== 'p.zuev@mania.demo').forEach((e, i) => accrue(mgr('mortgage'), e, now - (5 + i * 4) * DAY, 'team', 4000, 'Отдел вышел на рекордный объём выдач за месяц'));

  // Взаимные благодарности (сигнал)
  const pz = U('a.popov'), kb = U('k.belykh');
  for (let i = 0; i < 6; i++) {
    sayThanks(pz, kb, now - (2 + i * 4) * DAY);
    sayThanks(kb, pz, now - (3 + i * 4) * DAY);
  }
  // Начисления без обоснования и превышение лимита (исторические, до ввода правил)
  accrue(mgr('risk'), U('m.zaytsev'), now - 130 * DAY, 'team', 2000, 'За работу');
  accrue(mgr('risk'), U('o.dmitrieva'), now - 128 * DAY, 'team', 2000, 'Молодец');
  const kf = U('k.fomin');
  [7, 8, 9].forEach((d) => accrue(mgr('it'), kf, now - (95 + d) * DAY, 'hard', 7000));

  // Завершённые сборы закрываем добором до цели
  for (const p of pools) {
    if (p.status !== 'completed') continue;
    const raised = p.contributions.reduce((a, c) => a + c.amount, 0);
    if (raised < p.target) p.target = Math.max(1000, raised);
  }
  // Отменённый сбор: возврат
  for (const p of pools.filter((x) => x.status === 'cancelled')) {
    for (const c of p.contributions) {
      const u = users.find((x) => x.id === c.userId)!;
      u.coins += c.amount;
      txs.push({ id: id('tx'), ts: p.deadline, userId: u.id, kind: 'refund', currency: 'coins', amount: c.amount, title: `Возврат: сбор «${p.title}» отменён`, refId: p.id });
    }
  }

  // Демо-сотрудник: немного РуКоинов для конвертации
  const demo = U('a.smirnov');
  accrue(mgr('retail'), demo, now - 2 * DAY, 'initiative', 4500, 'Собрал дашборд по оттоку клиентов: отдел удержал 40 счетов за месяц');
  demo.lastActiveAt = now - 3600_000;
  demo.pet.xp = 5200; // 3 уровень: открыты мерч, ОТуПик, аксессуары и одежда

  // Остатки из прошлой версии программы (накоп)
  for (const u of users) {
    const legacy = round100(2000 + r() * 14000);
    u.coins += legacy;
    txs.push({ id: id('tx'), ts: START, userId: u.id, kind: 'conversion_in', currency: 'coins', amount: legacy, title: 'Перенос баланса из прошлой версии программы' });
  }

  // «Миллионер» для финансовой аналитики
  const ms = U('m.safina');
  ms.coins += 420000;
  txs.push({ id: id('tx'), ts: START, userId: ms.id, kind: 'conversion_in', currency: 'coins', amount: 420000, title: 'Перенос баланса из старой программы' });

  const notifications = [
    { id: id('nt'), userId: demo.id, ts: now - 2 * DAY, text: 'Ирина Белова начислила вам 4 500 РуКоинов: Инициативность', read: false, link: '/cabinet' },
    { id: id('nt'), userId: demo.id, ts: now - 5 * DAY, text: 'Новый сбор: «Кофемашина на третий этаж»', read: true, link: '/cabinet/pools' },
    { id: id('nt'), userId: U('i.belova').id, ts: now - 1 * DAY, text: 'Двое сотрудников не получали признания больше 60 дней', read: false, link: '/manager/kpi' },
    { id: id('nt'), userId: U('s.yusupova').id, ts: now - 1 * DAY, text: 'Появились новые сигналы для проверки', read: false, link: '/admin/signals' },
  ];

  txs.sort((a, b) => a.ts - b.ts);
  accruals.sort((a, b) => a.ts - b.ts);
  thanks.sort((a, b) => a.ts - b.ts);
  orders.sort((a, b) => a.ts - b.ts);

  const managerFunds: Record<string, number> = {};
  for (const d of departments) if (d.managerId) managerFunds[d.managerId] = Math.max(60000, teamOf(d.id).length * 15000);

  return {
    version: DB_VERSION,
    seededAt: now,
    users,
    departments,
    txs,
    accruals,
    conversions,
    thanks,
    products,
    orders,
    pools,
    notifications,
    events: buildEvents(now).map((e, i) => ({ ...e, attendees: users.filter((_, j) => (j + i) % 4 === 0).map((u) => u.id) })),
    news: NEWS.map((x, i) => ({ ...x, ts: now - (i * 3 + 1) * DAY })),
    goals: GOALS,
    articles: ARTICLES,
    settings: { ...SETTINGS, managerFunds },
    signalStatus: {},
    carts: {},
    sessionUserId: null,
  };
}
