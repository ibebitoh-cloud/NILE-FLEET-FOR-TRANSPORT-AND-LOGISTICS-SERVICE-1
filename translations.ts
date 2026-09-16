
// Persistent cache for AI-learned translations
const SAVED_TRANSLATIONS_KEY = 'NILE_FLEET_LEARNED_LANG';

const loadLearnedTranslations = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_TRANSLATIONS_KEY) || '{}');
  } catch { return {}; }
};

export const dynamicTranslations: Record<string, string> = loadLearnedTranslations();

// Queue of words that the UI encountered but couldn't translate
export const discoveryQueue = new Set<string>();

export const entityTranslations: Record<string, string> = {
  // Hardcoded core vocabulary
  "ELAMIR": "الأمير للنقل الدولي",
  "ELHANDSIA": "الهندسية للخدمات اللوجستية",
  "DALTIX": "دالتيكس لخدمات الموانئ",
  "FISSAL": "فيصل للشحن",
  "MAERSK": "ميرسك مصر",
  "CMA CGM": "سي إم أي CGM",
  "MSC": "إم إس سي للملاحة",
  "HAPAG LLOYD": "هاباج لويد",
  "TBA": "يتم تحديده لاحقاً",
  "NILE LOGISTICS": "النيل للخدمات اللوجستية",
  "ARAB CONTRACTORS": "المقاولون العرب",
  "GLOBAL FEEDER": "جلوبال فيدر",
  "ALEX": "الإسكندرية",
  "DAM": "دمياط",
  "GOUDA": "أبو قير (جودة)",
  "SOKHNA": "السخنة",
  "SCCT": "شرق بورسعيد",
  "PSD": "بورسعيد غرب",
  "MAL": "الورشة",
  "WORKSHOP": "الورشة",
  "IN_STOCK": "متاح بالمخزن",
  "CLIPPED_ON": "مركب على حاوية",
  "MAINTENANCE": "تحت الصيانة",
  "RETIRED": "خارج الخدمة (تكهين)",
  "DONE": "تم الانتهاء",
  "IN PROGRESS": "قيد التنفيذ",
  "UNDER OPERATE": "تحت التجهيز",
  "HOLD": "معلق",
  "CANCEL": "ملغي",
  "PROCURE": "المشتريات",
  "GAS": "الوقود",
  "PAYROLL": "الرواتب",
  "FOOD": "الوجبات",
  "TRANSPORT": "الانتقالات",
  "RENT": "إيجار الموانئ"
};

/**
 * Translates an entity. If unknown and in AR mode, flags for AI discovery.
 */
export const translateEntity = (value: any, lang: 'en' | 'ar') => {
  if (!value || lang === 'en') return value;
  
  const original = value.toString().trim();
  const upperVal = original.toUpperCase();
  
  // 1. Check hardcoded dictionary
  if (entityTranslations[upperVal]) return entityTranslations[upperVal];
  
  // 2. Check AI-learned dictionary
  if (dynamicTranslations[upperVal]) return dynamicTranslations[upperVal];

  // 3. If we are in Arabic mode and it's likely English, add to discovery queue
  if (/[a-zA-Z]/.test(original)) {
    discoveryQueue.add(original);
  }

  return original;
};

/**
 * Manual sweep: checks a list of real system values and returns the ones
 * that have no Arabic translation yet, adding them to the discovery queue.
 * Unlike the passive observer, this does not require the app to be in AR mode
 * or for the value to have been rendered on screen.
 */
export const scanForUntranslated = (values: (string | undefined | null)[]): string[] => {
  const found: string[] = [];
  values.forEach(value => {
    if (!value) return;
    const original = value.toString().trim();
    if (!original) return;

    // Only flag things containing Latin letters (English terms needing Arabic)
    if (!/[a-zA-Z]/.test(original)) return;

    // Skip pure codes/IDs: container numbers, genset serials, invoice refs etc.
    if (/^[A-Z]{2,4}[-\s]?\d{3,}/.test(original)) return;
    if (/^\d/.test(original)) return;

    const upperVal = original.toUpperCase();
    if (entityTranslations[upperVal]) return;
    if (dynamicTranslations[upperVal]) return;

    discoveryQueue.add(original);
    if (!found.includes(original)) found.push(original);
  });
  window.dispatchEvent(new CustomEvent('lang-discovered'));
  return found.sort((a, b) => a.localeCompare(b));
};

/**
 * Commits new AI-learned words to the persistent cache
 */
export const registerDynamicTranslations = (mappings: Record<string, string>) => {
  Object.entries(mappings).forEach(([en, ar]) => {
    const key = en.toUpperCase().trim();
    dynamicTranslations[key] = ar;
    // Remove from queue if it was there
    discoveryQueue.delete(en);
  });
  localStorage.setItem(SAVED_TRANSLATIONS_KEY, JSON.stringify(dynamicTranslations));
  // Dispatch event so UI knows to refresh components using translateEntity
  window.dispatchEvent(new CustomEvent('lang-discovered'));
};

/**
 * Commits a single AI-learned translation to the persistent cache
 */
export const registerDynamicTranslation = (en: string, ar: string) => {
  if (!en || !ar) return;
  const key = en.toUpperCase().trim();
  dynamicTranslations[key] = ar;
  discoveryQueue.delete(en);
  localStorage.setItem(SAVED_TRANSLATIONS_KEY, JSON.stringify(dynamicTranslations));
  window.dispatchEvent(new CustomEvent('lang-discovered'));
};

/**
 * Removes a learned translation
 */
export const deleteDynamicTranslation = (en: string) => {
  const key = en.toUpperCase().trim();
  delete dynamicTranslations[key];
  localStorage.setItem(SAVED_TRANSLATIONS_KEY, JSON.stringify(dynamicTranslations));
  window.dispatchEvent(new CustomEvent('lang-discovered'));
};

export const translations = {
  // ... (previous translation content kept identical)
  en: {
    brand: "NILE FLEET",
    tagline: "Clip-On Genset Solutions",
    dashboard: "DASHBOARD",
    analytics: "ANALYTICS",
    intelligence: "FLEET INTEL",
    reports: "AUDIT REPORTS",
    masterView: "MASTER LEDGER",
    operations: "OPERATIONS",
    gensetStock: "GENSET STOCK",
    reservations: "BOOKINGS",
    customers: "PARTNERS",
    customerPrices: "RATE MATRIX",
    financials: "FINANCIALS",
    expenseHub: "EXPENSE HUB",
    systemLog: "SYSTEM HISTORY",
    portGate: "PORT GATE",
    userMgmt: "ORGANIZATION",
    support: "SUPPORT HUB",
    userSettings: "ACCOUNT",
    signOut: "SIGN OUT",
    totalUnits: "Total Units",
    clippedOut: "Clipped (OUT)",
    freeUnits: "Free Units",
    neededToday: "Work Orders",
    portActivity: "Port Activity Hub",
    operationalFeed: "Operational Feed",
    unit: "Unit",
    status: "Status",
    client: "Client",
    bookingNum: "Booking #",
    actions: "Actions",
    search: "Search...",
    createBooking: "Create Manual Booking",
    port: "Port",
    route: "Route",
    container: "Container",
    commodity: "Commodity",
    clipperName: "Clipper On",
    trucker: "Trucker",
    shipper: "Shipper",
    date: "Date",
    rate: "Rate",
    vat: "VAT",
    notes: "Notes",
    save: "Save",
    edit: "Edit",
    cancel: "Cancel",
    ok: "OK",
    needed: "Under Operate",
    live: "In Progress",
    hold: "Hold",
    revenue: "Revenue",
    outstanding: "Outstanding",
    invoiceId: "Invoice ID",
    downloadPdf: "Download PDF",
    exportCsv: "Export CSV",
    partnerRegistry: "Partner Registry",
    stockPrediction: "Stock Prediction",
    geminiInsights: "Gemini Fleet Insights",
    operatingTiming: "Operating Timing",
    info: "Info",
    performance: "Genset Performance",
    healthScore: "Health Score",
    daysActive: "Days Active",
    topUnits: "Top Performing Units",
    unitEfficiency: "Unit Efficiency",
    maintenanceDue: "Next Maintenance",
    maintenanceLog: "Maintenance Log",
    maintenanceHistory: "Maintenance History",
    logMaintenance: "Log Maintenance",
    serviceType: "Service Type",
    technician: "Technician",
    runningHours: "Running Hours",
    partsReplaced: "Parts Replaced",
    nextServiceDue: "Next Service Due",
    serviceCost: "Service Cost",
    procurement: "Procurement",
    gasContract: "Gas Contract",
    payroll: "Payroll Ledger",
    gasBalance: "Gas Balance",
    prepaidOktan: "Prepaid Oktan",
    salaryMonth: "Month",
    paidTo: "Paid To",
    undo: "Undo Last Action",
    finalize: "Finalize & Clear History",
    gaz: "Gaz",
    gasPerPort: "Gas Consumption / Port",
    gasPerUnit: "Gas Consumption / Unit",
    oktanAdvisor: "Oktan Strategic Advisor",
    estLitersLeft: "Estimated Liters Remaining",
    daysLeft: "Operation Days Left",
    geminiCostAdvisor: "Gemini Cost Strategy",
    genReport: "Generate Official Report",
    finReport: "Financial Audit",
    opsReport: "Operational Audit",
    fuelReport: "Fuel Consumption Audit",
    employeeName: "Employee Name",
    position: "Position",
    baseSalary: "Base Salary",
    totalEarnings: "Total Earnings",
    totalAdvances: "Total Advances",
    remainingBalance: "Remaining Balance",
    addEmployee: "Add New Staff",
    advance: "Advance",
    bonus: "Bonus",
    deploySalary: "Deploy Salaries",
    overdrawn: "Overdrawn",
    healthy: "Healthy",
    transactions: "Transactions",
    periodFrom: "Period From",
    periodTo: "Period To",
    printPdf: "Print PDF",
    auditSummary: "Audit Summary",
    revenueInflow: "Revenue Inflow",
    expenseOutflow: "Expense Outflow",
    totalDeployments: "Total Deployments",
    totalFuelBurn: "Total Fuel Burn",
    details: "Details",
    category: "Category",
    value: "Value",
    login: "Log In",
    accessKey: "Access Key",
    corporateEmail: "Corporate Email",
    etaConfig: "ETA API Configuration",
    taxpayerId: "Taxpayer ID",
    activityCode: "Activity Code",
    branchCode: "Branch Code",
    securitySeal: "Security Seal",
    hsmToken: "ETA HSM Token",
    detectHardware: "Detect Hardware",
    installDriver: "Setup Driver",
    saveConfig: "Save Configuration",
    hubControl: "Hub Control",
    processGate: "Process Gate",
    hubLedger: "Hub Ledger",
    activeTerminal: "Active Terminal",
    targetPort: "Target Port",
    dispatchUnit: "Dispatch Unit",
    portMove: "Port Move",
    selectUnits: "Select Units",
    unitsSelected: "Units Selected",
    singleUnitExit: "Single Unit For Exit",
    snNode: "Asset ID",
    hubInventoryEmpty: "Hub Inventory Empty",
    containerId: "Container ID",
    scanPhoto: "Scan Photo",
    booking: "Booking",
    manual: "Manual",
    customerSelect: "Select Customer...",
    unitTransferReady: "Unit Transfer Ready",
    unitsLoggedArriving: "Selected units will be logged as arriving at",
    terminalActiveLedger: "Terminal Active Ledger",
    records: "Records",
    bookingNode: "Booking Node",
    operatorShipper: "Operator / Shipper",
    gensetContainer: "Genset / Container",
    operatingDate: "Operating Date",
    unassigned: "Unassigned",
    authorizeExit: "Authorize Exit",
    transferUnits: "Transfer Units",
    resetGateForm: "Reset Gate Form",
    verifyAction: "Verify Action",
    sourceHub: "Source Hub",
    targetHub: "Target Hub",
    gensetsToBeProcessed: "Gensets to be processed:",
    finalCommit: "Final Commit",
    cancelAndReturn: "Cancel and Return",
    noActiveDeployments: "No active deployments found at this hub.",
    
    // Boss Review
    pendingReview: "Awaiting Command Review",
    verifiedByBoss: "Verified by Command",
    authorizeRecord: "Verify manifest entry",
    bossAudit: "Command verification active",

    // Financials
    unpaidMoney: "Unpaid Balance",
    liveUnbilled: "Unbilled Revenue",
    historicalLoad: "Historical Debt",
    activeTrips: "Active Trips",
    partnerPortfolios: "Partner Portfolios",
    commercialWallet: "Commercial Wallet",
    netBalanceDue: "Net Balance Due",
    historicalIndebtedness: "Historical Indebtedness Log",
    authorizeBilling: "Authorize Billing",
    receivePayment: "Receive Payment",
    
    // Expense Hub
    expenseCommand: "Expense Command Center",
    unifiedOutflow: "Unified Outflow Registry",
    addEntry: "Add Entry",
    procurementItem: "Item Description",
    requestor: "Requestor",
    workers: "Personnel",
    fareAmount: "Fare Amount",
    rentPaid: "Rent Paid",
    
    // Login
    secureTerminal: "Secure Access",
    gensetForce: "GENSET POWER",
    coldChain: "Reliable power for the cold chain.",
    initializeCommand: "log in",
    strategicPasskey: "password",
    networkIdentity: "user name",
    requestNode: "register new user",
    
    // Import Hub
    importHub: "Smart Import Hub",
    uploadPrompt: "Drop CSV file for AI alignment",
    mappingEngine: "AI-Powered Mapping Engine",
    standardTemplate: "Standard Template",
    authorizeInjection: "Authorize Injection"
  },
  ar: {
    brand: "أسطول النيل",
    tagline: "حلول المولدات المتنقلة",
    dashboard: "لوحة القيادة",
    analytics: "التحليلات التقنية",
    intelligence: "ذكاء الأسطول",
    reports: "تقارير التدقيق",
    masterView: "السجل الرئيسي",
    operations: "العمليات التشغيلية",
    gensetStock: "مخزون المولدات",
    reservations: "الحجوزات",
    customers: "الشركاء",
    customerPrices: "مصفوفة الأسعار",
    financials: "الشؤون المالية",
    expenseHub: "مركز المصروفات",
    systemLog: "تاريخ النظام",
    portGate: "بوابة الميناء",
    userMgmt: "الهيكل التنظيمي",
    support: "مركز الدعم",
    userSettings: "الحساب الشخصي",
    signOut: "خروج من النظام",
    totalUnits: "إجمالي الوحدات",
    clippedOut: "قيد التشغيل",
    freeUnits: "وحدات متاحة",
    neededToday: "أوامر العمل",
    portActivity: "مركز نشاط الموانئ",
    operationalFeed: "موجز العمليات",
    unit: "الوحدة",
    status: "الحالة",
    client: "العميل",
    bookingNum: "رقم الحجز",
    actions: "الإجراءات",
    search: "بحث...",
    createBooking: "إنشاء حجز يدوي",
    port: "الميناء",
    route: "الوجهة",
    container: "الحاوية",
    commodity: "البضاعة",
    clipperName: "فني التركيب",
    trucker: "الناقل/السائق",
    shipper: "المشحن",
    date: "التاريخ",
    rate: "السعر",
    vat: "القيمة المضافة",
    notes: "ملاحظات",
    save: "حفظ",
    edit: "تعديل",
    cancel: "إلغاء",
    ok: "تم",
    needed: "تحت التجهيز",
    live: "قيد التنفيذ",
    hold: "انتظار",
    revenue: "الإإيرادات",
    outstanding: "المستحقات",
    invoiceId: "رقم الفاتورة",
    downloadPdf: "تحميل PDF",
    exportCsv: "تصدير CSV",
    partnerRegistry: "سجل الشركاء",
    stockPrediction: "توقعات المخزون",
    geminiInsights: "رؤى جيمي للأسطول",
    operatingTiming: "توقيت التشغيل",
    info: "معلومات",
    performance: "أداء المولدات",
    healthScore: "مؤشر الحالة",
    daysActive: "أيام التشغيل",
    topUnits: "أعلى الوحدات أداءً",
    unitEfficiency: "كفاءة الوحدة",
    maintenanceDue: "الصيانة القادمة",
    maintenanceLog: "سجل الصيانة",
    maintenanceHistory: "تاريخ الصيانة",
    logMaintenance: "تسجيل صيانة",
    serviceType: "نوع الصيانة",
    technician: "الفني المسؤول",
    runningHours: "ساعات التشغيل",
    partsReplaced: "قطع الغيار المستبدلة",
    nextServiceDue: "موعد الصيانة القادم",
    serviceCost: "تكلفة الصيانة",
    procurement: "المشتريات",
    gasContract: "عقد الغاز",
    payroll: "سجل الرواتب",
    gasBalance: "رصيد الغاز",
    prepaidOktan: "أوكتان مسبق الدفع",
    salaryMonth: "الشهر",
    paidTo: "دفع لـ",
    undo: "تراجع عن آخر خطوة",
    finalize: "اعتماد السجل وتصفيره",
    gaz: "غاز",
    gasPerPort: "استهلاك الغاز / ميناء",
    gasPerUnit: "استهلاك الغاز / وحدة",
    oktanAdvisor: "مستشار أوكتان الاستراتيجي",
    estLitersLeft: "لترات متبقية (تقديري)",
    daysLeft: "أيام تشغيل متبقية",
    geminiCostAdvisor: "خطة جيمي لتقليل التكاليف",
    genReport: "إنشاء تقرير رسمي",
    finReport: "التقرير المالي",
    opsReport: "التقرير التشغيلي",
    fuelReport: "تقرير استهلاك الوقود",
    employeeName: "اسم الموظف",
    position: "المنصب",
    baseSalary: "الراتب الأساسي",
    totalEarnings: "إجمالي المستحقات",
    totalAdvances: "إجمالي السلف",
    remainingBalance: "الرصيد المتبقي",
    addEmployee: "إضافة موظف جديد",
    advance: "سلفة",
    bonus: "مكافأة",
    deploySalary: "صرف الرواتب",
    overdrawn: "متجاوز الرصيد",
    healthy: "رصيد متاح",
    transactions: "العمليات",
    periodFrom: "من تاريخ",
    periodTo: "إلى تاريخ",
    printPdf: "طباعة PDF",
    auditSummary: "ملخص التدقيق",
    revenueInflow: "الإيرادات الداخلة",
    expenseOutflow: "المصروفات الخارجة",
    totalDeployments: "إجمالي الرحلات",
    totalFuelBurn: "إجمالي حرق الوقود",
    details: "التفاصيل",
    category: "الفئة",
    value: "القيمة",
    login: "تسجيل الدخول",
    accessKey: "مفتاح الدخول",
    corporateEmail: "البريد الإلكتروني للشركة",
    etaConfig: "إعدادات منظومة الضرائب",
    taxpayerId: "رقم التسجيل الضريبي",
    activityCode: "كود النشاط",
    branchCode: "كود الفرع",
    securitySeal: "الختم الإلكتروني",
    hsmToken: "جهاز التوقيع الإلكتروني",
    detectHardware: "البحث عن الجهاز",
    installDriver: "Setup Driver",
    saveConfig: "حفظ الإعدادات",
    hubControl: "إدارة المركز",
    processGate: "عمليات البوابة",
    hubLedger: "سجل المركز",
    activeTerminal: "المحطة النشطة",
    targetPort: "ميناء الوصول",
    dispatchUnit: "خروج مولد",
    portMove: "نقل داخلي",
    selectUnits: "اختيار الوحدات",
    unitsSelected: "وحدات مختارة",
    singleUnitExit: "خروج وحدة واحدة",
    snNode: "رقم الوحدة",
    hubInventoryEmpty: "مخزون المركز فارغ",
    containerId: "رقم الحاوية",
    scanPhoto: "مسح الصورة",
    booking: "الحجز",
    manual: "يدوي",
    customerSelect: "اختر العميل...",
    unitTransferReady: "جاهز لنقل الوحدات",
    unitsLoggedArriving: "سيتم تسجيل وصول الوحدات المختارة إلى",
    terminalActiveLedger: "سجل المحطة النشط",
    records: "Records",
    bookingNode: "Booking Node",
    operatorShipper: "Operator / Shipper",
    gensetContainer: "Genset / Container",
    operatingDate: "Operating Date",
    unassigned: "Unassigned",
    authorizeExit: "Authorize Exit",
    transferUnits: "Transfer Units",
    resetGateForm: "Reset Gate Form",
    verifyAction: "Verify Action",
    sourceHub: "Source Hub",
    targetHub: "Target Hub",
    gensetsToBeProcessed: "Gensets to be processed:",
    finalCommit: "Final Commit",
    cancelAndReturn: "Cancel and Return",
    noActiveDeployments: "No active deployments found at this hub.",
    
    // Boss Review
    pendingReview: "بانتظار مراجعة الإدارة",
    verifiedByBoss: "تم الاعتماد نهائياً",
    authorizeRecord: "اعتماد بيان الرحلة",
    bossAudit: "وضع تدقيق الإدارة نشط",

    // Financials
    unpaidMoney: "إجمالي المستحقات غير المحصلة",
    liveUnbilled: "إيرادات لم تُفوتر بعد",
    historicalLoad: "مديونية تاريخية مسبقة",
    activeTrips: "الرحلات النشطة حالياً",
    partnerPortfolios: "محافظ الشركاء التجاريين",
    commercialWallet: "المحفظة التجارية",
    netBalanceDue: "صافي الرصيد المستحق",
    historicalIndebtedness: "سجل المديونية التاريخية",
    authorizeBilling: "اعتماد الفواتير للمختارة",
    receivePayment: "تسجيل تحصيل نقدية",

    // Expense Hub
    expenseCommand: "مركز إدارة المصروفات",
    unifiedOutflow: "سجل المصروفات الموحد",
    addEntry: "إضافة عملية",
    procurementItem: "وصف الصنف / الخدمة",
    requestor: "مقدم الطلب",
    workers: "أسماء العمال / الموظفين",
    fareAmount: "قيمة التوصيل / الأجرة",
    rentPaid: "قيمة الإيجار المسددة",
    
    // Login
    secureTerminal: "دخول آمن للمنصة",
    gensetForce: "قوة المولدات",
    coldChain: "الطاقة الموثوقة لسلاسل التبريد العالمية.",
    initializeCommand: "بدء التشغيل",
    strategicPasskey: "كلمة المرور الاستراتيجية",
    networkIdentity: "الهوية الرقمية (الإيميل)",
    requestNode: "طلب صلاحية وصول",

    // Import Hub
    importHub: "مركز الاستيراد الذكي",
    uploadPrompt: "اسحب ملف الإكسيل هنا للمطابقة الذكية",
    mappingEngine: "AI-Powered Mapping Engine",
    standardTemplate: "تحميل النموذج القياسي",
    authorizeInjection: "اعتماد حقن البيانات"
  }
};
