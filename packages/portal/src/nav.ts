// Shared chrome — a consistent nav strip so every server-rendered page
// links to every other surface. Footer pattern, one line of HTML.
export const navLinks = () =>
  `<nav class="sf-nav"><a href="/">home</a> · <a href="/possibilities">deck</a> · ` +
  `<a href="/rounds">rounds</a> · <a href="/outcomes">outcomes</a> · ` +
  `<a href="/coordination">coordination</a> · <a href="/portfolio">portfolio</a> · ` +
  `<a href="/governance">governance</a> · <a href="/datasets">datasets</a> · ` +
  `<a href="/streams">streams</a> · <a href="/docs">api</a></nav>`;

export const footer = () =>
  `<footer><small>Springforth — generated ${new Date().toISOString()}</small><br>${navLinks()}</footer>`;
