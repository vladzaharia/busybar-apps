// The messages Pkmn Life can show, shared by the asset build (which renders their animations) and the app (which
// lists them on the back). Messages are printable ASCII: the device fonts have nothing else.

export interface Preset {
  /** Short, move-style name for the back-screen menu (small font, up to ~110 px). */
  move: string;
  /** The nag itself. */
  message: string;
  /** Words the ticker highlights in blue (they must appear in the upper-cased message). */
  accent: string[];
}

export const PRESETS: Preset[] = [
  { move: "FILE A TICKET", message: "Did you file a JIRA ticket yet???", accent: ["JIRA"] },
  { move: "TICKET CHECK", message: "Is there a ticket for that?", accent: ["TICKET"] },
  { move: "NO TICKET NO WORK", message: "No ticket, no work!", accent: ["TICKET"] },
  { move: "IN PROGRESS", message: "Move your ticket to In Progress!", accent: ["IN PROGRESS"] },
  { move: "LINK THE PR", message: "Link the ticket in your PR!", accent: ["PR"] },
];

export type NagStyle = "encounter" | "ticker";
