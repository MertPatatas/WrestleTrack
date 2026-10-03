import type { Lang } from '../i18n/config';

// Textos legales de WrestleTrack. Si cambia lo que la app hace con los datos, actualiza el texto
// y la fecha LEGAL_UPDATED.

export const LEGAL_UPDATED = '2026-10-03';
export const GITHUB_ISSUES = 'https://github.com/MertPatatas/WrestleTrack/issues';
// Email de contacto público. Se puede cambiar con la variable NEXT_PUBLIC_CONTACT_EMAIL.
export const CONTACT_EMAIL: string | null = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'Wrestle.Track.app@gmail.com';

export interface LegalSection {
  title: string;
  paragraphs?: string[]; // antes de la lista
  list?: string[];
  note?: string[]; // después de la lista
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

function contact(lang: Lang): string {
  if (lang === 'es') {
    return CONTACT_EMAIL
      ? `Puedes escribir a ${CONTACT_EMAIL}.`
      : `Puedes contactar abriendo una incidencia en ${GITHUB_ISSUES} (no incluyas datos personales en ella; te indicaremos un canal privado si hace falta).`;
  }
  return CONTACT_EMAIL
    ? `You can write to ${CONTACT_EMAIL}.`
    : `You can get in touch by opening an issue at ${GITHUB_ISSUES} (do not include personal data in it; we will give you a private channel if needed).`;
}

// ---------------------------------------------------------------- Política de privacidad

export function privacyPolicy(lang: Lang): LegalDoc {
  if (lang === 'en') return privacyEn();
  return {
    title: 'Política de privacidad',
    intro:
      'WrestleTrack es un proyecto personal, gratuito y sin ánimo de lucro para seguir noticias, storylines y el calendario de shows de lucha libre. Esta política explica qué datos se guardan cuando lo usas, para qué y qué puedes hacer con ellos.',
    sections: [
      {
        title: '1. Responsable',
        paragraphs: [
          `El responsable de los datos es quien mantiene WrestleTrack (proyecto publicado en https://github.com/MertPatatas/WrestleTrack). ${contact('es')}`,
        ],
      },
      {
        title: '2. Qué datos guardamos',
        list: [
          'Cuenta: tu dirección de email. Si entras con Google, Google nos facilita además tu nombre y tu foto de perfil. También se registran la fecha de alta y la del último acceso.',
          'Ajustes: zona horaria, idioma, promociones favoritas y preferencias de notificaciones. Además, la zona horaria, el idioma y el formato regional de tu navegador, para enviarte los avisos en tu hora y en tu idioma.',
          'Notificaciones: por cada dispositivo en el que las actives, la dirección de suscripción que genera el navegador y sus claves de cifrado. También un registro de los avisos enviados (cuál y cuándo), que se borra a los 30 días, para no repetirlos.',
          'Registros técnicos: el proveedor de alojamiento guarda temporalmente datos de las peticiones (como la dirección IP y el navegador) por seguridad y para resolver errores.',
        ],
        note: [
          'No usamos publicidad ni herramientas de analítica o seguimiento, no creamos perfiles con fines comerciales y no vendemos ni cedemos tus datos.',
        ],
      },
      {
        title: '3. Para qué los usamos y base legal',
        list: [
          'Darte acceso con tu cuenta y mantener tus ajustes sincronizados entre dispositivos (ejecución de las condiciones del servicio que aceptas al registrarte, art. 6.1.b del RGPD).',
          'Enviarte las notificaciones que tú configures (misma base; puedes desactivarlas cuando quieras).',
          'Mantener el servicio seguro y funcionando (interés legítimo, art. 6.1.f del RGPD).',
        ],
      },
      {
        title: '4. Cookies y almacenamiento en tu dispositivo',
        list: [
          'Cookies de sesión de Supabase: necesarias para mantener tu sesión iniciada.',
          'Cookie «wt-settings»: guarda tu zona horaria, idioma y favoritos para mostrar la web correctamente desde la primera carga.',
          'Almacenamiento local del navegador: recuerda el filtro de idioma de la sección de noticias.',
          'Service worker: guarda una copia de las páginas para que la app funcione sin conexión y muestra las notificaciones.',
        ],
        note: ['Todas son técnicas y necesarias para el funcionamiento; no hay cookies de publicidad ni de analítica.'],
      },
      {
        title: '5. Con quién se comparten (proveedores)',
        paragraphs: ['Para funcionar, WrestleTrack usa estos servicios, que tratan datos solo para prestarnos su servicio:'],
        list: [
          'Vercel Inc.: alojamiento de la web.',
          'Supabase: inicio de sesión y base de datos.',
          'Google: inicio de sesión con Google (si lo eliges) y envío de los emails de acceso desde una cuenta de Gmail.',
          'Upstash: programa la revisión periódica de avisos; no recibe datos personales.',
          'Servicios de notificaciones del navegador o del sistema (Google, Apple, Mozilla, Microsoft): reciben el contenido de cada aviso y la dirección de tu dispositivo para entregarlo.',
        ],
      },
      {
        title: '6. Transferencias internacionales',
        paragraphs: [
          'Algunos de estos proveedores están en Estados Unidos o pueden tratar datos fuera del Espacio Económico Europeo. En esos casos lo hacen con las garantías que exige el RGPD, como el Marco de Privacidad de Datos UE-EE. UU. o las cláusulas contractuales tipo de la Comisión Europea.',
        ],
      },
      {
        title: '7. Contenido de otras webs',
        paragraphs: [
          'Las noticias, horarios y datos de eventos se obtienen de fuentes públicas (webs de noticias, TVmaze, la web de NJPW y Wikipedia) desde nuestro servidor: no les enviamos tus datos. Las miniaturas de las noticias se cargan directamente desde la web de origen, que puede ver tu dirección IP. Al abrir una noticia o un enlace externo, se aplica la política de privacidad de esa web.',
        ],
      },
      {
        title: '8. Cuánto tiempo los guardamos',
        paragraphs: [
          'Mientras tu cuenta exista. Si la eliminas, se borran tu perfil, tus dispositivos y el registro de avisos. El registro de avisos enviados se borra además a los 30 días. Los registros técnicos del alojamiento se conservan el tiempo que establece cada proveedor.',
        ],
      },
      {
        title: '9. Tus derechos',
        paragraphs: [
          'Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento, limitarlo y pedir su portabilidad. Puedes cambiar tus ajustes en Perfil y eliminar tu cuenta y todos sus datos con el botón «Eliminar cuenta» del Perfil. Para el resto de derechos, usa el contacto del apartado 1.',
          'Si consideras que no hemos atendido bien tus derechos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
        ],
      },
      {
        title: '10. Edad mínima',
        paragraphs: ['WrestleTrack está pensado para mayores de 14 años. Si eres menor de esa edad, no crees una cuenta.'],
      },
      {
        title: '11. Seguridad',
        paragraphs: [
          'Toda la comunicación va cifrada (HTTPS). La base de datos solo es accesible desde nuestro servidor y cada usuario solo puede ver y cambiar sus propios datos.',
        ],
      },
      {
        title: '12. Cambios en esta política',
        paragraphs: [
          'Si cambia lo que hacemos con tus datos, actualizaremos esta página y su fecha. Si el cambio es importante, lo avisaremos en la propia app.',
        ],
      },
    ],
  };
}

function privacyEn(): LegalDoc {
  return {
    title: 'Privacy policy',
    intro:
      'WrestleTrack is a personal, free and non-profit project to follow pro wrestling news, storylines and the show calendar. This policy explains which data is stored when you use it, why, and what you can do about it.',
    sections: [
      {
        title: '1. Controller',
        paragraphs: [
          `The data controller is whoever maintains WrestleTrack (project published at https://github.com/MertPatatas/WrestleTrack). ${contact('en')}`,
        ],
      },
      {
        title: '2. What we store',
        list: [
          'Account: your email address. If you sign in with Google, Google also gives us your name and profile picture. Sign-up and last sign-in dates are recorded too.',
          'Settings: time zone, language, favorite promotions and notification preferences. Also your browser time zone, language and regional format, so alerts are sent in your time and language.',
          'Notifications: for each device where you turn them on, the subscription address created by the browser and its encryption keys. Also a log of the alerts sent (which one and when), deleted after 30 days, so they are not repeated.',
          'Technical logs: the hosting provider temporarily keeps request data (such as IP address and browser) for security and troubleshooting.',
        ],
        note: [
          'We do not use advertising or analytics/tracking tools, we do not build commercial profiles and we do not sell or share your data.',
        ],
      },
      {
        title: '3. Why we use it and legal basis',
        list: [
          'To give you access with your account and keep your settings synced across devices (performance of the terms of service you accept when signing up, GDPR art. 6.1.b).',
          'To send you the notifications you configure (same basis; you can turn them off at any time).',
          'To keep the service secure and running (legitimate interest, GDPR art. 6.1.f).',
        ],
      },
      {
        title: '4. Cookies and storage on your device',
        list: [
          'Supabase session cookies: required to keep you signed in.',
          '“wt-settings” cookie: stores your time zone, language and favorites so the site is shown correctly from the first load.',
          'Browser local storage: remembers the language filter of the news section.',
          'Service worker: keeps a copy of pages so the app works offline, and shows notifications.',
        ],
        note: ['All of them are technical and necessary; there are no advertising or analytics cookies.'],
      },
      {
        title: '5. Who we share it with (providers)',
        paragraphs: ['To work, WrestleTrack uses these services, which process data only to provide their service to us:'],
        list: [
          'Vercel Inc.: website hosting.',
          'Supabase: sign-in and database.',
          'Google: Google sign-in (if you choose it) and sending sign-in emails from a Gmail account.',
          'Upstash: schedules the periodic alert check; it receives no personal data.',
          'Browser or operating system notification services (Google, Apple, Mozilla, Microsoft): they receive each alert’s content and your device address in order to deliver it.',
        ],
      },
      {
        title: '6. International transfers',
        paragraphs: [
          'Some of these providers are in the United States or may process data outside the European Economic Area. In those cases they do so with the safeguards required by the GDPR, such as the EU-US Data Privacy Framework or the European Commission’s standard contractual clauses.',
        ],
      },
      {
        title: '7. Content from other sites',
        paragraphs: [
          'News, schedules and event data are fetched from public sources (news sites, TVmaze, the NJPW website and Wikipedia) by our server: your data is not sent to them. News thumbnails load directly from the original site, which may see your IP address. When you open a story or an external link, that site’s privacy policy applies.',
        ],
      },
      {
        title: '8. How long we keep it',
        paragraphs: [
          'As long as your account exists. If you delete it, your profile, devices and alert log are erased. The alert log is also deleted after 30 days. Hosting logs are kept for the period set by each provider.',
        ],
      },
      {
        title: '9. Your rights',
        paragraphs: [
          'You can access, correct and delete your data, object to or restrict its processing, and request portability. You can change your settings in Profile and delete your account and all its data with the “Delete account” button in Profile. For the other rights, use the contact in section 1.',
          'If you believe your rights were not properly handled, you can complain to your data protection authority (in Spain, the AEPD: www.aepd.es).',
        ],
      },
      {
        title: '10. Minimum age',
        paragraphs: ['WrestleTrack is intended for people aged 14 or over. If you are younger, do not create an account.'],
      },
      {
        title: '11. Security',
        paragraphs: [
          'All communication is encrypted (HTTPS). The database is only reachable from our server and each user can only see and change their own data.',
        ],
      },
      {
        title: '12. Changes to this policy',
        paragraphs: [
          'If what we do with your data changes, we will update this page and its date. If the change is significant, we will announce it in the app.',
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------- Condiciones del servicio

export function termsOfService(lang: Lang): LegalDoc {
  if (lang === 'en') return termsEn();
  return {
    title: 'Condiciones del servicio',
    intro:
      'Estas condiciones regulan el uso de WrestleTrack. Al crear una cuenta o usar la app, las aceptas. Si no estás de acuerdo, no la uses.',
    sections: [
      {
        title: '1. Qué es WrestleTrack',
        paragraphs: [
          'Un proyecto personal, gratuito y sin ánimo de lucro, hecho por aficionados, que reúne noticias, storylines y el calendario de shows de lucha libre, y envía avisos opcionales.',
        ],
      },
      {
        title: '2. Sin relación con las promociones',
        paragraphs: [
          'WrestleTrack no está afiliado, patrocinado ni respaldado por WWE, AEW, CMLL, Lucha Libre AAA, NJPW ni ninguna otra empresa de lucha libre o cadena de televisión. Sus nombres y marcas pertenecen a sus propietarios y aquí solo se usan para identificar los eventos.',
        ],
      },
      {
        title: '3. Tu cuenta',
        list: [
          'Necesitas una cuenta para usar la app. Puedes crearla con Google o con tu email.',
          'Eres responsable de lo que se haga con tu cuenta y de mantener seguro el acceso a tu email o tu cuenta de Google.',
          'Puedes eliminar tu cuenta en cualquier momento desde el Perfil.',
        ],
      },
      {
        title: '4. Uso aceptable',
        paragraphs: ['Al usar WrestleTrack te comprometes a no:'],
        list: [
          'Intentar acceder a cuentas o datos de otras personas, o a partes del servicio que no son públicas.',
          'Hacer peticiones automatizadas masivas, sobrecargar el servicio o intentar saltarse sus medidas de seguridad.',
          'Usar la app para fines ilegales o para molestar a otras personas.',
        ],
      },
      {
        title: '5. Contenido de terceros',
        list: [
          'Las noticias se muestran como titular y extracto breve, con enlace a la web original; sus derechos pertenecen a sus autores.',
          'Los horarios y eventos se recopilan automáticamente de fuentes públicas (como TVmaze, la web de NJPW y Wikipedia, cuyos contenidos están bajo licencia CC BY-SA). Pueden contener errores o cambiar a última hora: compruébalos en las fuentes oficiales si es importante para ti.',
          'Los carteles de los eventos se muestran directamente desde su fuente (Wikipedia o la web de NJPW) para identificar cada evento; sus derechos pertenecen a las promotoras.',
          'Los resúmenes de storylines son orientativos.',
        ],
      },
      {
        title: '6. Notificaciones',
        paragraphs: [
          'Los avisos se envían con la mejor intención, pero pueden llegar tarde o no llegar: dependen de las fuentes de horarios, de tu dispositivo, de tu conexión y de los servicios de notificaciones del sistema.',
        ],
      },
      {
        title: '7. Disponibilidad',
        paragraphs: [
          'El servicio es gratuito y se ofrece «tal cual», sin garantías. Puede cambiar, interrumpirse temporalmente o dejar de existir, en cuyo caso intentaremos avisar con antelación.',
        ],
      },
      {
        title: '8. Responsabilidad',
        paragraphs: [
          'En la medida en que lo permita la ley, WrestleTrack no se hace responsable de daños derivados del uso de la app, de errores en los horarios o noticias, ni del contenido de webs externas. Nada de esto limita los derechos que te reconoce la normativa de consumidores.',
        ],
      },
      {
        title: '9. Suspensión de cuentas',
        paragraphs: [
          'Podemos suspender o eliminar cuentas que incumplan estas condiciones, especialmente si ponen en riesgo el servicio o a otras personas.',
        ],
      },
      {
        title: '10. Cambios en las condiciones',
        paragraphs: [
          'Si cambiamos estas condiciones, actualizaremos esta página y su fecha. Si el cambio es importante, lo avisaremos en la app. Seguir usándola después implica aceptar la nueva versión.',
        ],
      },
      {
        title: '11. Ley aplicable',
        paragraphs: [
          'Estas condiciones se rigen por la ley española. Si eres consumidor, conservas los derechos que te otorga la normativa de tu país de residencia.',
        ],
      },
      {
        title: '12. Contacto',
        paragraphs: [contact('es'), 'El tratamiento de tus datos se explica en la Política de privacidad.'],
      },
    ],
  };
}

function termsEn(): LegalDoc {
  return {
    title: 'Terms of service',
    intro:
      'These terms govern the use of WrestleTrack. By creating an account or using the app, you accept them. If you do not agree, do not use it.',
    sections: [
      {
        title: '1. What WrestleTrack is',
        paragraphs: [
          'A personal, free and non-profit project made by fans that brings together pro wrestling news, storylines and the show calendar, and sends optional alerts.',
        ],
      },
      {
        title: '2. Not affiliated with the promotions',
        paragraphs: [
          'WrestleTrack is not affiliated with, sponsored or endorsed by WWE, AEW, CMLL, Lucha Libre AAA, NJPW or any other wrestling company or TV network. Their names and trademarks belong to their owners and are used here only to identify events.',
        ],
      },
      {
        title: '3. Your account',
        list: [
          'You need an account to use the app. You can create it with Google or with your email.',
          'You are responsible for what is done with your account and for keeping access to your email or Google account secure.',
          'You can delete your account at any time from Profile.',
        ],
      },
      {
        title: '4. Acceptable use',
        paragraphs: ['When using WrestleTrack you agree not to:'],
        list: [
          'Try to access other people’s accounts or data, or non-public parts of the service.',
          'Make mass automated requests, overload the service or try to bypass its security measures.',
          'Use the app for illegal purposes or to harass other people.',
        ],
      },
      {
        title: '5. Third-party content',
        list: [
          'News is shown as a headline and short excerpt linking to the original site; its rights belong to its authors.',
          'Schedules and events are collected automatically from public sources (such as TVmaze, the NJPW website and Wikipedia, whose content is licensed under CC BY-SA). They may contain errors or change at the last minute: check official sources if it matters to you.',
          'Event posters are shown directly from their source (Wikipedia or the NJPW website) to identify each event; their rights belong to the promotions.',
          'Storyline summaries are for guidance only.',
        ],
      },
      {
        title: '6. Notifications',
        paragraphs: [
          'Alerts are sent on a best-effort basis but may arrive late or not at all: they depend on the schedule sources, your device, your connection and the system notification services.',
        ],
      },
      {
        title: '7. Availability',
        paragraphs: [
          'The service is free and provided “as is”, without warranties. It may change, be temporarily interrupted or cease to exist, in which case we will try to give notice in advance.',
        ],
      },
      {
        title: '8. Liability',
        paragraphs: [
          'To the extent permitted by law, WrestleTrack is not liable for damages arising from the use of the app, errors in schedules or news, or the content of external sites. None of this limits your rights under consumer protection law.',
        ],
      },
      {
        title: '9. Account suspension',
        paragraphs: [
          'We may suspend or delete accounts that break these terms, especially if they put the service or other people at risk.',
        ],
      },
      {
        title: '10. Changes to the terms',
        paragraphs: [
          'If we change these terms, we will update this page and its date. If the change is significant, we will announce it in the app. Continuing to use it afterwards means you accept the new version.',
        ],
      },
      {
        title: '11. Governing law',
        paragraphs: [
          'These terms are governed by Spanish law. If you are a consumer, you keep the rights granted by the law of your country of residence.',
        ],
      },
      {
        title: '12. Contact',
        paragraphs: [contact('en'), 'How your data is handled is explained in the Privacy policy.'],
      },
    ],
  };
}
