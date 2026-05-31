// Fallback pool of broadly popular, well-known track IDs.
// Used when the selected filters return zero tracks WITH a preview_url.
// We still re-fetch them live (so preview_url freshness is respected) and
// re-filter by preview_url before use.

// A spread of eras/genres of globally recognizable songs.
export const FALLBACK_TRACK_IDS: string[] = [
  "7qiZfU4dY1lWllzX7mPBI3", // Ed Sheeran - Shape of You
  "0VjIjW4GlUZAMYd2vXMi3b", // The Weeknd - Blinding Lights
  "3n3Ppam7vgaVa1iaRUc9Lp", // Mark Ronson - Uptown Funk
  "7ouMYWpwJ422jRcDASZB7P", // Daft Punk - Get Lucky (radio edit)
  "2takcwOaAZWiXQijPHIx7B", // Toto - Africa
  "1mea3bSkSGXuIRvnydlB5b", // Queen - Bohemian Rhapsody (remaster)
  "0pqnGHJpmpxLKifKRmU6WP", // Adele - Hello
  "3AJwUDP919kvQ9QcozQPxg", // Coldplay - Yellow
  "60nZcImufyMA1MKQY3dcCH", // Whitney Houston - I Wanna Dance With Somebody
  "1z6WtY7X4HQJvzxC4UgkSf", // Ed Sheeran - Galway Girl
  "4u7EnebtmKWzUH433cf5Qv", // Avicii - Wake Me Up
  "0DiWol3AO6WpXZgp0goxAV", // The Killers - Mr. Brightside (re-rec)
  "32OlwWuMpZ6b0aN2RZOeMS", // Pharrell - Happy
  "2tpWsVSb9UEmDRxAl1zhX1", // Coldplay - Something Just Like This
  "6habFhsOp2NvshLv26DqMb", // Despacito
  "0tgVpDi06FyKpA1z0VMD4v", // Ed Sheeran - Perfect
  "5ChkMS8OtdzJeqyybCc9R5", // Michael Jackson - Billie Jean
  "1jDJFeK9x3OZboIAHsY9k2", // Lady Gaga - Just Dance
  "3ZffCQKLFLUvYM59XKLbVm", // Wham! - Wake Me Up Before You Go-Go
  "0bYg9bo50gSsH3LtXe2SQn", // Mariah Carey - All I Want For Christmas
];
