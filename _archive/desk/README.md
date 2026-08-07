# The Desk - parked 7 Aug 2026

Moved here intact so an intern can pick it straight back up. Nothing was
rewritten; the only change is location.

## What is here

- `workspace.html` - the page itself, formerly `site/workspace.html`
- `assets-desk/` - the sprite set, formerly `site/assets/desk/`
  (includes `CREDIT.txt`, the asset attribution - keep it with the sprites)

## What was removed from the live site

Both entry points, and nothing else:

1. `index.html` - the "Your Desk" pill in the home-page pill row
2. `assets/shell.js` - the desk pill injected into the shell on every page

## Credits

The credit economy was removed at the same time, because it existed to be spent
here. Gone from the front end:

- `achievements.html` - the `CREDITS` table awarding 25/75/150/300 by badge rarity
- `assets/shell.js` - the credit-balance pill and the "+N" toast

**The backend still sends `credits_delta`** through `auth/auth.js`. That field is
now read and ignored rather than removed, so when the Desk ships the economy can
be switched back on without a server change. If it is never coming back, that is
a separate cleanup on the server side.

## Putting it back

Move the two paths back, restore the two links, and re-add the credit UI. The
commit that removed it is the one to diff against - it touched only
`index.html`, `assets/shell.js` and `achievements.html`.
