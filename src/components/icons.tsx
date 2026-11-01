// Иконки Lucide (через пакет react-icons/lu).
export {
  LuSearch as Search, LuBell as Bell, LuShoppingCart as Cart, LuNewspaper as News, LuCalendarDays as Calendar,
  LuUser as UserIcon, LuUsers as Users, LuBriefcase as Briefcase, LuTarget as Target, LuBookOpen as BookOpen,
  LuLayoutDashboard as Dashboard, LuShieldAlert as ShieldAlert, LuSettings as Settings, LuLogOut as LogOut,
  LuArrowLeftRight as Convert, LuHeart as Heart, LuHandHeart as HandHeart, LuTrophy as Trophy, LuStore as Store,
  LuPackage as Package, LuPiggyBank as PiggyBank, LuPawPrint as Paw, LuChevronDown as ChevronDown,
  LuChevronRight as ChevronRight, LuX as X, LuCheck as Check, LuPlus as Plus, LuMinus as Minus, LuTrash2 as Trash,
  LuUpload as Upload, LuImage as ImageIcon, LuTriangleAlert as Alert, LuInfo as Info, LuLoaderCircle as Loader,
  LuCoins as Coins, LuAward as Award, LuMedal as Medal, LuCrown as Crown, LuTrendingUp as TrendingUp,
  LuTrendingDown as TrendingDown, LuActivity as Activity, LuWallet as Wallet, LuMenu as Menu, LuBuilding2 as Building,
  LuFileText as FileText, LuEye as Eye, LuPencil as Pencil, LuSend as Send, LuMessageSquare as Message, LuStar as Star,
  LuClock as Clock, LuMapPin as MapPin, LuArrowRight as ArrowRight, LuRotateCcw as Reset, LuScale as Scale,
  LuClipboardCheck as ClipboardCheck, LuListChecks as ListChecks, LuBan as Ban, LuCircleCheck as CircleCheck,
  LuCircleX as CircleX, LuChartPie as PieIcon, LuChartColumn as BarIcon, LuKeyRound as Key, LuMail as Mail,
  LuLightbulb as Lightbulb, LuSparkles as Sparkles, LuGift as Gift, LuReceipt as Receipt, LuSlidersHorizontal as Sliders,
  LuTag as Tag, LuTruck as Truck, LuFilter as Filter, LuFlag as Flag, LuRocket as Rocket, LuHouse as Home, LuLock as Lock,
} from 'react-icons/lu';

import {
  LuShirt, LuSnowflake, LuCoffee, LuBackpack, LuUmbrella, LuShoppingBag, LuHeadphones, LuBattery, LuSpeaker, LuWatch,
  LuGift, LuDumbbell, LuBook, LuFilm, LuBaby, LuSticker, LuNotebook, LuPawPrint, LuTrees, LuUtensils, LuSparkles,
  LuMountain, LuHeart, LuPartyPopper, LuGamepad2, LuRocket, LuGraduationCap, LuPlane,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';

export const PRODUCT_ICONS: Record<string, IconType> = {
  shirt: LuShirt, snowflake: LuSnowflake, coffee: LuCoffee, backpack: LuBackpack, umbrella: LuUmbrella,
  shoppingbag: LuShoppingBag, headphones: LuHeadphones, battery: LuBattery, speaker: LuSpeaker, watch: LuWatch,
  gift: LuGift, dumbbell: LuDumbbell, book: LuBook, film: LuFilm, baby: LuBaby, sticker: LuSticker, notebook: LuNotebook,
  paw: LuPawPrint, palm: LuTrees, utensils: LuUtensils, sparkles: LuSparkles, mountain: LuMountain,
};

export const POOL_PRESETS: Record<string, { icon: IconType; bg: string; fg: string; label: string }> = {
  coffee: { icon: LuCoffee, bg: '#f4ffd2', fg: '#5a7a00', label: 'Офис' },
  heart: { icon: LuHeart, bg: '#16161a', fg: '#c1ff05', label: 'Благотворительность' },
  party: { icon: LuPartyPopper, bg: '#f6f6f8', fg: '#16161a', label: 'Праздник' },
  gift: { icon: LuGift, bg: '#f1e9f8', fg: '#6f3fa0', label: 'Подарок' },
  game: { icon: LuGamepad2, bg: '#efeff2', fg: '#9e6fc3', label: 'Отдых' },
  trees: { icon: LuTrees, bg: '#e6f6ee', fg: '#2f9e6a', label: 'Выезд' },
  rocket: { icon: LuRocket, bg: '#16161a', fg: '#ffffff', label: 'Проект' },
  study: { icon: LuGraduationCap, bg: '#fff7df', fg: '#16161a', label: 'Обучение' },
  plane: { icon: LuPlane, bg: '#c1ff05', fg: '#16161a', label: 'Поездка' },
};
