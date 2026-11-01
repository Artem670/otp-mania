import type {
  Accrual, Article, Category, Conversion, DB, Department, EventItem, Goal, NewsItem, Order, Pool, Product, Pulse, Settings, Thanks, Tx, User, Ticket, CoinRule } from './types';
import { ARTICLES } from './articles';
import { DAY, mulberry32, quarterStart } from '../lib/utils';
import { isUnlocked, lineTitle, pickPrize, unitCost, unitPrice } from './selectors';

// Поднимайте номер при любом изменении стартовых данных: иначе у тех, кто уже открывал демо, останутся старые товары и статьи
export const DB_VERSION = 14;
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
  { id: 'event', name: 'Участие в корпоративных активностях', min: 500, max: 1500, description: 'Посещение мероприятий, обязательное обучение, опросы. Формальная активность: доля ограничена порогом E3', formal: true },
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
  event: ['Участие в корпоративном забеге', 'Прошёл обязательный курс по информационной безопасности', 'Заполнил ежегодный опрос вовлечённости', 'Посетил лекцию о финансовой грамотности'],
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
  { id: 'p-hoodie', limited: true, name: 'Худи «Мания»', category: 'clothes', price: 20000, costRub: 1600, stock: 40, active: true, description: 'Хлопок с начёсом 320 г/м², свободный крой, вышивка ОТуПика на груди. Лимитированный тираж, размеры XS–XXL.', icon: 'shirt', tone: '#9E6FC3' },
  { id: 'p-tee', name: 'Футболка базовая', category: 'clothes', price: 6500, costRub: 500, stock: 120, active: true, description: 'Хлопок 100%, 180 г/м², принт с ОТуПиком на груди.', icon: 'shirt', tone: '#1F1F24' },
  { id: 'p-jacket', name: 'Флисовая куртка', category: 'clothes', price: 22500, costRub: 1900, stock: 25, active: true, description: 'Тёплый флис 280 г/м² на молнии, вышитый знак на груди. Для офиса и прогулок.', icon: 'snowflake', tone: '#6E6E78' },
  { id: 'p-beanie', limited: true, name: 'Шапка-бини', category: 'clothes', price: 5000, costRub: 380, stock: 60, active: true, description: 'Мягкая вязка, нашивка с логотипом программы.', icon: 'snowflake', tone: '#FF6A13' },
  { id: 'p-mug', name: 'Термокружка 400 мл', category: 'accessories', price: 8000, costRub: 600, stock: 90, active: true, description: 'Сталь с двойными стенками, держит тепло до 6 часов, подходит для кофемашины. Принт с ОТуПиком.', icon: 'coffee', tone: '#6E9E00' },
  { id: 'p-backpack', name: 'Рюкзак для ноутбука', category: 'accessories', price: 22500, costRub: 2000, stock: 35, active: true, description: 'Отделение под ноутбук 16", карман для зарядки, влагозащитная ткань, шеврон с ОТуПиком.', icon: 'backpack', tone: '#1F1F24' },
  { id: 'p-umbrella', name: 'Зонт-автомат', category: 'accessories', price: 9500, costRub: 750, stock: 50, active: true, description: 'Автомат, купол 105 см, система антиветер.', icon: 'umbrella', tone: '#8E8E99' },
  { id: 'p-shopper', name: 'Шоппер', category: 'accessories', price: 3500, costRub: 250, stock: 150, active: true, description: 'Плотный хлопок 220 г/м², внутренний карман, большой принт с ОТуПиком.', icon: 'shoppingbag', tone: '#9E6FC3' },
  { id: 'p-headphones', name: 'Наушники Baseus W04', category: 'electronics', price: 8000, costRub: 1300, stock: 12, active: true, description: 'Беспроводные TWS-наушники, Bluetooth 5.3, до 25 часов с кейсом, сенсорное управление.', icon: 'headphones', tone: '#3A3A42' },
  { id: 'p-powerbank', name: 'Пауэрбанк 10 000 мА·ч', category: 'electronics', price: 9000, costRub: 1500, stock: 45, active: true, description: 'Компактный, быстрая зарядка 20 Вт, USB-C и два USB-A.', icon: 'battery', tone: '#FF6A13' },
  { id: 'p-speaker', name: 'Колонка JBL Clip 4', category: 'electronics', price: 25000, costRub: 4300, stock: 18, active: true, description: 'Компактная колонка JBL с карабином: защита IP67, 5 Вт, до 10 часов музыки.', icon: 'speaker', tone: '#6E6E78' },
  { id: 'p-watch', name: 'Фитнес-браслет Xiaomi Smart Band 9', category: 'electronics', price: 16500, costRub: 2800, stock: 20, active: true, description: 'AMOLED-экран, пульс, сон, шаги и уведомления, до 21 дня без зарядки.', icon: 'watch', tone: '#1F1F24' },
  // Сертификаты: номинал 1 000 / 2 000 / 3 000 ₽ выбирается при покупке, 1 ₽ = 5 коинов (курс из кейса)
  { id: 'p-cert-ozon', name: 'Сертификат Ozon', category: 'certificates', nominals: [1000, 2000, 3000], price: 5000, costRub: 1000, stock: 999, active: true, description: 'Электронный сертификат маркетплейса. Код придёт на рабочую почту.', icon: 'gift', tone: '#3A3A42' },
  { id: 'p-cert-wb', name: 'Сертификат Wildberries', category: 'certificates', nominals: [1000, 2000, 3000], price: 5000, costRub: 1000, stock: 999, active: true, description: 'Электронный сертификат маркетплейса. Код придёт на рабочую почту.', icon: 'gift', tone: '#9E6FC3' },
  { id: 'p-cert-ga', name: 'Сертификат «Золотое яблоко»', category: 'certificates', nominals: [1000, 2000, 3000], price: 5000, costRub: 1000, stock: 999, active: true, description: 'Косметика и парфюмерия. Электронный код придёт на рабочую почту.', icon: 'sparkles', tone: '#1F1F24' },
  { id: 'p-cert-sport', name: 'Сертификат DDX Fitness', category: 'certificates', nominals: [1000, 2000, 3000], price: 5000, costRub: 1000, stock: 999, active: true, description: 'Абонемент или разовые визиты в клубы сети DDX Fitness. Электронный код придёт на рабочую почту.', icon: 'dumbbell', tone: '#6E9E00' },
  { id: 'p-cert-books', name: 'Сертификат Литрес', category: 'certificates', nominals: [1000, 2000, 3000], price: 5000, costRub: 1000, stock: 999, active: true, description: 'Электронные книги и аудиокниги. Код придёт на рабочую почту.', icon: 'book', tone: '#FF6A13' },
  { id: 'p-toy', name: 'Игрушка ОТуПик', category: 'merch', price: 8000, costRub: 650, stock: 80, active: true, description: 'Мягкий ОТуПик ростом 25 см в фирменной бандане. Для детей сотрудников и рабочего стола.', icon: 'baby', tone: '#9E6FC3', minLevel: 2 },
  { id: 'p-stickers', name: 'Набор стикеров', category: 'merch', price: 1200, costRub: 80, stock: 300, active: true, description: '12 виниловых стикеров с эмоциями ОТуПика для ноутбука и телефона.', icon: 'sticker', tone: '#FF6A13' },
  { id: 'p-notebook', name: 'Эко-блокнот с ручкой', category: 'merch', price: 3800, costRub: 300, stock: 140, active: true, description: 'Формат A5 на спирали, 80 листов в точку, эко-обложка с логотипом ОТП, ручка в комплекте.', icon: 'notebook', tone: '#1F1F24' },
  { id: 'p-pet', name: 'Набор для питомца', category: 'merch', price: 5000, costRub: 400, stock: 60, active: true, description: 'Миска и бандана как у ОТуПика: для вашей собаки или кошки.', icon: 'paw', tone: '#6E6E78' },
  { id: 'p-don-mayak', name: 'Пожертвование «Дому с маяком»', category: 'charity', price: 1000, costRub: 200, stock: 9999, active: true, description: 'Детский хоспис «Дом с маяком». 1 000 коинов = 200 ₽ фонду. Перечисляем раз в месяц.', icon: 'heart', tone: '#2f9e6a' },
  { id: 'p-don-bereginya', name: 'Пожертвование фонду «Берегиня»', category: 'charity', price: 1000, costRub: 200, stock: 9999, active: true, description: 'Благотворительный фонд «Берегиня». 1 000 коинов = 200 ₽ фонду. Перечисляем раз в месяц.', icon: 'heart', tone: '#9e6fc3' },
  { id: 'p-don-shelter', name: 'Корм для приюта', category: 'charity', price: 1000, costRub: 200, stock: 9999, active: true, description: 'Покупаем корм для приюта для собак: 1 000 коинов = 200 ₽ на корм.', icon: 'paw', tone: '#ff6a13' },
  // Нематериальные награды за РуКоины: из правил программы в кейсе (выходной, поздний приход, удалёнка) и наши (обед с правлением, наставничество)
  { id: 'p-dayoff', name: 'Дополнительный выходной', category: 'perks', currency: 'rucoins', price: 12000, costRub: 0, stock: 999, active: true, description: 'Согласуется с руководителем. Не чаще раза в квартал.', icon: 'palm', tone: '#6E9E00' },
  { id: 'p-late', name: 'Поздний приход или ранний уход', category: 'perks', currency: 'rucoins', price: 3000, costRub: 0, stock: 999, active: true, description: 'Приходите на два часа позже или уходите на два часа раньше в удобный день. Достаточно предупредить руководителя.', icon: 'clock', tone: '#9E6FC3' },
  { id: 'p-remote', name: 'Дополнительный день удалённой работы', category: 'perks', currency: 'rucoins', price: 4000, costRub: 0, stock: 999, active: true, description: 'Ещё один день из дома сверх графика. Дату согласуйте с руководителем.', icon: 'home', tone: '#FF6A13' },
  { id: 'p-lunch', limited: true, name: 'Обед с членом правления', category: 'perks', currency: 'rucoins', price: 40000, costRub: 0, stock: 4, active: true, description: 'Неформальная встреча, 4 места в квартал.', icon: 'utensils', tone: '#1F1F24' },
  { id: 'p-mentor', name: 'Встреча с наставником из другой функции', category: 'perks', currency: 'rucoins', price: 8000, costRub: 0, stock: 999, active: true, description: 'Час с опытным руководителем другого направления: карьера, проект, обратная связь.', icon: 'mentor', tone: '#3A3A42' },
  { id: 'p-psy', name: 'Сессия с психологом', category: 'experiences', price: 20000, costRub: 3000, stock: 999, active: true, description: 'Онлайн-консультация 50 минут с психологом сервиса-партнёра. Содержание сессии остаётся между вами и психологом. Не чаще одной сессии в месяц.', icon: 'heart', tone: '#9E6FC3' },
];

/**
 * Коины за события. Суммы из текущей программы; коины за «спасибо» и за заполнение профиля убраны
 * (спасибо растит рейтинг, профиль заполняется по умолчанию при выходе на работу). Добавлена годовщина в банке.
 */
export const COIN_RULES: CoinRule[] = [
  { id: 'r-first-login', title: 'Первый вход на портал', amount: 100, how: 'auto', once: true },
  { id: 'r-birthday', title: 'День рождения', amount: 50, how: 'hr', note: 'раз в год' },
  { id: 'r-survey', title: 'Участие в опросе', amount: 50, how: 'hr', note: 'за каждый корпоративный опрос' },
  { id: 'r-enps-1', title: 'Опрос eNPS в первый месяц работы', amount: 100, how: 'hr', once: true },
  { id: 'r-enps-3', title: 'Опрос eNPS в третий месяц работы', amount: 100, how: 'hr', once: true },
  { id: 'r-course-1', title: 'Назначенный курс или тест пройден в первый день', amount: 150, how: 'hr', note: 'за каждый курс' },
  { id: 'r-course-2', title: 'Назначенный курс или тест пройден во второй день', amount: 100, how: 'hr', note: 'за каждый курс' },
  { id: 'r-probation', title: 'Прохождение испытательного срока', amount: 500, how: 'hr', once: true },
  { id: 'r-anniversary', title: 'Годовщина работы в банке', amount: 1000, how: 'hr', note: 'за каждый год' },
  { id: 'r-mania', title: 'Участие в развитии ОТП Мании', amount: 2000, how: 'manual', once: true, note: 'например, тест новой версии' },
  { id: 'r-event', title: 'Корпоративное событие: хакатон, волонтёрство, спикер', amount: 500, how: 'manual', note: 'по решению организатора' },
];

const SETTINGS: Settings = {
  conversionRate: 1,
  coinCostRub: 0.2,
  budgetRub: 450_000,
  quarterFundDefault: 100_000,
  managerFunds: {},
  maxPerAccrual: 8000,
  maxPerEmployeeMonth: 15000,
  transferLimitMonth: 1000,
  certLimitMonth: 1,
  coinRules: COIN_RULES,
  minCommentLength: 20,
  spinPrice: 1000,
  spinLimit: 20,
  metricTargets: { er: 0.75, coverage: 0.85, csi: 4.85, bankBudgetRub: 34_000_000, mutualMax: 0.15, top1Max: 0.05, formalMax: 0.15 },
  wheelPrizes: [
    { id: 'w-badge', name: 'Бейдж или рамка в профиле', short: 'Бейдж', prob: 30.2, costRub: 0, digital: true },
    { id: 'w-stickers', name: 'Значок или стикерпак ОТуПик', short: 'Стикерпак', prob: 21, costRub: 40 },
    { id: 'w-back', name: 'Возврат 500 коинов', short: '+500 коинов', prob: 15, costRub: 0, coins: 500 },
    { id: 'w-early', name: 'Ранний доступ к следующему дропу', short: 'Ранний доступ', prob: 15, costRub: 0, digital: true },
    { id: 'w-remote', name: 'День удалёнки', short: 'Удалёнка', prob: 5, costRub: 0, digital: true },
    { id: 'w-cashback', name: 'Повышенный кэшбек на категорию на месяц', short: 'Кэшбек', prob: 5, costRub: 500, digital: true },
    { id: 'w-late', name: 'Поздний приход или ранний уход', short: 'Поздний приход', prob: 5, costRub: 0, digital: true },
    { id: 'w-toy', name: 'Игрушка ОТуПик', short: 'Игрушка', prob: 2.8, costRub: 650 },
    { id: 'w-dayoff', name: 'Дополнительный выходной', short: 'Выходной', prob: 0.8, costRub: 0, digital: true },
    { id: 'w-hoodie', name: 'Лимитированное худи ОТуПик', short: 'Худи', prob: 0.1, costRub: 1600 },
    { id: 'w-cert', name: 'Сертификат 1 000 ₽ на выбор', short: 'Сертификат', prob: 0.1, costRub: 1000, digital: true },
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
    pet: { name: 'ОТуПик', xp: Math.round((r() * r() * 10000) / 100) * 100, fedAt: START },
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
    const nominal = p.nominals?.length ? pick(r, p.nominals) : undefined;
    const price = unitPrice(p, nominal), cost = unitCost(p, nominal);
    const total = price * qty;
    if (u.coins < total || p.stock < qty) return;
    if (p.category === 'certificates') { // лимит: 1 сертификат в календарный месяц
      const m = new Date(ts); const from = new Date(m.getFullYear(), m.getMonth(), 1).getTime(); const to = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
      if (qty > 1 || orders.some((o) => o.userId === u.id && o.ts >= from && o.ts < to && o.status !== 'cancelled' && o.items.some((i) => i.productId.startsWith('p-cert')))) return;
    }
    const age = (now - ts) / DAY;
    const status: Order['status'] = age > 10 ? (r() < 0.06 ? 'cancelled' : 'delivered') : age > 3 ? 'processing' : 'new';
    const o: Order = { id: id('or'), ts, userId: u.id, items: [{ productId: p.id, name: lineTitle(p, nominal), qty, price, costRub: cost }], total, status };
    if (status === 'delivered') o.csi = r() < 0.75 ? 5 : r() < 0.7 ? 4 : 3;
    orders.push(o);
    u.coins -= total; p.stock -= qty;
    if (p.stock === 0) (p.stockouts ??= []).push({ from: ts });
    txs.push({ id: id('tx'), ts, userId: u.id, kind: 'order', currency: 'coins', amount: -total, title: `Заказ: ${p.name}`, refId: o.id });
    if (status === 'cancelled') {
      u.coins += total; p.stock += qty;
      const open = p.stockouts?.find((x) => !x.to); if (open) open.to = ts + DAY;
      txs.push({ id: id('tx'), ts: ts + DAY, userId: u.id, kind: 'refund', currency: 'coins', amount: total, title: `Возврат за отменённый заказ`, refId: o.id });
    }
    touch(u, ts);
  };

  const redeemPerk = (u: User, ts: number, p: Product) => {
    const age = (now - ts) / DAY;
    const o: Order = { id: id('or'), ts, userId: u.id, items: [{ productId: p.id, name: p.name, qty: 1, price: p.price, costRub: 0 }], total: p.price, status: age > 10 ? 'delivered' : 'processing', currency: 'rucoins' };
    if (o.status === 'delivered') o.csi = r() < 0.85 ? 5 : 4;
    orders.push(o);
    u.rucoins -= p.price; p.stock -= 1;
    txs.push({ id: id('tx'), ts, userId: u.id, kind: 'order', currency: 'rucoins', amount: -p.price, title: `Награда: ${p.name}`, refId: o.id });
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
    { id: 'pool2', title: 'Подарки приюту для собак', description: 'Благотворительный сбор всего банка. Корм, лежанки и лекарства.', goal: 'Передать приюту подарки к Новому году', target: 150000, deadline: now + 35 * DAY, scope: 'all', organizerId: U('s.yusupova').id, image: 'heart', contributions: [], status: 'active', createdAt: now - 30 * DAY, kind: 'charity' },
    { id: 'pool-mayak', title: 'Вместе с «Домом с маяком»', description: 'Детский хоспис «Дом с маяком» помогает детям и их семьям. Все собранные коины передаём фонду.', goal: 'Передать хоспису 300 000 коинов (60 000 ₽)', target: 300000, deadline: now + 40 * DAY, scope: 'all', organizerId: U('s.yusupova').id, image: 'heart', contributions: [], status: 'active', createdAt: now - 21 * DAY, kind: 'charity' },
    { id: 'pool-bereginya', title: 'Сбор для фонда «Берегиня»', description: 'Помогаем фонду «Берегиня» всем банком.', goal: 'Передать фонду 200 000 коинов (40 000 ₽)', target: 200000, deadline: now + 28 * DAY, scope: 'all', organizerId: U('s.yusupova').id, image: 'heart', contributions: [], status: 'active', createdAt: now - 16 * DAY, kind: 'charity' },
    { id: 'pool-coffee-all', title: 'Кофемашины во все офисы', description: 'Ставим хорошие кофемашины в каждый офис банка. Чем больше соберём, тем быстрее начнём.', goal: 'Шесть кофемашин, по одной на офис', target: 400000, deadline: now + 45 * DAY, scope: 'all', organizerId: U('s.yusupova').id, image: 'coffee', contributions: [], status: 'active', createdAt: now - 12 * DAY, kind: 'team' },
    { id: 'pool-quiz', title: 'Квиз-вечер контакт-центра', description: 'Собираем команду на квиз в баре: еда, команда до 8 человек, приз победителям.', goal: 'Аренда зала и ужин на 20 человек', target: 50000, deadline: now + 15 * DAY, scope: 'cc', organizerId: U('r.gavrilov').id, image: 'party', contributions: [], status: 'active', createdAt: now - 10 * DAY, kind: 'team' },
    { id: 'pool-trip', title: 'Выезд офиса на базу отдыха', description: 'Зимний выезд розничного бизнеса: лыжи, баня, командные игры.', goal: 'Аренда базы на выходные для 30 человек', target: 150000, deadline: now + 30 * DAY, scope: 'retail', organizerId: U('i.belova').id, image: 'trees', contributions: [], status: 'active', createdAt: now - 18 * DAY, kind: 'team' },
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
        const affordable = products.filter((x) => x.currency !== 'rucoins' && x.price <= u.coins && x.stock > 0 && isUnlocked(x, u.pet.xp));
        if (affordable.length) buy(u, ts(), pick(r, affordable));
      }
      if (u.rucoins >= 3000 && r() < 0.012) {
        const perks = products.filter((x) => x.currency === 'rucoins' && x.price <= u.rucoins && x.stock > 0);
        if (perks.length) redeemPerk(u, ts(), pick(r, perks));
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
  demo.pet.xp = 2100; // 3 уровень: открыты мерч, ОТуПик, аксессуары и одежда; до сертификатов 900 опыта

  // Коины за события: опросы, курсы, дни рождения, годовщины
  for (const u of users) {
    const give = (ruleId: string, ts: number) => {
      const r0 = COIN_RULES.find((x) => x.id === ruleId)!;
      u.coins += r0.amount;
      txs.push({ id: id('tx'), ts, userId: u.id, kind: 'bonus', currency: 'coins', amount: r0.amount, title: r0.title, refId: r0.id });
    };
    give('r-first-login', START);
    for (let k = 0; k < 1 + Math.floor(r() * 3); k++) give('r-survey', START + r() * (now - START));
    if (r() < 0.6) give('r-course-1', START + r() * (now - START)); else give('r-course-2', START + r() * (now - START));
    if (r() < 0.25) give('r-birthday', START + r() * (now - START));
    if (r() < 0.2) give('r-anniversary', START + r() * (now - START));
  }

  // Остатки из прошлой версии программы (накоп)
  for (const u of users) {
    const legacy = u.id === demo.id ? Math.max(round100(18000 - u.coins), 2000) : round100(2000 + r() * 14000); // демо-сотруднику хватает на покупки в магазине
    u.coins += legacy;
    txs.push({ id: id('tx'), ts: START, userId: u.id, kind: 'conversion_in', currency: 'coins', amount: legacy, title: 'Перенос баланса из прошлой версии программы' });
  }

  // «Миллионер» для финансовой аналитики
  const ms = U('m.safina');
  ms.coins += 420000;
  txs.push({ id: id('tx'), ts: START, userId: ms.id, kind: 'conversion_in', currency: 'coins', amount: 420000, title: 'Перенос баланса из старой программы' });

  // Дефицит (C3): худи из лимитированного дропа и наушники заканчивались, обеды с правлением разобраны до конца квартала
  const P = (pid: string) => products.find((x) => x.id === pid)!;
  (P('p-hoodie').stockouts ??= []).push({ from: now - 44 * DAY, to: now - 31 * DAY });
  (P('p-headphones').stockouts ??= []).push({ from: now - 26 * DAY, to: now - 17 * DAY });
  const lunch = P('p-lunch');
  if (lunch.stock > 0) { lunch.stock = 0; (lunch.stockouts ??= []).push({ from: now - 19 * DAY }); }

  const pulses = seedPulses(users, accruals, orders, products, now);

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
    pulses,
    tickets: seedTickets(users, now),
    settings: { ...SETTINGS, managerFunds },
    signalStatus: {},
    carts: {},
    sessionUserId: null,
  };
}

/**
 * Ответы на пульс-опросы для стартовых данных (B2 и желанность наград).
 * Используется и при первом запуске, и для дозаполнения уже созданной общей базы.
 */
export function seedPulses(users: User[], accruals: Accrual[], orders: Order[], products: Product[], now = Date.now()): Pulse[] {
  const r = mulberry32(7202611);
  const out: Pulse[] = [];
  const known = new Set(users.filter((u) => now - u.lastActiveAt < 90 * DAY).map((u) => u.id)); // неактивные на опросы не отвечают
  const formal = new Set(ACCRUAL_CATEGORIES.filter((c) => c.formal).map((c) => c.id));
  const score = (base: number) => Math.max(1, Math.min(5, Math.round(base + (r() - 0.5) * 1.6)));
  for (const a of accruals) {
    if (!known.has(a.employeeId) || now - a.ts > 150 * DAY || now - a.ts < 4 * DAY || r() > 0.5) continue; // на свежие ещё не ответили
    const meaningful = a.comment.trim().length >= 20 && !formal.has(a.categoryId);
    out.push({ id: 'pl_' + a.id, ts: a.ts + Math.floor(r() * 2 * DAY), userId: a.employeeId, q: 'contribution', score: score(meaningful ? 4.6 : 2.4), refId: a.id });
  }
  for (const o of orders) {
    if (o.wheel || o.status !== 'delivered' || !known.has(o.userId) || now - o.ts > 150 * DAY || r() > 0.55) continue;
    const p = products.find((x) => x.id === o.items[0]?.productId);
    const base = p?.limited ? 4.9 : p?.category === 'certificates' ? 4.6 : p?.category === 'merch' ? 3.6 : 4.2;
    out.push({ id: 'pl_' + o.id, ts: o.ts + Math.floor((3 + r() * 8) * DAY), userId: o.userId, q: 'desire', score: score(base), refId: o.id });
  }
  return out.filter((p) => p.ts < now).sort((a, b) => a.ts - b.ts);
}

/** Пара обращений в техподдержку, чтобы администратору было что разобрать в демо. */
function seedTickets(users: User[], now: number): Ticket[] {
  const admin = users.find((u) => u.role === 'admin');
  const emps = users.filter((u) => u.role === 'employee' && u.email !== 'a.smirnov@mania.demo');
  if (!admin || emps.length < 2) return [];
  const [a, b] = emps;
  const m = (ts: number, who: User, text: string) => ({ id: `sm_${who.id}_${ts}`, ts, authorId: who.id, text, staff: who.role === 'admin' && who.id === admin.id });
  const t1 = now - 3 * 3_600_000;
  const t2 = now - 4 * DAY;
  return [
    { id: 'tk_demo1', userId: a.id, topic: 'Заказ и доставка', status: 'open', createdAt: t1, updatedAt: t1, userReadAt: t1, staffReadAt: 0,
      messages: [m(t1, a, 'Здравствуйте! Заказал термокружку неделю назад, статус всё ещё «Собирается». Подскажите, когда можно забрать?')] },
    { id: 'tk_demo2', userId: b.id, topic: 'Коины и РуКоины', status: 'closed', createdAt: t2, updatedAt: t2 + 5_400_000, userReadAt: t2 + 6_000_000, staffReadAt: t2 + 5_400_000,
      messages: [
        m(t2, b, 'Руководитель начислил РуКоины, а в балансе их не вижу.'),
        m(t2 + 5_400_000, admin, 'Добрый день! Начисление прошло, просто страница не обновилась. Обновите профиль, РуКоины уже на балансе.'),
      ] },
  ];
}
