(function () {
  const content = `<h2>What this is</h2>
<p>DexLabs Note App is a fast, keyboard-and-touch-friendly text editor and file manager that runs entirely in your browser. There&#39;s no server backend beyond optional Google Drive sync &#8212; your notes live in this browser&#39;s local storage, organized into folders, and sync to your own Drive account if you sign in.</p>

<h2>Getting started</h2>
<p>From the homepage, tap <strong>Note App</strong> to open the file manager. If this is your first visit, tap the <strong>+</strong> button to create your first file or folder. Tapping a file opens it in the editor.</p>

<h2>The file manager</h2>
<p>The file manager (<code>/filemanager</code>) is the app&#39;s entry point &#8212; every note lives in a folder tree you can search, sort, and reorganize. Its left sidebar holds app-level tools: Settings, Debug, Sync to Cloud, and Asteroid Belt (a visual map of how your notes link to each other).</p>
<p>Tap <strong>Select</strong> to enter select mode: pick multiple files and Move, Copy, Download, Delete, or Batch apply a function to all of them at once &#8212; &quot;zap mode.&quot; Batch apply only ever lists functions that are safe to run across many files unattended; anything that needs per-file input (like a modal asking for a URL) is left out on purpose rather than crashing mid-run.</p>

<h2>Three modes, one note</h2>
<p>Every open note has a URL shape of <code>/note/:id/:mode</code>. The mode segment is real and bookmarkable:</p>
<ul>
<li><strong>Base</strong> &#8212; the plain text/code editor, with syntax highlighting based on the file&#39;s extension.</li>
<li><strong>Diffusion</strong> &#8212; a side-by-side Raw/Morph comparison and diff tool, useful for merging or reviewing two versions of similar text. Turn it on from Settings &#8594; Exclusive.</li>
<li><strong>Mermaid</strong> &#8212; a Mermaid.js diagram editor with a live preview, reachable the same way. Only one exclusive mode can be active per note at a time.</li>
</ul>

<h2>Selecting and editing text</h2>
<p>Long-press to select a word on any text surface &#8212; the base editor, a diff view, or the Mermaid code pane. Pause for a moment after selecting and a small menu appears near your selection with the actions that make sense for what you&#39;re looking at (Copy/Cut/Paste everywhere; Copy Raw/Copy Morph in Diffusion; Save selection/Swap line in a diff view). This is separate from the D-pad, which is its own floating cursor-and-menu tool for the base editor.</p>

<h2>Sidebar functions</h2>
<p>Open a note and tap the second sidebar icon for the full function catalog &#8212; formatting, find/replace, cleanup, ciphers, hashing, HTML tools, and more, organized by category with search. Frequently-used functions can be pinned to the top.</p>

<h2>Chains</h2>
<p>A &quot;chain&quot; is a saved sequence of find/replace steps (and certain functions) you can re-run on any note, or across many notes at once via batch apply. Build one from Operations &#8594; Chains.</p>

<h2>Asteroid Belt</h2>
<p>Link two notes by writing <code>{{note title}}</code> in either one&#39;s content. Open Asteroid Belt from the file manager sidebar to see every note as a point in a force-directed graph, connected by the links between them &#8212; tap any point to jump straight to that note.</p>

<h2>Settings</h2>
<p>Light/dark theme, editor syntax theme, line numbers, word wrap, and the two exclusive modes all live in Settings, reachable from the file manager sidebar or from inside any note.</p>

<h2>Staying in sync</h2>
<p>Sign in with Google from the homepage to back up notes to your Drive&#39;s app-data folder and pick up where you left off on another device. Everything still works fully offline without an account &#8212; sync is optional.</p>`;
  function injectDocs() {
    const body = document.querySelector('#docsOverlay .docs-body');
    if (body) body.innerHTML = content;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectDocs, { once: true });
  else injectDocs();
})();
