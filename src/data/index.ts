import type { Question } from '../core/types';
import { WETGEVING } from './wetgeving';
import { METEO } from './meteo';
import { MENS } from './mens';
import { COMMUNICATIE } from './communicatie';
import { AERODYNAMICA } from './aerodynamica';
import { TECHNIEK } from './techniek';
import { NAVIGATIE } from './navigatie';

/** The complete shipped question bank. */
export const BANK: Question[] = [
  ...WETGEVING,
  ...METEO,
  ...MENS,
  ...COMMUNICATIE,
  ...AERODYNAMICA,
  ...TECHNIEK,
  ...NAVIGATIE,
];
