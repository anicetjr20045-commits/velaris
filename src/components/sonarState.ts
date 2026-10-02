export type SonarState = 'idle' | 'listening' | 'searching' | 'writing';

export const SONAR_STATE_LABEL: Record<SonarState, string> = {
  idle: 'Disponible',
  listening: 'En écoute',
  searching: 'Recherche dans vos données',
  writing: 'Rédaction en cours',
};
