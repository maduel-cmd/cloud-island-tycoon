import type { Visitor } from "../data/types";

/** מבקר לבדיקות יחידה — ממלא שדות אנימציה/מראה */
export function mockVisitor(
  partial: Partial<Visitor> & Pick<Visitor, "id" | "pos">,
): Visitor {
  return {
    pixel: { x: partial.pos.x + 0.5, y: partial.pos.y + 0.5 },
    path: [],
    state: "wandering",
    mood: 70,
    wallet: 50,
    targetId: null,
    rideTimer: 0,
    restTimer: 0,
    color: "#3b82f6",
    litterCooldown: 99,
    archetype: 0,
    ageBand: "adult",
    hunger: 30,
    thirst: 25,
    heldProp: "none",
    interactTimer: 0,
    thoughtEmoji: null,
    thoughtTimer: 0,
    facing: "se",
    walkPhase: 0,
    talkTimer: 0,
    talkPartnerId: null,
    skin: "#f5d0b0",
    hair: "#1c1917",
    ...partial,
  };
}
