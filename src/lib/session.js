// src/lib/session.js — sessionStorage keys shared across auth + intro.
// Kept in its own module so lazy chunks (BrandIntro) aren't pulled into
// the main bundle just to read a key name.
export const INTRO_KEY = "5av_intro_seen";
export const USER_KEY = "5av_portal_user";
