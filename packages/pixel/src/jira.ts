// The Jira mark as hand-placed pixel art. Scaled down from the SVG, the 3.8 px step between the chevrons lands
// between pixels, so each chevron snaps differently and the top one comes out a pixel larger. Here one chevron
// is drawn once per size and stamped three times at whole-pixel offsets, so all three are identical.

export interface MarkSprite {
  /** Overall size of the square mark. */
  size: number;
  /** One chevron, row-major: "#" is lit. */
  chevron: string[];
  /** Top-left of each chevron within the mark: top, middle, bottom. */
  offsets: [number, number][];
}

/** Chevron: a bar along the top, rounded at its lower-left, turning down a column on the right that tapers out. */
export const MARK_SPRITES: Record<number, MarkSprite> = {
  16: {
    size: 16,
    chevron: [
      "########",
      "########",
      ".#######",
      ".....###",
      ".....###",
      ".....###",
      "......##",
      ".......#",
    ],
    offsets: [
      [8, 0],
      [4, 4],
      [0, 8],
    ],
  },
  12: {
    size: 12,
    chevron: [
      "######",
      ".#####",
      "....##",
      "....##",
      "....##",
      ".....#",
    ],
    offsets: [
      [6, 0],
      [3, 3],
      [0, 6],
    ],
  },
  11: {
    size: 11,
    chevron: [
      "#####",
      ".####",
      "...##",
      "...##",
      "....#",
    ],
    offsets: [
      [6, 0],
      [3, 3],
      [0, 6],
    ],
  },
};
