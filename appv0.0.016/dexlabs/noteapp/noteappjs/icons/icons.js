// DexIcons — a portable, runtime-configurable icon engine. Every icon
// site-wide (buttons, menus, sidebars, toolbars) is drawn in this one file:
// inline SVG, stroke/fill=currentColor by default, so a single CSS `color`
// paints it. No external icon fonts/libraries are ever loaded.
//
// Each icon has 5 selectable "variants" built from one shared, rounded-corner
// base geometry: og (plain), hud (scanner-bracket corners), orbit (satellite
// ring), circuit (corner nodes), plasma (radial glow, theme-reactive via
// --dex-plasma-center/--dex-plasma-edge CSS vars). Variants, and the
// Material-Symbols-style fill/wght/grad/opsz axes, are configurable at 3
// cascading levels — per icon, per variant, or globally — via
// `DexIcons.configure({...})`. See icon-config.js for this site's config.
//
// Usage (unchanged from before):
//   IC.folder                     -> raw <svg>...</svg> string, for building
//                                     HTML strings ('<div>' + IC.folder + '</div>')
//   window.dexIcon('folder')      -> same, wrapped in a sized <span class="ic-icon">
//   <i data-icon="folder"></i>    -> auto-painted on load and whenever added later
//   DexIcons.configure({ variant: 'plasma', icons: { tune: { variant: 'og' } } })
if (!window.IC) {
  var ICONS_RAW = {
    // ---- sidebar1 / filemanager set (the established "ic" standard) ----
    folder: '<svg fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>',
    file: '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
    plus: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>',
    select: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    trash: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
    x: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
    tick: '<svg fill="none" stroke="currentColor" stroke-width="2.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    enter: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12h13M13 6l6 6-6 6"/></svg>',
    up: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M5 12l7-7 7 7"/></svg>',
    move: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>',
    copy: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 8h10a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V10a2 2 0 012-2zM6 16H4a2 2 0 01-2-2V4a2 2 0 012-2h10a2 2 0 012 2v2"/></svg>',
    paste: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
    download: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>',
    chev: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>',
    sort: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h13M3 12h9M3 17h5M17 8V4m0 0l-3 3m3-3l3 3M17 16v4m0 0l-3-3m3 3l3-3"/></svg>',
    selectAll: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h10M4 12h10M4 18h7M15 16l2.5 2.5L22 14"/></svg>',
    edit: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
    bolt: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>',

    // ---- topbar / routing / app chrome ----
    undo: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/></svg>',
    redo: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3"/></svg>',
    home_app_logo: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 11.2c0-.9.4-1.7 1.1-2.3l5.4-4.6a1.6 1.6 0 012 0l5.4 4.6c.7.6 1.1 1.4 1.1 2.3V18a2 2 0 01-2 2H6.5a2 2 0 01-2-2v-6.8z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.5 20v-4.3a1 1 0 011-1h3a1 1 0 011 1V20"/></svg>',
    fullscreen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"/></svg>',
    import_contacts: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6c-1.5-1.3-3.6-2-6-2-1 0-2 .15-3 .4v14c1-.25 2-.4 3-.4 2.4 0 4.5.7 6 2m0-14c1.5-1.3 3.6-2 6-2 1 0 2 .15 3 .4v14c-1-.25-2-.4-3-.4-2.4 0-4.5.7-6 2m0-14v14"/></svg>',
    view_object_track: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M9 4v16"/></svg>',
    view_cozy: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    tune: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 7h6M14 7h6M4 12h10M18 12h2M4 17h4M12 17h8"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    bug_report: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="8" y="8" width="8" height="10" rx="4"/><path stroke-linecap="round" d="M9 8V6a3 3 0 016 0v2M6 11h12M6 15h12M4 9l3 2M20 9l-3 2M4 19l3-2M20 19l-3-2"/></svg>',
    cloud_upload: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 18a4 4 0 01-1-7.86A5.5 5.5 0 0117 9a4.5 4.5 0 011 8.9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 20v-7m0 0l-3 3m3-3l3 3"/></svg>',
    hub: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path stroke-linecap="round" d="M12 7v5m0 0l-5.5 5M12 12l5.5 5"/></svg>',
    logout: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 8l-4 4 4 4M6 12h12"/></svg>',
    settings: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.4 13a7.97 7.97 0 000-2l2.1-1.6-2-3.4-2.5 1a8 8 0 00-1.7-1L14.9 3h-4l-.4 2.6a8 8 0 00-1.7 1l-2.5-1-2 3.4L6 11a7.97 7.97 0 000 2l-2.1 1.6 2 3.4 2.5-1a8 8 0 001.7 1l.4 2.6h4l.4-2.6a8 8 0 001.7-1l2.5 1 2-3.4L19.4 13z"/></svg>',
    search: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/></svg>',
    star: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 16.9 6.4 20l1.4-6.2L3 9.5l6.4-.6L12 3z"/></svg>',
    arrow_forward: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12h15M13 5l7 7-7 7"/></svg>',
    arrow_back: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H5M11 18l-6-6 6-6"/></svg>',
    arrow_left: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    remove: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M5 12h14"/></svg>',
    code: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 6L2 12l6 6M16 6l6 6-6 6"/></svg>',

    // ---- document / file actions ----
    folder_open: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1H7l-2.5 7H3V7z"/><path stroke-linejoin="round" d="M6 17l2-6h13l-2.2 6a1.5 1.5 0 01-1.4 1H7a1 1 0 01-1-1z"/></svg>',
    backspace: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M8 5h11a2 2 0 012 2v10a2 2 0 01-2 2H8l-6-7 6-7z"/><path stroke-linecap="round" d="M12 10l4 4m0-4l-4 4"/></svg>',
    auto_awesome: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path stroke-linejoin="round" d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"/></svg>',
    note_add: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-6-5z"/><path stroke-linejoin="round" d="M13 3v5h5"/><path stroke-linecap="round" d="M12 12v6M9 15h6"/></svg>',
    upload_file: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-6-5z"/><path stroke-linejoin="round" d="M13 3v5h5"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-6m0 0l-2.5 2.5M12 12l2.5 2.5"/></svg>',
    edit_document: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M6 21h9a2 2 0 002-2V9l-6-6H6a2 2 0 00-2 2v14a2 2 0 002 2z"/><path stroke-linejoin="round" d="M13 3v5h5"/><path stroke-linejoin="round" d="M9.5 16.5l6-6 1.5 1.5-6 6H9.5v-1.5z"/></svg>',
    document_scanner: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M6 3h8l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path stroke-linecap="round" d="M4 9h16M4 15h16"/></svg>',
    description: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M6 3h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/><path stroke-linejoin="round" d="M13 3v5h5"/><path stroke-linecap="round" d="M8 12h8M8 16h8"/></svg>',
    table: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 16h18M9 4v16M15 4v16"/></svg>',
    image: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 17l-5.5-5.5L9 18"/></svg>',

    // ---- formatting / text tools ----
    format_color_fill: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M3 15l7-7 7 7a3 3 0 01-3 3H9a3 3 0 01-3-3z"/><path stroke-linecap="round" d="M10 5l3 3"/><path d="M19 15c0 1.5-1 3-1 3s-1-1.5-1-3a1 1 0 012 0z"/></svg>',
    text_fields: '<svg viewBox="0 0 24 24"><text x="2" y="17" font-size="15" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">Tt</text></svg>',
    uppercase: '<svg viewBox="0 0 24 24"><text x="1" y="16" font-size="11" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">AB</text></svg>',
    lowercase: '<svg viewBox="0 0 24 24"><text x="1" y="16" font-size="11" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">ab</text></svg>',
    match_case: '<svg viewBox="0 0 24 24"><text x="2" y="17" font-size="13" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">Aa</text></svg>',
    text_up: '<svg viewBox="0 0 24 24"><text x="1" y="16" font-size="11" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">Ab</text></svg>',
    fast_rewind: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M11 19V5l-9 7 9 7z"/><path d="M22 19V5l-9 7 9 7z"/></svg>',
    align_horizontal_left: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 3v18M9 7h11M9 12h7M9 17h11"/></svg>',
    format_align_left: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 6h16M4 12h10M4 18h16"/></svg>',
    format_align_center: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 6h16M7 12h10M4 18h16"/></svg>',
    format_align_right: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 6h16M10 12h10M4 18h16"/></svg>',
    format_indent_decrease: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M10 12h10M10 18h10M8 9l-3 3 3 3"/></svg>',
    format_indent_increase: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M10 12h10M10 18h10M5 9l3 3-3 3"/></svg>',
    alternate_email: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M16 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-3.5 7.1"/></svg>',
    format_bold: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z"/></svg>',
    format_italic: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M10 5h7M6 19h7M13 5L10 19"/></svg>',
    format_underlined: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 4v7a6 6 0 0012 0V4M4 20h16"/></svg>',
    format_list_bulleted: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none"/><path stroke-linecap="round" d="M9 6h11M9 12h11M9 18h11"/></svg>',
    format_list_numbered: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><text x="1" y="8" font-size="6" fill="currentColor" stroke="none">1</text><text x="1" y="14" font-size="6" fill="currentColor" stroke="none">2</text><text x="1" y="20" font-size="6" fill="currentColor" stroke="none">3</text><path stroke-linecap="round" d="M9 6h11M9 12h11M9 18h11"/></svg>',
    slab_serif: '<svg viewBox="0 0 24 24"><text x="4" y="18" font-size="16" font-family="Georgia,\'Times New Roman\',serif" fill="currentColor">A</text></svg>',
    switches: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="2" y="5" width="14" height="7" rx="3.5"/><circle cx="6" cy="8.5" r="2.1" fill="currentColor" stroke="none"/><rect x="8" y="13" width="14" height="7" rx="3.5"/><circle cx="18" cy="16.5" r="2.1" fill="currentColor" stroke="none"/></svg>',
    regular_expression: '<svg viewBox="0 0 24 24"><text x="2" y="17" font-size="13" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">.*</text></svg>',
    link: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M9 15l6-6"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 12L5.5 14.5a3 3 0 004.24 4.24L12 16.5M16 12l2.5-2.5a3 3 0 00-4.24-4.24L12 7.5"/></svg>',
    key: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path stroke-linecap="round" stroke-linejoin="round" d="M11 12L20 3M17 6l2 2M14 9l2 2"/></svg>',
    encrypted: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 118 0v3"/></svg>',
    html: '<svg viewBox="0 0 24 24"><text x="1" y="16" font-size="7.5" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">HTML</text></svg>',
    css: '<svg viewBox="0 0 24 24"><text x="3" y="16" font-size="9" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">CSS</text></svg>',
    javascript: '<svg viewBox="0 0 24 24"><text x="4" y="16" font-size="9" font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif" fill="currentColor">JS</text></svg>',
    data_object: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" d="M8 3a3 3 0 00-3 3v3a2 2 0 01-2 2 2 2 0 012 2v3a3 3 0 003 3M16 3a3 3 0 013 3v3a2 2 0 002 2 2 2 0 00-2 2v3a3 3 0 01-3 3"/></svg>',
    cleaning_services: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 4l6 6-8 8-3-3M9 15l-5 5M4 20l2-5 3 3-3 2z"/></svg>',
    swap_horiz: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8h13M13 4l4 4-4 4M20 16H7M11 20l-4-4 4-4"/></svg>',
    find_replace: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path stroke-linecap="round" d="M20 20l-4.35-4.35"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 10h6M13 10l-2-2m2 2l-2 2"/></svg>',
    discover_tune: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linejoin="round" d="M15 9l-2 6-6 2 2-6 6-2z"/></svg>',
    category: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M12 3l8 8-8 8-8-8V3h8z"/><circle cx="8" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>',

    // ---- d-pad / native menu / find-replace directionals ----
    expand_more: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>',
    expand_less: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg>',
    chevron_left: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6"/></svg>',
    chevron_right: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>',
    keyboard_double_arrow_up: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 16l6-6 6 6M6 10l6-6 6 6"/></svg>',
    keyboard_double_arrow_down: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 8l-6 6-6-6M18 14l-6 6-6-6"/></svg>',
    keyboard_double_arrow_left: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 6l-6 6 6 6M10 6l-6 6 6 6"/></svg>',
    keyboard_double_arrow_right: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 6l6 6-6 6M14 6l6 6-6 6"/></svg>',
    content_cut: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path stroke-linecap="round" d="M20 4L8.5 12M20 20L8.5 12"/></svg>',
    close_fullscreen: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 4v4a1 1 0 01-1 1H4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"/></svg>',
    drag_indicator: '<svg fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
    save: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path stroke-linejoin="round" d="M8 4v5h7V4M8 14h8v6H8z"/></svg>',
    bookmark: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M6 3h12v18l-6-4-6 4V3z"/></svg>',
    swapSaved: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8h11M11 4l4 4-4 4M20 16H9M13 12l-4 4 4 4"/><circle cx="20" cy="8" r="1.6" fill="currentColor" stroke="none"/><circle cx="4" cy="16" r="1.6" fill="currentColor" stroke="none"/></svg>',
    clear_all: '<svg fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M6 18L16 8a2 2 0 012.8 0l1.2 1.2a2 2 0 010 2.8L10 22H4v-4l2-2z"/><path stroke-linecap="round" d="M14 6l4 4"/></svg>',
    location_searching: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><path stroke-linecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    cached: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M20 12a8 8 0 10-2.34 5.66"/><path stroke-linecap="round" stroke-linejoin="round" d="M20 8v5h-5"/></svg>'
  };

  // Same concept, name reused from a different call site — always renders
  // whatever the target key currently resolves to (config included), so an
  // alias never goes stale the way a one-time `IC.close = IC.x` copy would.
  var ALIASES = {
    close: 'x', closeDpad: 'x', add: 'plus', select_all: 'selectAll', 'delete': 'trash',
    cut: 'content_cut', content_copy: 'copy', content_paste: 'paste', swap: 'swap_horiz'
  };

  // ---- geometry: parse an <svg>...</svg> string into attrs/inner/size ----
  function parseSvg(str) {
    var m = str.match(/^<svg([^>]*)>([\s\S]*)<\/svg>$/);
    if (!m) return null;
    var attrs = m[1];
    var vbm = attrs.match(/viewBox="([^"]+)"/);
    var vb = vbm ? vbm[1] : '0 0 24 24';
    var parts = vb.trim().split(/\s+/).map(Number);
    attrs = attrs.replace(/\s*viewBox="[^"]*"/, '').trim();
    return { attrs: attrs, inner: m[2], w: parts[2], h: parts[3] };
  }

  // Shared "rounded, minimal straight lines" base every variant builds on:
  // forces round line joins/caps (sharp corners render as soft arcs) and
  // grows rect corner radii, without touching path data.
  function roundify(p) {
    var attrs = p.attrs
      .replace(/\s*stroke-linecap="[^"]*"/g, '')
      .replace(/\s*stroke-linejoin="[^"]*"/g, '');
    attrs = (attrs + ' stroke-linecap="round" stroke-linejoin="round"').trim();
    var inner = p.inner.replace(/<rect\b[^>]*\/>/g, function (tag) {
      var wm = tag.match(/width="([\d.]+)"/), hm = tag.match(/height="([\d.]+)"/);
      var minWH = Math.min(wm ? +wm[1] : p.w, hm ? +hm[1] : p.h);
      var minRx = +(minWH * 0.3).toFixed(2);
      if (/rx="([\d.]+)"/.test(tag)) {
        return tag.replace(/rx="([\d.]+)"/, function (m2, val) { return 'rx="' + Math.max(+val, minRx) + '"'; });
      }
      return tag.replace(/\/>$/, ' rx="' + minRx + '"/>');
    });
    return { attrs: attrs, inner: inner, w: p.w, h: p.h };
  }

  // ---- fill/wght/grad/opsz axes -> a single stroke-width multiplier ----
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function axisMultiplier(cfg) {
    var wght = clamp(+cfg.wght || 400, 100, 700);
    var grad = clamp(+cfg.grad || 0, -25, 200);
    var fill = clamp(+cfg.fill || 0, 0, 1);
    var opsz = clamp(+cfg.opsz || 24, 16, 48);
    var m = (wght + grad) / 400;
    m += fill * 1.3; // FILL is approximated as extra weight (no dual artwork yet)
    m *= Math.pow(24 / opsz, 0.2); // small legibility compensation at small sizes
    return clamp(m, 0.35, 3.2);
  }

  function applyWeight(p, mult) {
    if (Math.abs(mult - 1) < 0.001) return p;
    function scale(str) {
      return str.replace(/stroke-width="([\d.]+)"/g, function (m, v) {
        return 'stroke-width="' + (+v * mult).toFixed(2) + '"';
      });
    }
    return { attrs: scale(p.attrs), inner: scale(p.inner), w: p.w, h: p.h };
  }

  // ---- the 5 variant renderers ----
  function styleOg(p) {
    return '<svg viewBox="0 0 ' + p.w + ' ' + p.h + '"><g ' + p.attrs + '>' + p.inner + '</g></svg>';
  }

  function styleHud(p) {
    var w = p.w, h = p.h;
    var m = +(w * 0.07).toFixed(2), len = +(w * 0.16).toFixed(2), r = +(w * 0.045).toFixed(2), sw = +(w * 0.045).toFixed(2);
    function corner(x, y, hDir, vDir) {
      var x1 = +(x + hDir * len).toFixed(2), y2 = +(y + vDir * len).toFixed(2);
      var rx = +(x + hDir * r).toFixed(2), ry = +(y + vDir * r).toFixed(2);
      return 'M' + x1 + ' ' + y + ' L' + rx + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + ry + ' L' + x + ' ' + y2;
    }
    var d = corner(m, m, 1, 1) + ' ' + corner(w - m, m, -1, 1) + ' ' + corner(w - m, h - m, -1, -1) + ' ' + corner(m, h - m, 1, -1);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '"><g ' + p.attrs + '>' + p.inner + '</g>' +
      '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/></svg>';
  }

  function styleOrbit(p) {
    var w = p.w, h = p.h, cx = w / 2, cy = h / 2;
    var rx = +(w * 0.49).toFixed(2), ry = +(h * 0.23).toFixed(2);
    var scale = 0.76, dx = +(w * (1 - scale) / 2).toFixed(2), dy = +(h * (1 - scale) / 2).toFixed(2);
    var ang = -20 * Math.PI / 180;
    var dotx = +(cx + rx * Math.cos(ang)).toFixed(2), doty = +(cy + ry * Math.sin(ang)).toFixed(2);
    var r = +(w * 0.045).toFixed(2), sw = +(w * 0.026).toFixed(2);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '"><ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="currentColor" stroke-width="' + sw + '" opacity="0.4" transform="rotate(-18 ' + cx + ' ' + cy + ')"/>' +
      '<g transform="translate(' + dx + ' ' + dy + ') scale(' + scale + ')" ' + p.attrs + '>' + p.inner + '</g>' +
      '<circle cx="' + dotx + '" cy="' + doty + '" r="' + r + '" fill="currentColor"/></svg>';
  }

  function styleCircuit(p) {
    var w = p.w, h = p.h;
    var m = +(w * 0.1).toFixed(2), r = +(w * 0.05).toFixed(2);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '"><g ' + p.attrs + '>' + p.inner + '</g>' +
      '<g fill="currentColor" opacity="0.55"><circle cx="' + m + '" cy="' + m + '" r="' + r + '"/><circle cx="' + (w - m) + '" cy="' + (h - m) + '" r="' + r + '"/></g></svg>';
  }

  // Default colors are CSS custom properties (see icons.css), not baked hex,
  // so already-rendered Plasma icons repaint live when the page's data-theme
  // attribute flips — no JS re-render required. `colors` (from config) is an
  // explicit override that skips the CSS vars entirely.
  function stylePlasma(p, ctx) {
    var w = p.w, h = p.h, gid = 'p' + ctx.uid, colors = ctx.plasmaColors;
    var stops;
    if (colors && colors.length) {
      stops = colors.map(function (c, i) {
        var off = colors.length === 1 ? 0 : i / (colors.length - 1);
        return '<stop offset="' + off.toFixed(2) + '" stop-color="' + c + '"/>';
      }).join('');
    } else {
      stops = '<stop offset="0" stop-color="var(--dex-plasma-center,#ffffff)"/>' +
        '<stop offset="1" stop-color="var(--dex-plasma-edge,#ffffff)"/>';
    }
    var grad = '<radialGradient id="' + gid + '" cx="50%" cy="50%" r="50%">' + stops + '</radialGradient>';
    var gAttrs = p.attrs.replace(/currentColor/g, 'url(#' + gid + ')');
    var sx = +(w * 0.8).toFixed(2), sy = +(h * 0.2).toFixed(2), r = +(w * 0.05).toFixed(2);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '"><defs>' + grad + '</defs><g ' + gAttrs + '>' + p.inner + '</g>' +
      '<circle cx="' + sx + '" cy="' + sy + '" r="' + (r * 2.4).toFixed(2) + '" fill="url(#' + gid + ')" opacity="0.22"/>' +
      '<circle cx="' + sx + '" cy="' + sy + '" r="' + r + '" fill="url(#' + gid + ')"/></svg>';
  }

  var FAMILIES = { og: styleOg, hud: styleHud, orbit: styleOrbit, circuit: styleCircuit, plasma: stylePlasma };

  // ---- 3-tier config: icon override -> variant override -> global default ----
  var CONFIG_KEYS = ['fill', 'wght', 'grad', 'opsz', 'color', 'background', 'plasmaColors'];
  var CONFIG = {
    global: { variant: 'og', fill: 0, wght: 400, grad: 0, opsz: 24, color: 'currentColor', background: null, plasmaColors: null },
    variants: {},
    icons: {}
  };

  function resolveConfig(name) {
    var ic = CONFIG.icons[name] || {};
    var variant = ic.variant || CONFIG.global.variant || 'og';
    var vc = CONFIG.variants[variant] || {};
    var out = { variant: FAMILIES[variant] ? variant : 'og' };
    CONFIG_KEYS.forEach(function (k) {
      if (ic[k] !== undefined) out[k] = ic[k];
      else if (vc[k] !== undefined) out[k] = vc[k];
      else out[k] = CONFIG.global[k];
    });
    return out;
  }

  function renderIcon(name) {
    var raw = ICONS_RAW[name];
    if (!raw) return '';
    var parsed = parseSvg(raw);
    if (!parsed) return raw;
    var cfg = resolveConfig(name);
    var base = roundify(parsed);
    var weighted = applyWeight(base, axisMultiplier(cfg));
    var svg = (FAMILIES[cfg.variant] || styleOg)(weighted, { uid: name, plasmaColors: cfg.plasmaColors });
    if (cfg.color && cfg.color !== 'currentColor') {
      svg = svg.replace('<svg ', '<svg style="color:' + String(cfg.color).replace(/"/g, '') + '" ');
    }
    return svg;
  }

  function repaintAll() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-icon-painted]').forEach(function (el) { el.removeAttribute('data-icon-painted'); });
    hydrate(document);
  }

  window.DexIcons = {
    configure: function (cfg) {
      cfg = cfg || {};
      ['variant'].concat(CONFIG_KEYS).forEach(function (k) { if (cfg[k] !== undefined) CONFIG.global[k] = cfg[k]; });
      if (cfg.variants) {
        Object.keys(cfg.variants).forEach(function (v) {
          CONFIG.variants[v] = Object.assign({}, CONFIG.variants[v], cfg.variants[v]);
        });
      }
      if (cfg.icons) {
        Object.keys(cfg.icons).forEach(function (name) {
          CONFIG.icons[name] = Object.assign({}, CONFIG.icons[name], cfg.icons[name]);
        });
      }
      repaintAll();
    },
    reset: function () {
      CONFIG = { global: { variant: 'og', fill: 0, wght: 400, grad: 0, opsz: 24, color: 'currentColor', background: null, plasmaColors: null }, variants: {}, icons: {} };
      repaintAll();
    },
    resolve: resolveConfig,
    getConfig: function () { return JSON.parse(JSON.stringify(CONFIG)); },
    variantNames: Object.keys(FAMILIES),
    iconNames: Object.keys(ICONS_RAW).concat(Object.keys(ALIASES))
  };

  var IC = new Proxy({}, {
    get: function (target, prop) {
      if (typeof prop !== 'string') return undefined;
      var key = ALIASES[prop] || prop;
      if (!ICONS_RAW.hasOwnProperty(key)) return undefined;
      return renderIcon(key);
    },
    has: function (target, prop) { return ICONS_RAW.hasOwnProperty(prop) || ALIASES.hasOwnProperty(prop); },
    ownKeys: function () { return window.DexIcons.iconNames; },
    getOwnPropertyDescriptor: function () { return { enumerable: true, configurable: true }; }
  });
  window.IC = IC;

  window.dexIcon = function (name, extraClass) {
    var body = IC[name] || '';
    return '<span class="ic-icon' + (extraClass ? ' ' + extraClass : '') + '" data-icon="' + name + '">' + body + '</span>';
  };

  function paintOne(el) {
    var name = el.getAttribute('data-icon');
    if (!name) return;
    if (el.getAttribute('data-icon-painted') === name) return;
    var svg = IC[name];
    if (!svg) return;
    el.innerHTML = svg;
    el.classList.add('ic-icon');
    el.setAttribute('data-icon-painted', name);
  }

  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(paintOne);
  }
  window.dexHydrateIcons = hydrate;

  function boot() {
    hydrate(document);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.hasAttribute && node.hasAttribute('data-icon')) paintOne(node);
          if (node.querySelectorAll) hydrate(node);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
}
