// Bilingual scripts shown in /sos for each emergency kind. Designed to
// give the user something to say to the officer / first responder /
// dispatcher in either language without thinking.

export type EmergencyKind =
  | "secondary_inspection"
  | "vehicle_breakdown"
  | "accident"
  | "lost_sentri"
  | "document_seizure"
  | "medical"
  | "other";

export interface SafetyScript {
  title_en: string;
  title_es: string;
  steps_en: string[];
  steps_es: string[];
  phrases: { en: string; es: string }[];
  hotlines: { label_en: string; label_es: string; number: string }[];
}

const COMMON_HOTLINES = [
  { label_en: "Emergency (US)", label_es: "Emergencia (EE.UU.)", number: "911" },
  { label_en: "Emergency (MX)", label_es: "Emergencia (MX)", number: "911" },
  { label_en: "US Embassy MX", label_es: "Embajada de EE.UU. MX", number: "+52 55 5080 2000" },
  { label_en: "MX Consulate (US)", label_es: "Consulado MX (EE.UU.)", number: "1-855-463-6395" },
];

export const SAFETY_SCRIPTS: Record<EmergencyKind, SafetyScript> = {
  secondary_inspection: {
    title_en: "Secondary inspection",
    title_es: "Inspección secundaria",
    steps_en: [
      "Stay calm. You have the right to remain silent regarding non-customs questions.",
      "Hand over the documents the officer requests — passport, registration, insurance.",
      "Do not consent to a search that goes beyond customs scope without a clear reason.",
      "Ask for the officer's badge number and name if you feel uncomfortable.",
      "If detained > 4 hours without explanation, request to call a family member or attorney.",
    ],
    steps_es: [
      "Mantén la calma. Tienes derecho a guardar silencio en temas que no sean aduanales.",
      "Entrega los documentos que el agente pida — pasaporte, tarjeta de circulación, seguro.",
      "No consientas inspecciones fuera del alcance aduanal sin una razón clara.",
      "Pide el número de placa y nombre del agente si te sientes incómodo.",
      "Si te detienen > 4 horas sin explicación, pide hablar con un familiar o abogado.",
    ],
    phrases: [
      { en: "I have nothing illegal to declare.", es: "No tengo nada ilegal que declarar." },
      { en: "I'd like to call a family member.", es: "Me gustaría llamar a un familiar." },
      { en: "May I have your badge number, please?", es: "¿Puede darme su número de placa, por favor?" },
      { en: "I'd like to speak with a supervisor.", es: "Me gustaría hablar con un supervisor." },
    ],
    hotlines: COMMON_HOTLINES,
  },
  vehicle_breakdown: {
    title_en: "Vehicle breakdown",
    title_es: "Falla mecánica",
    steps_en: [
      "Pull off the lane safely. Turn on hazards.",
      "If you're in line at the booth, ask the officer to wave you to the shoulder.",
      "Call your roadside assistance OR Mexico Green Angels (074) on the MX side.",
      "Do not abandon the vehicle in a customs zone — paperwork ties to your name.",
    ],
    steps_es: [
      "Sal del carril con seguridad. Pon las intermitentes.",
      "Si estás en la fila, pídele al agente que te haga señal para hacerte a un lado.",
      "Llama a tu asistencia vial O a los Ángeles Verdes (074) en el lado mexicano.",
      "No abandones el vehículo en zona aduanal — los papeles están a tu nombre.",
    ],
    phrases: [
      { en: "My car has a mechanical problem. I need to pull aside.", es: "Mi auto tiene una falla mecánica. Necesito hacerme a un lado." },
      { en: "I have called for a tow truck.", es: "Ya llamé a una grúa." },
    ],
    hotlines: [
      ...COMMON_HOTLINES,
      { label_en: "Green Angels (MX)", label_es: "Ángeles Verdes (MX)", number: "074" },
    ],
  },
  accident: {
    title_en: "Accident",
    title_es: "Accidente",
    steps_en: [
      "Make sure everyone is safe. Move out of traffic if possible.",
      "Call 911 (both sides). On the MX side, request the Tránsito (traffic police).",
      "Take photos: position of vehicles, license plates, license + insurance of all parties.",
      "Do NOT admit fault. Provide factual information only.",
      "Notify your Mexico auto insurance immediately if the accident is on the MX side.",
    ],
    steps_es: [
      "Asegúrate de que todos estén bien. Sal del tráfico si es posible.",
      "Llama al 911 (ambos lados). En México pide a Tránsito.",
      "Toma fotos: posición de los autos, placas, licencias y seguros de todos.",
      "NO admitas culpa. Da solo información factual.",
      "Avisa a tu seguro mexicano inmediatamente si fue en lado MX.",
    ],
    phrases: [
      { en: "Nobody is seriously injured.", es: "Nadie está gravemente herido." },
      { en: "I have Mexico car insurance — here is the policy number.", es: "Tengo seguro mexicano — aquí está el número de póliza." },
      { en: "I will not give a statement until my insurance representative is present.", es: "No daré declaración hasta que llegue mi representante del seguro." },
    ],
    hotlines: COMMON_HOTLINES,
  },
  lost_sentri: {
    title_en: "Lost SENTRI / NEXUS / Global Entry card",
    title_es: "Tarjeta SENTRI / NEXUS / Global Entry perdida",
    steps_en: [
      "Do NOT use the SENTRI lane without the card — penalties are severe.",
      "Use general lanes for now.",
      "File a replacement at ttp.cbp.dhs.gov within 24 hours.",
      "If stolen, file a police report — required for the replacement application.",
    ],
    steps_es: [
      "NO uses el carril SENTRI sin la tarjeta — las multas son severas.",
      "Usa los carriles generales por ahora.",
      "Solicita reposición en ttp.cbp.dhs.gov dentro de 24 horas.",
      "Si fue robada, levanta acta de policía — requerida para la reposición.",
    ],
    phrases: [
      { en: "I lost my SENTRI card and I will use general lanes.", es: "Perdí mi tarjeta SENTRI y usaré los carriles generales." },
    ],
    hotlines: [
      ...COMMON_HOTLINES,
      { label_en: "CBP TTP support", label_es: "Soporte CBP TTP", number: "1-855-347-8371" },
    ],
  },
  document_seizure: {
    title_en: "Document or vehicle seizure",
    title_es: "Decomiso de documento o vehículo",
    steps_en: [
      "Ask for a written notice of seizure (Customs Form 5955A in the US).",
      "Note the badge number, port code, time, and reason given.",
      "Do not sign anything you don't understand.",
      "Contact a customs attorney within 30 days — there is a window to file a petition.",
    ],
    steps_es: [
      "Pide aviso escrito del decomiso (en EE.UU.: Customs Form 5955A).",
      "Anota número de placa, código del puerto, hora y razón dada.",
      "No firmes nada que no entiendas.",
      "Contacta a un abogado aduanal dentro de 30 días — hay plazo para apelar.",
    ],
    phrases: [
      { en: "I would like a written explanation of this seizure.", es: "Me gustaría una explicación escrita de este decomiso." },
      { en: "I will not sign anything without legal counsel.", es: "No firmaré nada sin asesoría legal." },
    ],
    hotlines: COMMON_HOTLINES,
  },
  medical: {
    title_en: "Medical emergency",
    title_es: "Emergencia médica",
    steps_en: [
      "Call 911 immediately.",
      "If on a bridge, signal the nearest CBP/Aduana officer — they can radio for medics.",
      "Have your insurance card and any medication list ready.",
      "Mexican hospitals near the border accept US insurance for cash payment + reimbursement (keep receipts).",
    ],
    steps_es: [
      "Llama al 911 inmediatamente.",
      "Si estás en un puente, avisa al agente de Aduana o CBP más cercano — pueden pedir paramédicos.",
      "Ten lista tu tarjeta de seguro y lista de medicamentos.",
      "Hospitales mexicanos cerca de la frontera aceptan seguro de EE.UU. con pago directo + reembolso (guarda recibos).",
    ],
    phrases: [
      { en: "I need medical help — please call paramedics.", es: "Necesito ayuda médica — por favor llamen a los paramédicos." },
      { en: "I am allergic to ___.", es: "Soy alérgico a ___." },
    ],
    hotlines: COMMON_HOTLINES,
  },
  other: {
    title_en: "Other emergency",
    title_es: "Otra emergencia",
    steps_en: [
      "Stay safe. Move to a public area.",
      "Call 911 if there is any threat to life.",
      "Notify your emergency contacts via the SOS button.",
    ],
    steps_es: [
      "Mantente seguro. Muévete a un área pública.",
      "Llama al 911 si hay amenaza para la vida.",
      "Avisa a tus contactos de emergencia con el botón SOS.",
    ],
    phrases: [
      { en: "I need help.", es: "Necesito ayuda." },
    ],
    hotlines: COMMON_HOTLINES,
  },
};
