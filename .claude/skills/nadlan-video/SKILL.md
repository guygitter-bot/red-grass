---
name: nadlan-video
description: Turn a photo of a building and/or an architectural drawing (elevation, sketch, apartment floor plan) into a high-end real-estate promo film - photorealistic opening frames, slow cinematic camera moves, Hebrew titles, music. Use when the user attaches a building photo, render or floor plan and says /nadlan-video, "סרטון נדל"ן", "סרטון תדמית לפרויקט", "הדמיה של הבניין", "הדמיה של הדירה", "תהפוך את השרטוט לסרטון", "real estate video", "property promo", "architectural visualization video".
---

# סרטון תדמית לנדל"ן מצילום או משרטוט

The same craft as the app in `nadlan_video/` (https://nadlan-video.pages.dev), run from the chat. Talk to the user in
simple Hebrew. The prompts that carry the craft live in the app's server - read them, do not re-invent them:

- `nadlan_video/api/director.js` - `planSystem`: how the film is planned (4 shots, the arc, truthfulness rules).
- `nadlan_video/api/still.js` - `stillPrompt`: how a drawing or photo becomes a photorealistic opening frame.
- `nadlan_video/api/video.js` - `clipPrompt` and `NEGATIVE`: how a frame becomes a camera move.

## The one rule that makes it look expensive

Never animate a drawing, and never ask a video model to invent the building. Every shot is:
**source image -> photorealistic still (image model) -> user approves -> one slow camera move (video model)**.
Stills are cheap and fixable; video is expensive. Approve the frame first.

## Workflow

1. **Look at what was attached.** A PHOTO (photograph or existing render) and/or a PLAN (elevation, sketch, floor plan).
   Ask only what is missing: project name, format (16:9 for site / YouTube, 9:16 for Instagram / WhatsApp), light
   (golden hour / bright day / dusk), tagline and contact line for the closing card.
2. **Write the shot list** (4 shots x 8 seconds) with the arc from `planSystem`: establishing hero -> approach or scale
   reveal -> detail / lifestyle moment -> closing wide shot that can hold a logo. For an apartment floor plan each shot
   is one room that exists in the plan, seen at eye level from inside. Show the list to the user in Hebrew (title + one
   sentence per shot) and wait for approval.
3. **Truthfulness.** The film sells a real property: keep the number of floors, facade composition, window and balcony
   layout, room layout and proportions exactly as in the source. Dressing the scene (sky, landscaping, furniture, light)
   is allowed; changing the architecture is not. Remove cranes, wires, signs and people from photos.
4. **Stills.** With Creative Claw: `generate_image` (`image/nano-banana-2`), the source image in `image_urls`, the prompt
   built like `stillPrompt`. Show every still; regenerate until the user approves each one.
5. **Clips.** `generate_video` with the approved still as `image_url` (literal first frame). Model:
   `video/seedance-2.5` for the final (draft at 480p first, then finalize the same take at 1080p), or
   `video/seedance-2.0-mini` for cheap drafts. Call `get_model_params` before the first generation and
   `estimate_generation` before spending - tell the user the cost and wait for a yes. Prompt = one camera move in
   cinematography vocabulary (slow aerial drone push-in, gentle orbit, rising crane, slow dolly forward, lateral slider)
   + small living details + "architecture stays rigid, straight verticals, no morphing, no new objects" + ambience only,
   no music, no speech.
6. **Check every clip** (`extract_frames`): if walls bend, floors are added or objects appear, regenerate with a slower,
   simpler move rather than accepting it.
7. **Assemble.** `stitch_clips` / `assemble_film` in order, soft dips to black between shots. Music: one calm,
   cinematic instrumental bed (`generate_music`, exact length of the film), mixed under the ambience, fade out at the end.
8. **Hebrew titles.** Opening: project name + thin gold line + tagline over the first shot. Closing: darkened last shot
   with the name and contact line. Hebrew must be rendered with `/motion-graphics` or `text_png` / `pill_png` from
   `.claude/skills/video-tools/lib.py` - ffmpeg `drawtext` reverses Hebrew.
9. Optional finish: `/color-grade` (clean or warm look) so all shots match, `upscale_video` for 4K delivery.

## What to hand back

The final film, each shot as its own file, and one Hebrew line on what to check (is the building identical to the
source in every shot). If the user will make these often, point them to the app, where the same flow runs from the phone.
