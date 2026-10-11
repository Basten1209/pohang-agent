# Welcome character cutout

Created 2026-10-11 with the built-in image generation tool, using `public/images/brand/gull-poses.png` as the edit target. The source artwork was supplied by the project owner. Output: `public/images/brand/gull-wave-transparent.png` (1254 × 1254 PNG, alpha transparency).

The launch, race-ready and first two onboarding screens display this whole image with its intrinsic square ratio. The onboarding white card and the duplicate boxed app icon on the loading screen were removed. The map, think and cheer poses were subsequently separated into their own transparent assets; see [gull-pose-cutout-prompts.md](gull-pose-cutout-prompts.md). Installed app icons remain unchanged.

## Final prompt

Use case: background-extraction. Edit target: the supplied RUN2 seagull four-pose reference sheet. Extract ONLY the LEFTMOST waving seagull into a single clean transparent PNG asset for the app launch and onboarding. Preserve exactly its existing plush 3D character design, face, proportions, teal-and-white headband, white feathers, dark navy wing tips and running shoes, waving pose, and raised foot. Remove the other three seagulls and all white/off-white background. Actual transparent alpha, not a white background or checkerboard drawing. Keep the entire leftmost character visible from top feathers to both complete shoes and both wing tips. No cropping whatsoever. Center this one character on a near-square canvas, modest even transparent margin around all extremes (about 8 percent), no card, border, box, text or new objects. Preserve the soft fine feather edges cleanly; no white matte or background shadow. This is background removal, not a redesign.
