// The two closing texts and what the gear choices do.
import { CFG } from './config.js';

export const ENDINGS = {
  won: {
    title: 'The Door Closes',
    text: 'The great door shuts behind you and the dark stays outside. The light of the Redoubt is on your face, and your companion is laughing and crying at once. What you woke out on the plain is still awake, and it will not be quiet for long. But you came home, and you carry what it showed you. Tomorrow someone will have to decide what it means.',
  },
  lost: {
    title: 'The Dark Takes You',
    text: 'The hum is inside your head now, and your companion\'s voice grows thin and far away, and then you cannot hear it at all. You stand quite still on the plain. Behind you the Redoubt burns on, small and gold, and it does not know. Perhaps your companion will keep a light for you in the window. Perhaps the next Night-Walker will find the place where you stopped.',
  },
};

// Gear: what each choice changes at the start.
export const GEAR = {
  cell:  { power: CFG.power + CFG.spareCellBonus, trust: CFG.trustStart, stealthMul: 1 },
  cloak: { power: CFG.power, trust: CFG.trustStart, stealthMul: 1.7 },
  token: { power: CFG.power, trust: CFG.trustTokenStart, stealthMul: 1 },
};
