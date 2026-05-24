// ═══ i18n: sk / en / fr ═══
// Pravá lišta (zoznam projektov) je úmyselne bilingválna a NIE JE súčasťou i18n.

window.I18N = {
  sk: {
    flag: '🇸🇰',
    switchBtn: 'Zmeniť jazyk',

    // History panel
    historyTitle: 'História',
    historyCount: (n, max) => `${n} / ${max}`,
    historyEmpty: 'Zatiaľ žiadne kódy.\nVygenerované QR sa zobrazia tu.',
    historyClear: 'Vymazať históriu',
    historyClearConfirm: 'Naozaj vymazať celú históriu?',
    historyItemDelete: 'Vymazať záznam',
    historyJustNow: 'pred chvíľou',
    historyMinAgo: (n) => `pred ${n} min`,
    historyHourAgo: (n) => `pred ${n} h`,
    historyDayAgo: (n) => `pred ${n} d`,

    // Donations
    donationTitle: 'Podporte projekt',
    donationInstruction: 'Na skenovanie použi bankovú aplikáciu',
    donationText: 'Stránka je zadarmo, bez reklamy. Beží na platených službách — dobrovoľný príspevok pomôže udržať ju v chode.',
    qrHint: 'Sumu môžete v aplikácii zmeniť',
    qrFixed10: 'Pevná suma 10 €',
    qrFixed100: 'Pevná suma 100 €',
    qrTabVariable: 'Voľná',
    ibanCopyTitle: 'Skopírovať IBAN',

    // Main panel
    typeLabel: 'Typ kódu',
    types: {
      url: 'URL adresa',
      text: 'Text',
      wifi: 'WiFi sieť',
      vcard: 'Kontakt (vCard)',
      email: 'Email',
      sms: 'SMS',
      geo: 'Geolokácia',
    },

    sensitiveWarning: 'Tento typ obsahuje citlivé údaje — neuloží sa do histórie.',

    // Per-type inputs
    inputs: {
      urlPlaceholder: 'https://example.com',
      textPlaceholder: 'Akýkoľvek text...',
      wifiSsid: 'Názov siete (SSID)',
      wifiPassword: 'Heslo',
      wifiEncryption: 'Zabezpečenie',
      wifiHidden: 'Skrytá sieť',
      vcardName: 'Meno a priezvisko',
      vcardPhone: 'Telefón',
      vcardEmail: 'Email',
      vcardOrg: 'Firma',
      vcardUrl: 'Webstránka',
      emailTo: 'Adresát',
      emailSubject: 'Predmet',
      emailBody: 'Telo správy',
      smsPhone: 'Telefónne číslo',
      smsBody: 'Správa',
      geoLat: 'Zemepisná šírka',
      geoLng: 'Zemepisná dĺžka',
    },

    // Styling
    stylingTitle: 'Vzhľad',
    sizeLabel: 'Veľkosť',
    eccLabel: 'Korekcia chýb',
    eccHint: 'Vyššia úroveň = väčší kód, ale odolnejší voči poškodeniu.',
    eccAutoLogo: 'Pri logu automaticky H',
    colorsLabel: 'Farby',
    fgColor: 'Popredie',
    bgColor: 'Pozadie',
    logoLabel: 'Logo (voliteľné)',
    logoUpload: 'Pridať logo',
    logoRemove: 'Odstrániť',

    // Output
    outputEmpty: 'Vyplňte vstup pre náhľad QR kódu',
    dlPng: 'PNG',
    dlSvg: 'SVG',
    copyClipboard: 'Skopírovať',
    copied: 'Skopírované ✓',

    // Right panel header
    toolsTitle: 'Nástroje',

    // Cookie banner
    cookieText: '🍪 <strong>Stránka používa lokálne úložisko</strong> na ukladanie histórie a jazyka. Anonymné štatistiky návštevnosti cez Cloudflare (bez cookies). Žiadne reklamy, žiadne cookies tretích strán, žiadny personalizovaný tracking.',
    cookieBtn: 'Rozumiem',

    // Errors
    err: {
      emptyInput: 'Vyplňte všetky povinné polia.',
      invalidUrl: 'Neplatná URL adresa.',
      logoTooLarge: 'Logo je príliš veľké. Max 500 KB.',
      logoInvalid: 'Súbor nie je platný obrázok.',
      copyFail: 'Kopírovanie zlyhalo.',
      generic: 'Niečo sa pokazilo.',
    },
  },

  en: {
    flag: '🇬🇧',
    switchBtn: 'Change language',

    historyTitle: 'History',
    historyCount: (n, max) => `${n} / ${max}`,
    historyEmpty: 'No codes yet.\nGenerated QR codes will appear here.',
    historyClear: 'Clear history',
    historyClearConfirm: 'Really clear all history?',
    historyItemDelete: 'Delete entry',
    historyJustNow: 'just now',
    historyMinAgo: (n) => `${n} min ago`,
    historyHourAgo: (n) => `${n} h ago`,
    historyDayAgo: (n) => `${n} d ago`,

    donationTitle: 'Support the project',
    donationInstruction: 'Use your banking app to scan',
    donationText: 'This site is free, no ads. It runs on paid services — a voluntary contribution helps keep it running.',
    qrHint: 'You can change the amount in your app',
    qrFixed10: 'Fixed amount €10',
    qrFixed100: 'Fixed amount €100',
    qrTabVariable: 'Any',
    ibanCopyTitle: 'Copy IBAN',

    typeLabel: 'Code type',
    types: {
      url: 'URL address',
      text: 'Text',
      wifi: 'WiFi network',
      vcard: 'Contact (vCard)',
      email: 'Email',
      sms: 'SMS',
      geo: 'Geolocation',
    },

    sensitiveWarning: 'This type contains sensitive data — it will not be saved to history.',

    inputs: {
      urlPlaceholder: 'https://example.com',
      textPlaceholder: 'Any text...',
      wifiSsid: 'Network name (SSID)',
      wifiPassword: 'Password',
      wifiEncryption: 'Security',
      wifiHidden: 'Hidden network',
      vcardName: 'Full name',
      vcardPhone: 'Phone',
      vcardEmail: 'Email',
      vcardOrg: 'Organization',
      vcardUrl: 'Website',
      emailTo: 'Recipient',
      emailSubject: 'Subject',
      emailBody: 'Body',
      smsPhone: 'Phone number',
      smsBody: 'Message',
      geoLat: 'Latitude',
      geoLng: 'Longitude',
    },

    stylingTitle: 'Appearance',
    sizeLabel: 'Size',
    eccLabel: 'Error correction',
    eccHint: 'Higher level = larger code but more resilient to damage.',
    eccAutoLogo: 'Auto H with logo',
    colorsLabel: 'Colors',
    fgColor: 'Foreground',
    bgColor: 'Background',
    logoLabel: 'Logo (optional)',
    logoUpload: 'Add logo',
    logoRemove: 'Remove',

    outputEmpty: 'Fill in input to preview QR code',
    dlPng: 'PNG',
    dlSvg: 'SVG',
    copyClipboard: 'Copy',
    copied: 'Copied ✓',

    toolsTitle: 'Tools',

    cookieText: '🍪 <strong>This site uses local storage</strong> to save history and language. Anonymous visit statistics via Cloudflare (no cookies). No ads, no third-party cookies, no personalized tracking.',
    cookieBtn: 'Got it',

    err: {
      emptyInput: 'Fill in all required fields.',
      invalidUrl: 'Invalid URL address.',
      logoTooLarge: 'Logo is too large. Max 500 KB.',
      logoInvalid: 'File is not a valid image.',
      copyFail: 'Copy failed.',
      generic: 'Something went wrong.',
    },
  },

  fr: {
    flag: '🇫🇷',
    switchBtn: 'Changer de langue',

    historyTitle: 'Historique',
    historyCount: (n, max) => `${n} / ${max}`,
    historyEmpty: 'Aucun code pour le moment.\nLes QR générés apparaîtront ici.',
    historyClear: "Effacer l'historique",
    historyClearConfirm: "Effacer tout l'historique ?",
    historyItemDelete: "Supprimer l'entrée",
    historyJustNow: "à l'instant",
    historyMinAgo: (n) => `il y a ${n} min`,
    historyHourAgo: (n) => `il y a ${n} h`,
    historyDayAgo: (n) => `il y a ${n} j`,

    donationTitle: 'Soutenir le projet',
    donationInstruction: 'Utilisez votre application bancaire pour scanner',
    donationText: 'Ce site est gratuit, sans publicité. Il fonctionne sur des services payants — une contribution volontaire aide à le maintenir.',
    qrHint: "Vous pouvez modifier le montant dans l'application",
    qrFixed10: 'Montant fixe 10 €',
    qrFixed100: 'Montant fixe 100 €',
    qrTabVariable: 'Libre',
    ibanCopyTitle: "Copier l'IBAN",

    typeLabel: 'Type de code',
    types: {
      url: 'URL',
      text: 'Texte',
      wifi: 'Réseau WiFi',
      vcard: 'Contact (vCard)',
      email: 'Email',
      sms: 'SMS',
      geo: 'Géolocalisation',
    },

    sensitiveWarning: 'Ce type contient des données sensibles — il ne sera pas enregistré dans l\'historique.',

    inputs: {
      urlPlaceholder: 'https://example.com',
      textPlaceholder: 'N\'importe quel texte...',
      wifiSsid: 'Nom du réseau (SSID)',
      wifiPassword: 'Mot de passe',
      wifiEncryption: 'Sécurité',
      wifiHidden: 'Réseau caché',
      vcardName: 'Nom complet',
      vcardPhone: 'Téléphone',
      vcardEmail: 'Email',
      vcardOrg: 'Organisation',
      vcardUrl: 'Site web',
      emailTo: 'Destinataire',
      emailSubject: 'Sujet',
      emailBody: 'Corps',
      smsPhone: 'Numéro de téléphone',
      smsBody: 'Message',
      geoLat: 'Latitude',
      geoLng: 'Longitude',
    },

    stylingTitle: 'Apparence',
    sizeLabel: 'Taille',
    eccLabel: "Correction d'erreurs",
    eccHint: 'Niveau plus élevé = code plus grand, mais plus résistant aux dommages.',
    eccAutoLogo: 'Auto H avec logo',
    colorsLabel: 'Couleurs',
    fgColor: 'Premier plan',
    bgColor: 'Fond',
    logoLabel: 'Logo (optionnel)',
    logoUpload: 'Ajouter un logo',
    logoRemove: 'Retirer',

    outputEmpty: 'Remplissez le champ pour prévisualiser le QR',
    dlPng: 'PNG',
    dlSvg: 'SVG',
    copyClipboard: 'Copier',
    copied: 'Copié ✓',

    toolsTitle: 'Outils',

    cookieText: '🍪 <strong>Ce site utilise le stockage local</strong> pour enregistrer l\'historique et la langue. Statistiques de visite anonymes via Cloudflare (sans cookies). Pas de publicité, pas de cookies tiers, pas de suivi personnalisé.',
    cookieBtn: 'Compris',

    err: {
      emptyInput: 'Remplissez tous les champs obligatoires.',
      invalidUrl: 'URL invalide.',
      logoTooLarge: 'Logo trop volumineux. Max 500 Ko.',
      logoInvalid: 'Le fichier n\'est pas une image valide.',
      copyFail: 'Échec de la copie.',
      generic: 'Une erreur est survenue.',
    },
  },
};
