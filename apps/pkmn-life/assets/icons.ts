// App icons: the capture ball from the library, in colour for the LEDs and in greys for the OLED.

import { BALL_RED, ballIcon } from "@vladzaharia/bar-pixel";

/** Front: 8×8 colour, shown in the Apps menu on the LEDs. */
export const frontIcon = () => ballIcon(8, BALL_RED);

/** Back: 11×11 greyscale for the OLED. */
export const backIcon = () => ballIcon(11);
