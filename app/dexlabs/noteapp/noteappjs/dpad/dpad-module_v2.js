/* ================================================================
   dpad-module.js
   -----------------------------------------------------------------
   Single-entry module that wires the D-Pad together by importing
   the four scripts in the correct load order:

     1. dpad-layout.js     — creates DOM, state, show/hide, dbl-tap
     2. menu-layout.js     — creates menu DOM, positioning, open/close
     3. dpad-functions.js  — direction buttons + joystick center drag
     4. menu-functions.js  — menu item handlers, cursor activity, init

   Load with:  <script type="module" src="dpad-module_v2.js"></script>
   The stylesheet (dpad.css) must be linked separately from index.html.
   ================================================================ */

import './dpad-layout_v2.js';
import './menu-layout_v2.js';
import './dpad-functions_v2.js';
import './menu-functions_v2.js';
