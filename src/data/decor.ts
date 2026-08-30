import type { DecorKind } from "./types";

export interface DecorDef {
  id: DecorKind;
  nameHe: string;
  nameEn: string;
  cost: number;
  /** Manhattan aura radius */
  radius: number;
  /** Mood points per second while a guest is in aura */
  moodPerSec: number;
  /** Contribution to park satisfaction (capped later) */
  beauty: number;
  refundRate: number;
}

export const DECOR: DecorDef[] = [
  {
    id: "flower",
    nameHe: "ערוגת פרחים",
    nameEn: "Flower bed",
    cost: 40,
    radius: 1,
    moodPerSec: 0.9,
    beauty: 1.2,
    refundRate: 0.4,
  },
  {
    id: "bush",
    nameHe: "שיח ירוק",
    nameEn: "Bush",
    cost: 55,
    radius: 1,
    moodPerSec: 0.65,
    beauty: 1.4,
    refundRate: 0.4,
  },
  {
    id: "tree",
    nameHe: "עץ צל",
    nameEn: "Shade tree",
    cost: 90,
    radius: 2,
    moodPerSec: 0.85,
    beauty: 2.2,
    refundRate: 0.4,
  },
  {
    id: "statue",
    nameHe: "פסל נוי",
    nameEn: "Ornamental statue",
    cost: 200,
    radius: 2,
    moodPerSec: 1.35,
    beauty: 3.5,
    refundRate: 0.4,
  },
];

export function getDecor(id: string): DecorDef | undefined {
  return DECOR.find((d) => d.id === id);
}
