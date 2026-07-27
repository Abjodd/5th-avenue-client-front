# Login collage images

Post images for the scrolling collage on the sign-in page.

Drop files here and point the `POSTS` array in `src/pages/Login.jsx` at them,
e.g. `image: "/login-posts/anjali-salad.jpg"`. Paths are absolute from the site
root — no import needed, and files here are copied to the build as-is.

- **Aspect ratio:** portrait 9:13. Other ratios are centre-cropped.
- **Size:** ~600×870 is plenty; these render at roughly 160px wide. Keep each
  file under ~150 KB so the sign-in page stays fast.
- **Format:** `.webp` preferred, `.jpg` fine.
- A missing or broken path is not fatal — that card falls back to a coloured
  gradient with its emoji.
