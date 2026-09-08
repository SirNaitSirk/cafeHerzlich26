import type { TerminalLocale } from "@/lib/terminal-locale";

/**
 * Russian pluralization: picks the form for a count. Russian has three forms —
 * one (1, 21, 31 …), few (2–4, 22–24 …) and many (0, 5–20, 11–14 …).
 */
function pluralRu(count: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/**
 * Terminal UI copy in German — the default and single source of truth for the
 * shape of the message tree. UI is 100% localized; code stays English.
 */
const terminalDe = {
  welcome: {
    tagline: "Herzlich willkommen",
    cta: "Jetzt bestellen",
    hint: "Zum Starten tippen",
  },
  menu: {
    title: "Speisekarte",
    soldOut: "Ausverkauft",
    add: "Hinzufügen",
    remaining: (count: number) => `Nur noch ${count}`,
    emptyCategory: "In dieser Kategorie gibt es aktuell nichts.",
    loading: "Speisekarte wird geladen …",
  },
  options: {
    title: "Wähle deine Optionen",
    required: "Pflicht",
    requiredHint: "Bitte triff eine Auswahl.",
    add: "Hinzufügen",
    cancel: "Abbrechen",
    less: "Weniger",
    more: "Mehr",
    remaining: (count: number) => `Nur noch ${count} verfügbar`,
  },
  cart: {
    title: "Deine Bestellung",
    empty: "Dein Warenkorb ist leer.",
    itemsLabel: (count: number) => (count === 1 ? "1 Artikel" : `${count} Artikel`),
    namePlaceholder: "Dein Name",
    nameLabel: "Dein Name",
    nameRequired: "Pflichtfeld",
    nameHint: "Bitte gib deinen Namen ein – er erscheint auf dem Abholmonitor.",
    remove: "Entfernen",
    continue: "Weiter zur Bezahlung",
    continueNeedsName: "Bitte Namen eingeben",
    back: "Weiter einkaufen",
    total: "Summe",
    maxReached: "Maximaler Bestand erreicht",
  },
  payment: {
    title: "Wie möchtest du bezahlen?",
    cash: "Bar bezahlen",
    cashHint: "An der Kasse bezahlen",
    paypal: "Mit PayPal bezahlen",
    paypalHint: "Freunde & Familie",
    back: "Zurück",
  },
  paypal: {
    title: "Mit PayPal bezahlen",
    amountLabel: "Zu zahlen",
    instructions: "Scanne den QR-Code und zahle bitte über „Freunde & Familie“.",
    friendsFamily: "Bitte „An Freunde & Familie“ senden — so fallen keine Gebühren an.",
    referenceLabel: "Verwendungszweck",
    referenceHint: "Bitte als Verwendungszweck angeben.",
    paid: "Ich habe bezahlt",
    back: "Zurück",
    unavailable: "PayPal ist derzeit nicht eingerichtet.",
  },
  success: {
    title: "Vielen Dank!",
    cashInfo: "Bitte bezahle deine Bestellung an der Kasse.",
    paypalInfo: "Deine Bestellung ist in der Küche eingegangen.",
    orderLabel: (value: string) => `Deine Bestellung: ${value}`,
    autoReturn: "Zurück zum Start …",
  },
  errors: {
    stock: "Leider ist ein Artikel nicht mehr verfügbar.",
    /** Stock ran out while the guest was ordering; the cart was trimmed for them. */
    stockProduct: (name: string, available: number) =>
      available > 0
        ? `„${name}" ist nur noch ${available}× verfügbar. Dein Warenkorb wurde angepasst.`
        : `„${name}" ist leider ausverkauft und wurde aus deinem Warenkorb entfernt.`,
    generic: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
};

/** The message tree shape every locale must satisfy. */
export type TerminalMessages = typeof terminalDe;

/**
 * Terminal UI copy in Russian. Structurally identical to `terminalDe` (enforced
 * by the `TerminalMessages` type). Only the terminal chrome is translated —
 * product, category and option names stay German (they come from the DB).
 */
const terminalRu: TerminalMessages = {
  welcome: {
    tagline: "Добро пожаловать",
    cta: "Сделать заказ",
    hint: "Коснитесь, чтобы начать",
  },
  menu: {
    title: "Меню",
    soldOut: "Распродано",
    add: "Добавить",
    remaining: (count: number) => `Осталось ${count}`,
    emptyCategory: "В этой категории сейчас ничего нет.",
    loading: "Меню загружается …",
  },
  options: {
    title: "Выберите опции",
    required: "Обязательно",
    requiredHint: "Пожалуйста, сделайте выбор.",
    add: "Добавить",
    cancel: "Отмена",
    less: "Меньше",
    more: "Больше",
    remaining: (count: number) => `Доступно только ${count}`,
  },
  cart: {
    title: "Ваш заказ",
    empty: "Ваша корзина пуста.",
    itemsLabel: (count: number) =>
      `${count} ${pluralRu(count, ["товар", "товара", "товаров"])}`,
    namePlaceholder: "Ваше имя",
    nameLabel: "Ваше имя",
    nameRequired: "Обязательно",
    nameHint: "Пожалуйста, введите имя — оно появится на экране выдачи.",
    remove: "Удалить",
    continue: "К оплате",
    continueNeedsName: "Пожалуйста, введите имя",
    back: "Продолжить покупки",
    total: "Итого",
    maxReached: "Достигнут лимит наличия",
  },
  payment: {
    title: "Как вы хотите оплатить?",
    cash: "Оплатить наличными",
    cashHint: "Оплата на кассе",
    paypal: "Оплатить через PayPal",
    paypalHint: "Друзья и семья",
    back: "Назад",
  },
  paypal: {
    title: "Оплата через PayPal",
    amountLabel: "К оплате",
    instructions: "Отсканируйте QR-код и оплатите через «Друзьям и семье».",
    friendsFamily: "Пожалуйста, отправьте «Друзьям и семье» — так не будет комиссии.",
    referenceLabel: "Назначение платежа",
    referenceHint: "Пожалуйста, укажите как назначение платежа.",
    paid: "Я оплатил(а)",
    back: "Назад",
    unavailable: "PayPal сейчас не настроен.",
  },
  success: {
    title: "Большое спасибо!",
    cashInfo: "Пожалуйста, оплатите заказ на кассе.",
    paypalInfo: "Ваш заказ передан на кухню.",
    orderLabel: (value: string) => `Ваш заказ: ${value}`,
    autoReturn: "Возврат на главный экран …",
  },
  errors: {
    stock: "К сожалению, один из товаров больше недоступен.",
    stockProduct: (name: string, available: number) =>
      available > 0
        ? `«${name}» доступно только ${available} шт. Ваша корзина обновлена.`
        : `«${name}» распродано и удалено из вашей корзины.`,
    generic: "Что-то пошло не так. Пожалуйста, попробуйте ещё раз.",
  },
};

/** Terminal copy by locale. */
export const terminalMessagesByLocale: Record<TerminalLocale, TerminalMessages> = {
  de: terminalDe,
  ru: terminalRu,
};

/**
 * German terminal copy. Kept as the default export used by staff surfaces (e.g.
 * the Kasse, which mounts the same OrderFlow but always stays German).
 */
export const terminalMessages = terminalDe;

/**
 * German UI copy for the kitchen monitor (staff). Single source of truth —
 * no hardcoded strings in the components.
 */
export const kitchenMessages = {
  title: "Küchenmonitor",
  waitLabel: "Wartezeit",
  openCount: (count: number) =>
    count === 1 ? "1 offene Bestellung" : `${count} offene Bestellungen`,
  empty: {
    title: "Keine offenen Bestellungen",
    hint: "Neue Bestellungen erscheinen hier automatisch.",
  },
  loading: "Bestellungen werden geladen …",
  connectionLost: "Verbindung unterbrochen – neuer Versuch läuft …",
  sound: {
    on: "Ton an",
    off: "Ton aus",
    enabledToast: "Ton für neue Bestellungen aktiviert.",
    disabledToast: "Ton stummgeschaltet.",
  },
  paymentBadge: {
    paypal: "PayPal",
    cash: "Bar",
  },
  sourceBadge: {
    terminal: "Terminal",
    kasse: "Kasse",
  },
  /** Marks an item nobody has to prepare — just put it on the counter. */
  directItem: "direkt",
  actions: {
    done: "Erledigt",
    edit: "Bearbeiten",
    delete: "Löschen",
    save: "Speichern",
    cancel: "Abbrechen",
  },
  confirmDelete: {
    title: "Bestellung löschen?",
    description: (label: string) =>
      `„${label}" wird storniert und der Bestand zurückgebucht. Das lässt sich nicht rückgängig machen.`,
    confirm: "Löschen",
    cancel: "Abbrechen",
  },
  edit: {
    title: "Bestellung bearbeiten",
    description: "Mengen anpassen, Positionen entfernen oder den Namen ändern.",
    namePlaceholder: "Name (optional)",
    emptyWarning: "Ohne Positionen wird die Bestellung storniert.",
    total: "Summe",
  },
  toasts: {
    doneSuccess: "Als erledigt markiert.",
    deleteSuccess: "Bestellung storniert.",
    saveSuccess: "Bestellung aktualisiert.",
    stock: "Nicht genug Bestand für diese Änderung.",
    gone: "Diese Bestellung ist nicht mehr offen.",
    generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
  },
  history: {
    open: "Verlauf",
    title: "Bestellverlauf",
    description: "Erledigte und gelöschte Bestellungen von heute.",
    badge: {
      done: "Erledigt",
      collected: "Abgeholt",
      cancelled: "Gelöscht",
    },
    doneAt: (time: string) => `erledigt um ${time}`,
    cancelledAt: (time: string) => `gelöscht um ${time}`,
    restore: "Wiederherstellen",
    empty: "Heute noch keine vergangenen Bestellungen.",
    connectionLost: "Verbindung unterbrochen – neuer Versuch läuft …",
    toasts: {
      restoreSuccess: "Bestellung wiederhergestellt.",
      gone: "Diese Bestellung kann nicht wiederhergestellt werden.",
      generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    },
  },
} as const;

/**
 * German UI copy for the public pickup monitor (TV). Single source of truth —
 * glanceable, no operational detail.
 */
export const pickupMessages = {
  title: "Abholung",
  inProgress: {
    heading: "In Zubereitung",
    count: (count: number) => (count === 1 ? "1 Bestellung" : `${count} Bestellungen`),
  },
  ready: {
    heading: "Abholbereit",
    count: (count: number) => (count === 1 ? "1 Bestellung" : `${count} Bestellungen`),
  },
  empty: {
    title: "Aktuell keine Bestellungen",
    hint: "Deine Bestellung erscheint hier, sobald sie aufgegeben wurde.",
  },
  connectionLost: "Verbindung unterbrochen – neuer Versuch läuft …",
} as const;

/**
 * German UI copy for the Kasse (staff till). Single source of truth —
 * no hardcoded strings in the components.
 */
export const kasseMessages = {
  title: "Kasse",
  newOrder: "Neue Bestellung",
  admin: "Verwaltung",
  connectionLost: "Verbindung unterbrochen – neuer Versuch läuft …",
  cash: {
    heading: "Offene Barzahlungen",
    count: (count: number) => (count === 1 ? "1 Bestellung" : `${count} Bestellungen`),
    action: "Kassiert",
    empty: "Keine offenen Barzahlungen.",
    dialog: {
      title: "Kassieren",
      toPay: "Zu zahlen",
      received: "Erhalten",
      receivedPlaceholder: "0,00",
      change: "Rückgeld",
      changePlaceholder: "—",
      exactHint: "Passend, kein Rückgeld",
      missing: "Es fehlen",
      quickExact: "Passend",
      backspace: "Löschen",
      cancel: "Abbrechen",
      directSaleHint: "Ware direkt aushändigen – geht nicht in die Küche.",
    },
  },
  ready: {
    heading: "Abholbereit",
    count: (count: number) => (count === 1 ? "1 Bestellung" : `${count} Bestellungen`),
    action: "Abgeholt",
    undo: "Rückgängig",
    readyLabel: "fertig seit",
    empty: "Keine Bestellungen zur Abholung.",
  },
  collected: {
    heading: "Zuletzt abgeholt",
    count: (count: number) => (count === 1 ? "1 Bestellung" : `${count} Bestellungen`),
    hint: "Versehentlich abgeholt? Hier zurückholen.",
    action: "Zurückholen",
    collapse: "Einklappen",
    expand: "Anzeigen",
    directSaleBadge: "Direktverkauf",
    cancel: "Stornieren",
    confirmCancel: {
      title: "Direktverkauf stornieren?",
      description: (label: string) =>
        `„${label}“ wird storniert und der Bestand zurückgebucht. Das lässt sich nicht rückgängig machen.`,
      confirm: "Stornieren",
      cancel: "Abbrechen",
    },
  },
  paymentBadge: {
    paypal: "PayPal",
    cash: "Bar",
  },
  sourceBadge: {
    terminal: "Terminal",
    kasse: "Kasse",
  },
  total: "Summe",
  availability: {
    open: "Verfügbarkeit",
    title: "Verfügbarkeit",
    subtitle: "Tippe ein Produkt an, um es für heute aus- oder wieder anzuschalten.",
    done: "Fertig",
    empty: "Keine Produkte vorhanden.",
    markOut: "Heute aus",
    markAvailable: "Wieder da",
    badge: "Heute aus",
  },
  toasts: {
    cashSuccess: "Bestellung an die Küche übergeben.",
    directSaleSuccess: "Kassiert – bitte direkt aushändigen.",
    cancelSuccess: "Direktverkauf storniert.",
    cancelGone: "Dieser Direktverkauf kann nicht mehr storniert werden.",
    collectSuccess: "Als abgeholt markiert.",
    uncollectSuccess: "Zurück in die Abholung.",
    uncollectGone: "Diese Bestellung ist nicht mehr abgeholt.",
    gone: "Diese Bestellung ist nicht mehr offen.",
    generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
    soldOut: "Als heute aus markiert.",
    available: "Wieder verfügbar.",
  },
} as const;

/**
 * German UI copy for the Admin dashboard (staff). Single source of truth —
 * no hardcoded strings in the components.
 */
export const adminMessages = {
  title: "Verwaltung",
  backToKasse: "Zur Kasse",
  connectionLost: "Verbindung unterbrochen – neuer Versuch läuft …",
  loading: "Wird geladen …",
  tabs: {
    categories: "Kategorien",
    products: "Produkte",
    modifiers: "Optionen",
    settings: "Einstellungen",
    history: "Bestellhistorie",
  },
  archive: {
    title: "Bestellhistorie",
    description: "Alle abkassierten Bestellungen – dauerhaft und nur zum Lesen.",
    empty: "Noch keine Bestellungen in der Historie.",
    connectionLost: "Verbindung unterbrochen – neuer Versuch läuft …",
    total: "Summe",
    badge: {
      done: "Erledigt",
      collected: "Abgeholt",
      cancelled: "Gelöscht",
    },
    doneAt: (time: string) => `erledigt um ${time}`,
    collectedAt: (time: string) => `abgeholt um ${time}`,
    cancelledAt: (time: string) => `gelöscht um ${time}`,
    paidAt: (time: string) => `bezahlt um ${time}`,
  },
  common: {
    save: "Speichern",
    cancel: "Abbrechen",
    edit: "Bearbeiten",
    deactivate: "Deaktivieren",
    reactivate: "Reaktivieren",
    deleteForever: "Endgültig löschen",
    moveUp: "Nach oben",
    moveDown: "Nach unten",
    inactive: "Inaktiv",
    required: "Pflichtfeld",
    generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
  },
  categories: {
    heading: "Kategorien",
    count: (count: number) => (count === 1 ? "1 Kategorie" : `${count} Kategorien`),
    add: "Neue Kategorie",
    empty: "Noch keine Kategorien. Lege die erste an.",
    productCount: (count: number) => (count === 1 ? "1 Produkt" : `${count} Produkte`),
    confirmDelete: {
      title: "Kategorie endgültig löschen?",
      description: (name: string) =>
        `„${name}“ wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.`,
      confirm: "Endgültig löschen",
      cancel: "Abbrechen",
    },
    form: {
      createTitle: "Neue Kategorie",
      editTitle: "Kategorie bearbeiten",
      description: "Name der Kategorie, wie er am Terminal erscheint.",
      name: "Name",
      namePlaceholder: "z. B. Kaffee",
    },
    toasts: {
      created: "Kategorie angelegt.",
      updated: "Kategorie gespeichert.",
      deactivated: "Kategorie deaktiviert.",
      reactivated: "Kategorie reaktiviert.",
      deleted: "Kategorie gelöscht.",
      moved: "Reihenfolge aktualisiert.",
    },
  },
  products: {
    heading: "Produkte",
    add: "Neues Produkt",
    empty: "Noch keine Produkte in dieser Kategorie.",
    emptyAll: "Lege zuerst eine Kategorie an, dann kannst du Produkte hinzufügen.",
    uncategorized: "Ohne Kategorie",
    stock: {
      unlimited: "Unbegrenzt",
      soldOut: "Ausverkauft",
      label: (count: number) => `${count} auf Lager`,
    },
    availability: {
      markOut: "Heute aus",
      markAvailable: "Wieder da",
      badge: "Heute aus",
    },
    directSaleBadge: "Direktverkauf",
    archive: {
      heading: (count: number) =>
        count === 1 ? "1 archiviertes Produkt" : `${count} archivierte Produkte`,
      hint: "Deaktivierte Produkte — am Terminal nicht sichtbar.",
    },
    confirmDelete: {
      title: "Produkt endgültig löschen?",
      description: (name: string) =>
        `„${name}“ wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden. Bereits abgeschlossene Bestellungen bleiben unverändert.`,
      confirm: "Endgültig löschen",
      cancel: "Abbrechen",
    },
    form: {
      createTitle: "Neues Produkt",
      editTitle: "Produkt bearbeiten",
      description: "Name, Preis, Kategorie, Bild und Bestand festlegen.",
      name: "Name",
      namePlaceholder: "z. B. Cappuccino",
      category: "Kategorie",
      price: "Preis (€)",
      pricePlaceholder: "0,00",
      priceInvalid: "Bitte einen gültigen Preis eingeben.",
      image: "Bild",
      stock: "Bestand",
      stockHint: "Leer lassen = unbegrenzt. 0 = ausverkauft.",
      stockPlaceholder: "unbegrenzt",
      preparation: "Muss zubereitet werden",
      preparationHint:
        "Aus = Direktverkauf: geht an der Kasse nicht in die Küche, sondern wird sofort ausgehändigt.",
    },
    toasts: {
      created: "Produkt angelegt.",
      updated: "Produkt gespeichert.",
      deactivated: "Produkt deaktiviert.",
      reactivated: "Produkt reaktiviert.",
      moved: "Reihenfolge aktualisiert.",
      stock: "Bestand aktualisiert.",
      soldOut: "Als heute aus markiert.",
      available: "Wieder verfügbar.",
      deleted: "Produkt gelöscht.",
    },
  },
  modifiers: {
    heading: "Optionen & Extras",
    description:
      "Wiederverwendbare Optionsgruppen (z. B. „Extras“, „Milch“). Weise sie im Produkt-Formular einzelnen Produkten zu.",
    addGroup: "Neue Gruppe",
    addOption: "Option hinzufügen",
    empty: "Noch keine Optionsgruppen. Lege die erste an.",
    noOptions: "Noch keine Optionen in dieser Gruppe.",
    selectionType: {
      label: "Auswahltyp",
      single: "Einfachauswahl",
      multi: "Mehrfachauswahl",
      singleHint: "Genau eine Option (z. B. Milchsorte).",
      multiHint: "Beliebig viele Optionen (z. B. Extras).",
    },
    required: "Pflicht",
    requiredLabel: "Pflichtauswahl",
    requiredHint: "Gast muss mindestens eine Option wählen.",
    groupForm: {
      createTitle: "Neue Optionsgruppe",
      editTitle: "Optionsgruppe bearbeiten",
      name: "Name",
      namePlaceholder: "z. B. Extras",
    },
    optionForm: {
      createTitle: "Neue Option",
      editTitle: "Option bearbeiten",
      name: "Name",
      namePlaceholder: "z. B. Schuss Karamell",
      price: "Aufpreis (€)",
      pricePlaceholder: "0,00",
      priceInvalid: "Bitte einen gültigen Aufpreis eingeben.",
    },
    assign: {
      label: "Optionen",
      hint: "Optionsgruppen, die am Terminal zu diesem Produkt angeboten werden.",
      none: "Keine Optionsgruppen vorhanden.",
    },
    toasts: {
      groupCreated: "Gruppe angelegt.",
      groupUpdated: "Gruppe gespeichert.",
      groupDeactivated: "Gruppe deaktiviert.",
      groupReactivated: "Gruppe reaktiviert.",
      optionCreated: "Option angelegt.",
      optionUpdated: "Option gespeichert.",
      optionDeactivated: "Option deaktiviert.",
      optionReactivated: "Option reaktiviert.",
      moved: "Reihenfolge aktualisiert.",
    },
  },
  image: {
    upload: "Bild hochladen",
    change: "Bild ändern",
    remove: "Bild entfernen",
    uploading: "Wird hochgeladen …",
    error: "Bild konnte nicht hochgeladen werden.",
    hint: "JPG, PNG oder WebP, max. 5 MB.",
  },
  settings: {
    heading: "Einstellungen",
    description: "Café-weite Einstellungen für Terminal und Bezahlung.",
    cafeName: "Café-Name",
    cafeNamePlaceholder: "Cafe Herzlich",
    paypalHandle: "PayPal-Handle",
    paypalHandleHint:
      "Nur der PayPal.Me-Benutzername (der Teil nach paypal.me/) — nicht der Café-Name. Beispiel: paypal.me/cafeherzlich → Eingabe: cafeherzlich.",
    paypalHandlePlaceholder: "cafeherzlich",
    paypalHandleTest: "Handle testen ↗",
    pickupTheme: "Abholmonitor-Design",
    pickupThemeHint:
      "Farbwelt des Abholmonitors (TV). Wird sofort auf allen Bildschirmen übernommen.",
    saved: "Einstellungen gespeichert.",
  },
} as const;
