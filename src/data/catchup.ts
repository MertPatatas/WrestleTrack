// Pestañas de "Ponme al día" (?tab=… en la dirección)
export const CATCHUP_TABS = ['resumenes', 'analisis', 'storylines'] as const;
export type CatchUpTab = (typeof CATCHUP_TABS)[number];
