/* @ds-bundle: {"format":3,"namespace":"AmaliTechDesignSystem_019e21","components":[],"sourceHashes":{"theme-settings/App.jsx":"9a6ad5fae639","theme-settings/AppSidebar.jsx":"9ffbc09b6bbb","theme-settings/ThemeEditor.jsx":"4ecb2c282990","theme-settings/ThemePreview.jsx":"37c9fc1175b8","theme-settings/icons.jsx":"951b8d538232","theme-settings/utils.jsx":"6529203d4181","ui_kits/amaliblog/ArticleRow.jsx":"8313c317fd3a","ui_kits/amaliblog/BlogNav.jsx":"0196437eb72b","ui_kits/amaliblog/FeedTabs.jsx":"17ccd2323d17","ui_kits/amaliblog/Pagination.jsx":"51f7666ff3fe","ui_kits/amaliblog/RightRail.jsx":"ecd0f3f1ef03","ui_kits/arms_dashboard/AppsGrid.jsx":"7a6812558163","ui_kits/arms_dashboard/Celebrations.jsx":"9cc3df8fc0b2","ui_kits/arms_dashboard/PlansEmpty.jsx":"9f2ab12e65ea","ui_kits/arms_dashboard/RightRail.jsx":"63765f1ed846","ui_kits/arms_dashboard/Topbar.jsx":"60222b2e0101","ui_kits/arms_dashboard/WidgetCard.jsx":"6aa77abe26cd","ui_kits/leave_management/IncidentsTable.jsx":"aa3f60839ed4","ui_kits/leave_management/Sidebar.jsx":"55453357e405","ui_kits/leave_management/StatCard.jsx":"8c51be39a2cd","ui_kits/leave_management/ToolCarousel.jsx":"3e21a2956d89","ui_kits/leave_management/Topbar.jsx":"05a14ffca077"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AmaliTechDesignSystem_019e21 = window.AmaliTechDesignSystem_019e21 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// theme-settings/App.jsx
try { (() => {
// App — top-level page composition + theme state.
// Matches Dodokpo's actual interface chrome (white sidebar, top bar with
// page title / bell / workspace pill / avatar) and the Edit Profile card
// pattern (single centered card, icon-prefixed section headers, save/cancel
// at the bottom right).

// Theme has TWO sets of colours — one for visitors on light pages, one for
// visitors who prefer dark pages. Logos already mirror this pattern.
// Fonts and button shape stay shared (they should feel the same in both modes).
const DEFAULT_THEME = {
  orgName: "Training Center",
  orgInitials: "TC",
  logoLight: null,
  logoLightName: null,
  logoDark: null,
  logoDarkName: null,
  colors: {
    light: {
      primary: "#08283B",
      // matches Dodokpo's dark navy
      secondary: "#E7EEFA",
      accent: "#FF5A00",
      background: "#F7F8FA",
      surface: "#FFFFFF",
      text: "#0F1B2D"
    },
    dark: {
      primary: "#5BA8FF",
      // brighter, legible on dark backgrounds
      secondary: "#1B2A3D",
      accent: "#FF8A4D",
      background: "#0E1117",
      surface: "#171B23",
      text: "#ECEFF6"
    }
  },
  fonts: {
    heading: "Poppins",
    body: "Inter"
  },
  button: {
    radius: "rounded",
    // sharp | rounded | pill
    size: "md" // sm | md | lg
  }
};
window.DEFAULT_THEME = DEFAULT_THEME;

// Migrate any older saved theme that has a flat `colors` shape into the new
// light/dark structure. Old saves treated their single set as the light theme.
function migrateTheme(t) {
  if (!t || !t.colors) return DEFAULT_THEME;
  const hasSplit = t.colors.light && t.colors.dark;
  if (hasSplit) return {
    ...DEFAULT_THEME,
    ...t,
    colors: {
      light: {
        ...DEFAULT_THEME.colors.light,
        ...t.colors.light
      },
      dark: {
        ...DEFAULT_THEME.colors.dark,
        ...t.colors.dark
      }
    }
  };
  // Legacy flat shape → assume those were the light values.
  return {
    ...DEFAULT_THEME,
    ...t,
    colors: {
      light: {
        ...DEFAULT_THEME.colors.light,
        ...t.colors
      },
      dark: {
        ...DEFAULT_THEME.colors.dark
      }
    }
  };
}
window.migrateTheme = migrateTheme;

// Persistence key — scoped per organisation so themes never leak across tenants.
const ORG_ID = "training-center"; // would come from auth context in real app
const STORAGE_KEY = `dodokpo:theme:${ORG_ID}`; // published theme
const DRAFT_KEY = `dodokpo:theme-draft:${ORG_ID}`; // editable draft

// --- Persistence (theme survives logout / refresh / redeploy) -----------
function loadPublished() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    return migrateTheme(JSON.parse(raw));
  } catch (_) {
    return DEFAULT_THEME;
  }
}
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return migrateTheme(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}
const App = () => {
  const published = React.useMemo(loadPublished, []);
  const draft = React.useMemo(loadDraft, []);
  const [theme, setTheme] = React.useState(draft || published);
  const [publishedTheme, setPublishedTheme] = React.useState(published);
  const [previewTab, setPreviewTab] = React.useState("candidate");
  // Which mode is the admin currently editing — and which mode the preview reflects.
  const [editMode, setEditMode] = React.useState("light"); // 'light' | 'dark'
  const [dirty, setDirty] = React.useState(!!draft);
  const [confirm, setConfirm] = React.useState(null); // {kind, …}
  const [toast, setToast] = React.useState(null); // {tone, title, detail}

  const updateTheme = next => {
    setTheme(next);
    setDirty(true);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch (_) {}
  };

  // Warn the user before they navigate away with unsaved changes.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = e => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Dynamically load whatever Google Fonts the user picks.
  React.useEffect(() => {
    const id = "dk-dynamic-fonts";
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    const families = Array.from(new Set([theme.fonts.heading, theme.fonts.body]));
    const param = families.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&");
    link.href = `https://fonts.googleapis.com/css2?${param}&display=swap`;
  }, [theme.fonts.heading, theme.fonts.body]);
  const showToast = t => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  };

  // --- Actions -----------------------------------------------------------
  const askCancel = () => {
    if (!dirty) return;
    setConfirm({
      kind: "cancel",
      title: "Discard your unsaved changes?",
      detail: "Your live website won't change. The settings on this page will go back to the version you have published.",
      confirmLabel: "Yes, discard changes",
      confirmTone: "danger",
      onConfirm: () => {
        setTheme(publishedTheme);
        setDirty(false);
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch (_) {}
        setConfirm(null);
        showToast({
          tone: "info",
          title: "Changes discarded",
          detail: "You're back to your published theme."
        });
      }
    });
  };
  const askReset = () => {
    setConfirm({
      kind: "reset",
      title: "Reset everything to the Dodokpo default?",
      detail: "Your logos, colours, fonts and button styles will all go back to the original Dodokpo look. This affects what your visitors see, straight away.",
      confirmLabel: "Yes, reset to Dodokpo default",
      confirmTone: "danger",
      onConfirm: () => {
        setTheme(DEFAULT_THEME);
        setPublishedTheme(DEFAULT_THEME);
        setDirty(false);
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(DRAFT_KEY);
        } catch (_) {}
        setConfirm(null);
        showToast({
          tone: "info",
          title: "Reset to Dodokpo default",
          detail: "Everyone now sees the original Dodokpo look."
        });
      }
    });
  };
  const askPublish = () => {
    // Audit accessibility before publishing — block if any critical pair fails.
    const audit = auditAccessibility(theme);
    setConfirm({
      kind: "publish",
      title: "Publish these changes to everyone?",
      detail: "All admins, assessors and candidates will see this look from the next page load. You can change it again at any time.",
      confirmLabel: audit.blocked ? "Fix issues first" : "Yes, publish now",
      confirmTone: audit.blocked ? "disabled" : "primary",
      audit,
      onConfirm: () => {
        if (audit.blocked) return;
        // Apply any safe-fallback overrides (text colour swap) before saving.
        const final = applyAccessibilityFallbacks(theme, audit);
        setPublishedTheme(final);
        setTheme(final);
        setDirty(false);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
          localStorage.removeItem(DRAFT_KEY);
        } catch (_) {}
        setConfirm(null);
        if (audit.adjusted) {
          const fixedModes = [];
          if (audit.fallbacks.light && audit.fallbacks.light.text) fixedModes.push("light");
          if (audit.fallbacks.dark && audit.fallbacks.dark.text) fixedModes.push("dark");
          showToast({
            tone: "warn",
            title: "Published — with one small fix",
            detail: `We adjusted the text colour in ${fixedModes.join(" and ")} mode so paragraphs stay easy to read.`
          });
        } else {
          showToast({
            tone: "pass",
            title: "Theme published",
            detail: "Your visitors will see the new look from their next page load."
          });
        }
      }
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "dk-app",
    "data-screen-label": "Theme Settings"
  }, /*#__PURE__*/React.createElement(AppSidebar, null), /*#__PURE__*/React.createElement("main", {
    className: "dk-main"
  }, /*#__PURE__*/React.createElement("header", {
    className: "dk-topbar"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "dk-topbar__title"
  }, "Theme"), /*#__PURE__*/React.createElement("div", {
    className: "dk-topbar__right"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dk-topbar__icon-btn",
    "aria-label": "Notifications"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    className: "dk-topbar__dot"
  })), /*#__PURE__*/React.createElement("button", {
    className: "dk-topbar__org",
    "aria-label": "Switch workspace"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-topbar__org-name"
  }, "Training Center"), /*#__PURE__*/React.createElement(Icon, {
    name: "chev-down",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    className: "dk-topbar__avatar",
    "aria-label": "Account"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-topbar__avatar-initials"
  }, "EA")))), /*#__PURE__*/React.createElement("div", {
    className: "dk-page dk-page--split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-page__settings"
  }, /*#__PURE__*/React.createElement(ThemeEditor, {
    theme: theme,
    setTheme: updateTheme,
    editMode: editMode,
    setEditMode: setEditMode,
    dirty: dirty,
    onCancel: askCancel,
    onPublish: askPublish,
    onReset: askReset
  })), /*#__PURE__*/React.createElement("div", {
    className: "dk-page__preview"
  }, /*#__PURE__*/React.createElement(ThemePreview, {
    theme: theme,
    editMode: editMode,
    setEditMode: setEditMode,
    tab: previewTab,
    setTab: setPreviewTab,
    dirty: dirty
  })))), confirm && /*#__PURE__*/React.createElement(ConfirmModal, {
    data: confirm,
    onClose: () => setConfirm(null)
  }), toast && /*#__PURE__*/React.createElement(Toast, {
    data: toast,
    onClose: () => setToast(null)
  }));
};
ReactDOM.createRoot(document.getElementById("app")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "theme-settings/App.jsx", error: String((e && e.message) || e) }); }

// theme-settings/AppSidebar.jsx
try { (() => {
// Dodokpo main app sidebar — matches the real interface.
// White surface, dark text, dark-navy active state. New "Theme" item lives
// under "Configurations & Settings" and is what this whole page introduces.

const MAIN_MENU = [{
  id: "dashboard",
  label: "Dashboard",
  icon: "grid"
}, {
  id: "tests",
  label: "Test Management",
  icon: "clipboard-check"
}, {
  id: "reports",
  label: "Report Management",
  icon: "clipboard-list"
}, {
  id: "users",
  label: "User Management",
  icon: "users-cog"
}, {
  id: "flags",
  label: "Feature flags",
  icon: "toggle"
}];
const CONFIG_MENU = [{
  id: "theme",
  label: "Theme",
  icon: "palette",
  active: true,
  isNew: true
}, {
  id: "archives",
  label: "Archives",
  icon: "archive"
}, {
  id: "help",
  label: "Help & Support",
  icon: "info-circle"
}];
const NavItem = ({
  item
}) => /*#__PURE__*/React.createElement("button", {
  className: `dk-nav__item ${item.active ? 'is-active' : ''}`
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-nav__icon"
}, /*#__PURE__*/React.createElement(Icon, {
  name: item.icon,
  size: 18
})), /*#__PURE__*/React.createElement("span", {
  className: "dk-nav__label"
}, item.label), item.isNew && /*#__PURE__*/React.createElement("span", {
  className: "dk-nav__new"
}, "NEW"));
const AppSidebar = () => /*#__PURE__*/React.createElement("aside", {
  className: "dk-sidebar"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-sidebar__brand"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-sidebar__mark",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("svg", {
  width: "20",
  height: "20",
  viewBox: "0 0 24 24",
  fill: "none"
}, /*#__PURE__*/React.createElement("path", {
  d: "M8 4h10a2 2 0 0 1 2 2v3M16 20H6a2 2 0 0 1-2-2v-3M4 12h12a4 4 0 0 0 0-8M20 12H8a4 4 0 0 0 0 8",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}))), /*#__PURE__*/React.createElement("div", {
  className: "dk-sidebar__wordmark"
}, "DODOKPO"), /*#__PURE__*/React.createElement("button", {
  className: "dk-sidebar__collapse",
  "aria-label": "Collapse sidebar"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "sidebar",
  size: 16
}))), /*#__PURE__*/React.createElement("nav", {
  className: "dk-nav",
  "aria-label": "Primary"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-nav__group-label"
}, "Main Menu"), MAIN_MENU.map(item => /*#__PURE__*/React.createElement(NavItem, {
  key: item.id,
  item: item
})), /*#__PURE__*/React.createElement("div", {
  className: "dk-nav__group-label"
}, "Configurations & Settings"), CONFIG_MENU.map(item => /*#__PURE__*/React.createElement(NavItem, {
  key: item.id,
  item: item
}))));
window.AppSidebar = AppSidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "theme-settings/AppSidebar.jsx", error: String((e && e.message) || e) }); }

// theme-settings/ThemeEditor.jsx
try { (() => {
// Theme editor — settings panel (left column).
// Rewritten for elderly users with low technical knowledge:
//  · plain-language section titles + numbered steps
//  · larger text, larger swatches, larger touch targets
//  · friendly inline help + `?` tooltips on every technical term
//  · readability shown as "Easy to read / Hard to read" — not 4.52:1

const APPROVED_FONTS = [{
  id: "Poppins",
  label: "Poppins",
  stack: "'Poppins', Inter, system-ui, sans-serif"
}, {
  id: "Inter",
  label: "Inter",
  stack: "Inter, system-ui, sans-serif"
}, {
  id: "Source Sans 3",
  label: "Source Sans 3",
  stack: "'Source Sans 3', Inter, system-ui, sans-serif"
}, {
  id: "IBM Plex Sans",
  label: "IBM Plex Sans",
  stack: "'IBM Plex Sans', Inter, system-ui, sans-serif"
}, {
  id: "Manrope",
  label: "Manrope",
  stack: "Manrope, Inter, system-ui, sans-serif"
}, {
  id: "DM Sans",
  label: "DM Sans",
  stack: "'DM Sans', Inter, system-ui, sans-serif"
}, {
  id: "Work Sans",
  label: "Work Sans",
  stack: "'Work Sans', Inter, system-ui, sans-serif"
}, {
  id: "Nunito",
  label: "Nunito",
  stack: "Nunito, Inter, system-ui, sans-serif"
}];
window.APPROVED_FONTS = APPROVED_FONTS;
const fontStack = id => (APPROVED_FONTS.find(f => f.id === id) || APPROVED_FONTS[0]).stack;
window.fontStack = fontStack;
const RADII = [{
  id: "sharp",
  label: "Square",
  value: 2,
  sample: "Like a notecard"
}, {
  id: "rounded",
  label: "Rounded",
  value: 10,
  sample: "Like a soft rectangle"
}, {
  id: "pill",
  label: "Pill-shaped",
  value: 999,
  sample: "Like a tablet"
}];
window.RADII = RADII;
const SIZE_OPTIONS = [{
  id: "sm",
  label: "Small",
  blurb: "Compact — fits more on the screen."
}, {
  id: "md",
  label: "Medium",
  blurb: "Standard — recommended for most people."
}, {
  id: "lg",
  label: "Large",
  blurb: "Bigger — easier to tap and read."
}];
const COLOR_FIELDS = [{
  key: "primary",
  name: "Main brand colour",
  role: "Used for buttons, links and headers.",
  tip: "This is the colour people will see most. Pick something that matches your organisation's identity."
}, {
  key: "secondary",
  name: "Soft brand colour",
  role: "Used for gentle backgrounds behind your main colour.",
  tip: "Usually a much lighter version of your main brand colour."
}, {
  key: "accent",
  name: "Highlight colour",
  role: "Used to draw attention — alerts, new badges, important buttons.",
  tip: "Pick something bright that stands out. Used sparingly."
}, {
  key: "background",
  name: "Page background",
  role: "The colour behind everything on every page.",
  tip: "Usually a very light shade — almost white. Avoid bright colours here."
}, {
  key: "surface",
  name: "Card colour",
  role: "Used for cards, forms and pop-ups that sit on the page.",
  tip: "Usually pure white, even if your page background is slightly tinted."
}, {
  key: "text",
  name: "Text colour",
  role: "The colour of words and paragraphs.",
  tip: "Almost always near-black for easy reading. Avoid grey for body text."
}];

// ----------- Section header with optional step number -----------
const SectionHeader = ({
  icon,
  step,
  title,
  subtitle,
  tip
}) => /*#__PURE__*/React.createElement("div", {
  className: "dk-section__head"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-section__icon-wrap"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-section__icon"
}, /*#__PURE__*/React.createElement(Icon, {
  name: icon,
  size: 22
})), step != null && /*#__PURE__*/React.createElement("span", {
  className: "dk-section__step"
}, "Step ", step)), /*#__PURE__*/React.createElement("div", {
  className: "dk-section__heading"
}, /*#__PURE__*/React.createElement("h2", {
  className: "dk-section__title"
}, title, tip && /*#__PURE__*/React.createElement(Tooltip, {
  text: tip
})), /*#__PURE__*/React.createElement("p", {
  className: "dk-section__sub"
}, subtitle)));

// ----------- Mode switcher (Light / Dark) -----------
// Big segmented control. Tells the admin exactly what they're editing right now.
const ModeSwitcher = ({
  editMode,
  setEditMode,
  theme
}) => {
  const lightAudit = auditMode(theme.colors.light, "light");
  const darkAudit = auditMode(theme.colors.dark, "dark");
  const counts = {
    light: lightAudit.pairs.filter(p => p.grade !== "pass").length,
    dark: darkAudit.pairs.filter(p => p.grade !== "pass").length
  };
  const cards = [{
    id: "light",
    title: "Light mode",
    blurb: "What most visitors see by default — dark words on a light page.",
    preview: {
      bg: theme.colors.light.background,
      fg: theme.colors.light.text,
      accent: theme.colors.light.primary
    }
  }, {
    id: "dark",
    title: "Dark mode",
    blurb: "What visitors see when their device is set to a dark look — light words on a dark page.",
    preview: {
      bg: theme.colors.dark.background,
      fg: theme.colors.dark.text,
      accent: theme.colors.dark.primary
    }
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "dk-section dk-section--mode"
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    icon: "droplet",
    title: "Which version are you editing?",
    subtitle: "Your website has two looks \u2014 a light one and a dark one. Pick which one you want to change. You can switch between them at any time \u2014 nothing you've changed gets lost.",
    tip: "Most websites these days offer both a light look and a dark look. Visitors' phones and laptops pick the one that matches their setting. You can make sure your branding looks right in both."
  }), /*#__PURE__*/React.createElement("div", {
    className: "dk-mode-switch",
    role: "radiogroup",
    "aria-label": "Which version to edit"
  }, cards.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    role: "radio",
    "aria-checked": editMode === c.id,
    className: `dk-mode-card ${editMode === c.id ? "is-active" : ""}`,
    onClick: () => setEditMode(c.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__demo",
    style: {
      background: c.preview.bg,
      color: c.preview.fg,
      borderColor: c.preview.fg + "22"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__demo-aa"
  }, "Aa"), /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__demo-dot",
    style: {
      background: c.preview.accent
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__title"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__radio",
    "aria-hidden": "true"
  }, editMode === c.id && /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__radio-dot"
  })), c.title), /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__blurb"
  }, c.blurb), counts[c.id] > 0 && /*#__PURE__*/React.createElement("span", {
    className: "dk-mode-card__warn"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert",
    size: 12
  }), " ", counts[c.id], " colour", counts[c.id] === 1 ? "" : "s", " could be easier to read"))))), /*#__PURE__*/React.createElement("div", {
    className: "dk-helper dk-helper--callout"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 18
  }), /*#__PURE__*/React.createElement("div", null, "You're now editing the ", /*#__PURE__*/React.createElement("strong", null, editMode === "light" ? "light" : "dark", " version"), ". The preview on the right shows this same version so you can see the changes as they happen. Click the other tab any time to edit the other version.")));
};
window.ModeSwitcher = ModeSwitcher;

// ----------- Logos -----------
const LogoSlot = ({
  label,
  sublabel,
  filename,
  src,
  onPick,
  onClear,
  dark
}) => {
  const fileRef = React.useRef(null);
  const [err, setErr] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const handleFile = async file => {
    setErr(null);
    if (!file) return;
    const result = await validateLogoFile(file);
    if (!result.ok) {
      setErr(result.message);
      return;
    }
    onPick(result);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `dk-logo-slot ${dark ? 'dk-logo-slot--dark' : ''} ${err ? 'dk-logo-slot--error' : ''} ${dragOver ? 'is-dragover' : ''}`,
    onClick: () => fileRef.current && fileRef.current.click(),
    onDragOver: e => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: e => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    role: "button",
    tabIndex: 0,
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileRef.current && fileRef.current.click();
      }
    },
    "aria-label": `Choose ${label}`
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: LOGO_LIMITS.acceptedTypes.join(","),
    onChange: e => handleFile(e.target.files[0]),
    style: {
      display: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "dk-logo-slot__label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "dk-logo-slot__sublabel"
  }, sublabel), /*#__PURE__*/React.createElement("div", {
    className: "dk-logo-slot__preview"
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: label,
    style: {
      maxHeight: 56,
      maxWidth: "100%"
    }
  }) : /*#__PURE__*/React.createElement("div", {
    className: "dk-logo-slot__empty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 22
  }), /*#__PURE__*/React.createElement("span", {
    className: "dk-logo-slot__empty-main"
  }, "Click here to choose a logo"), /*#__PURE__*/React.createElement("span", {
    className: "dk-logo-slot__empty-sub"
  }, "or drag a picture file onto this box"))), /*#__PURE__*/React.createElement("div", {
    className: "dk-logo-slot__filename"
  }, filename || "No picture chosen yet"), err && /*#__PURE__*/React.createElement("div", {
    className: "dk-logo-slot__error",
    role: "alert"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert",
    size: 14
  }), /*#__PURE__*/React.createElement("span", null, err)), src && /*#__PURE__*/React.createElement("button", {
    className: "dk-logo-slot__remove",
    "aria-label": `Remove ${label} logo`,
    onClick: e => {
      e.stopPropagation();
      onClear();
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 14
  }), /*#__PURE__*/React.createElement("span", null, "Remove")));
};
const LogoSection = ({
  theme,
  setTheme
}) => /*#__PURE__*/React.createElement("section", {
  className: "dk-section"
}, /*#__PURE__*/React.createElement(SectionHeader, {
  step: 1,
  icon: "image",
  title: "Your organisation's logo",
  subtitle: "Upload a picture of your logo. We use one version on light pages and another on dark pages so it always shows up clearly.",
  tip: "A logo is the small picture or symbol that represents your organisation \u2014 like the one on your business cards or letterhead."
}), /*#__PURE__*/React.createElement("div", {
  className: "dk-logo-grid"
}, /*#__PURE__*/React.createElement(LogoSlot, {
  label: "Logo for light pages",
  sublabel: "Shown on white backgrounds \u2014 use your normal coloured logo here.",
  src: theme.logoLight,
  filename: theme.logoLightName,
  onPick: r => setTheme({
    ...theme,
    logoLight: r.dataUrl,
    logoLightName: r.name
  }),
  onClear: () => setTheme({
    ...theme,
    logoLight: null,
    logoLightName: null
  })
}), /*#__PURE__*/React.createElement(LogoSlot, {
  dark: true,
  label: "Logo for dark pages (optional)",
  sublabel: "Shown on dark backgrounds \u2014 use a white or light version. If empty, we'll use the light-page logo here too.",
  src: theme.logoDark,
  filename: theme.logoDarkName,
  onPick: r => setTheme({
    ...theme,
    logoDark: r.dataUrl,
    logoDarkName: r.name
  }),
  onClear: () => setTheme({
    ...theme,
    logoDark: null,
    logoDarkName: null
  })
})), /*#__PURE__*/React.createElement("div", {
  className: "dk-helper dk-helper--callout"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "info",
  size: 18
}), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "What's allowed:"), " PNG, SVG, JPEG or WebP, under 2 MB, no larger than 2048\xD72048 pixels. We'll tell you if your file doesn't fit \u2014 nothing breaks.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("strong", null, "No second logo?"), " Skip the dark version \u2014 we'll use your normal logo on dark pages too.")));

// ----------- Colours -----------
const ColorRow = ({
  field,
  theme,
  setTheme,
  editMode
}) => {
  const colors = theme.colors[editMode];
  const val = colors[field.key];
  const cmp = field.key === "background" || field.key === "surface" ? colors.text : colors.background;
  const ratio = contrastRatio(val, cmp);
  const verdict = readabilityLabel(ratio);
  const writeColor = next => setTheme({
    ...theme,
    colors: {
      ...theme.colors,
      [editMode]: {
        ...colors,
        [field.key]: next
      }
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "dk-color-row"
  }, /*#__PURE__*/React.createElement("label", {
    className: "dk-color-row__swatch",
    style: {
      background: val
    },
    title: `Click to choose a different colour for "${field.name}"`
  }, /*#__PURE__*/React.createElement("input", {
    type: "color",
    value: val,
    onChange: e => writeColor(e.target.value.toUpperCase()),
    "aria-label": `Choose ${field.name}`
  }), /*#__PURE__*/React.createElement("span", {
    className: "dk-color-row__swatch-pencil",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "palette",
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dk-color-row__meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-color-row__name-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-color-row__name"
  }, field.name), /*#__PURE__*/React.createElement(Tooltip, {
    text: field.tip
  })), /*#__PURE__*/React.createElement("span", {
    className: "dk-color-row__role"
  }, field.role), /*#__PURE__*/React.createElement("div", {
    className: "dk-color-row__hex-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-color-row__hex-label"
  }, "Colour code:"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: "dk-color-row__hex",
    value: val,
    onChange: e => {
      let v = e.target.value.trim();
      if (!v.startsWith("#")) v = "#" + v;
      if (/^#[0-9a-f]{0,6}$/i.test(v)) writeColor(v.toUpperCase());
    },
    "aria-label": `Colour code for ${field.name}`
  }), /*#__PURE__*/React.createElement(Tooltip, {
    text: "This is the technical code for the colour you picked. You don't need to type it \u2014 just click the colour square on the left instead. Useful if your designer gave you a specific code to use."
  }))), /*#__PURE__*/React.createElement("div", {
    className: `dk-color-row__verdict dk-color-row__verdict--${verdict.tone}`
  }, /*#__PURE__*/React.createElement(Icon, {
    name: verdict.tone === "pass" ? "check" : "alert",
    size: 16
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "dk-color-row__verdict-title"
  }, verdict.title), /*#__PURE__*/React.createElement("div", {
    className: "dk-color-row__verdict-detail"
  }, verdict.detail))));
};
const ColorSection = ({
  theme,
  setTheme,
  editMode
}) => /*#__PURE__*/React.createElement("section", {
  className: "dk-section"
}, /*#__PURE__*/React.createElement(SectionHeader, {
  step: 2,
  icon: "droplet",
  title: `Colours — ${editMode === "light" ? "light" : "dark"} version`,
  subtitle: `Choose the colours used across your website's ${editMode} look. Click any coloured square to pick a new shade. The preview on the right updates as you go.`
}), /*#__PURE__*/React.createElement("div", {
  className: "dk-color-grid"
}, COLOR_FIELDS.map(f => /*#__PURE__*/React.createElement(ColorRow, {
  key: f.key,
  field: f,
  theme: theme,
  setTheme: setTheme,
  editMode: editMode
}))), /*#__PURE__*/React.createElement("div", {
  className: "dk-helper dk-helper--callout"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "info",
  size: 18
}), /*#__PURE__*/React.createElement("div", null, "We automatically check whether your colours are easy to read. If something shows", /*#__PURE__*/React.createElement("span", {
  className: "dk-helper__chip dk-helper__chip--warn"
}, "A bit hard to read"), "or", /*#__PURE__*/React.createElement("span", {
  className: "dk-helper__chip dk-helper__chip--fail"
}, "Very hard to read"), ", try picking a darker or lighter shade \u2014 your visitors will thank you.")));

// ----------- Typography -----------
const TypographySection = ({
  theme,
  setTheme
}) => /*#__PURE__*/React.createElement("section", {
  className: "dk-section"
}, /*#__PURE__*/React.createElement(SectionHeader, {
  step: 3,
  icon: "type",
  title: "Fonts",
  subtitle: "Pick the style of letters used for big titles and for normal paragraphs. All these fonts are checked to be easy to read.",
  tip: "A 'font' is the style of letters \u2014 like neat handwriting versus typewriter letters. Different fonts give your website a different feeling: friendly, professional, modern, traditional."
}), /*#__PURE__*/React.createElement("div", {
  className: "dk-form-grid"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-field"
}, /*#__PURE__*/React.createElement("label", {
  className: "dk-field-label",
  htmlFor: "dk-heading-font"
}, "Big titles", /*#__PURE__*/React.createElement(Tooltip, {
  text: "Used for the largest words on the page \u2014 like page titles and section headings. People only read these for a second, so a bit of personality is fine."
})), /*#__PURE__*/React.createElement("select", {
  id: "dk-heading-font",
  className: "dk-select",
  value: theme.fonts.heading,
  onChange: e => setTheme({
    ...theme,
    fonts: {
      ...theme.fonts,
      heading: e.target.value
    }
  }),
  style: {
    fontFamily: fontStack(theme.fonts.heading)
  }
}, APPROVED_FONTS.map(f => /*#__PURE__*/React.createElement("option", {
  key: f.id,
  value: f.id,
  style: {
    fontFamily: f.stack
  }
}, f.label))), /*#__PURE__*/React.createElement("div", {
  className: "dk-field-hint"
}, "Currently: ", /*#__PURE__*/React.createElement("strong", null, theme.fonts.heading))), /*#__PURE__*/React.createElement("div", {
  className: "dk-field"
}, /*#__PURE__*/React.createElement("label", {
  className: "dk-field-label",
  htmlFor: "dk-body-font"
}, "Normal paragraphs", /*#__PURE__*/React.createElement(Tooltip, {
  text: "Used for ordinary sentences and labels. Choose something that's easy on the eye \u2014 visitors will be reading lots of these letters."
})), /*#__PURE__*/React.createElement("select", {
  id: "dk-body-font",
  className: "dk-select",
  value: theme.fonts.body,
  onChange: e => setTheme({
    ...theme,
    fonts: {
      ...theme.fonts,
      body: e.target.value
    }
  }),
  style: {
    fontFamily: fontStack(theme.fonts.body)
  }
}, APPROVED_FONTS.map(f => /*#__PURE__*/React.createElement("option", {
  key: f.id,
  value: f.id,
  style: {
    fontFamily: f.stack
  }
}, f.label))), /*#__PURE__*/React.createElement("div", {
  className: "dk-field-hint"
}, "Currently: ", /*#__PURE__*/React.createElement("strong", null, theme.fonts.body)))), /*#__PURE__*/React.createElement("div", {
  className: "dk-font-sample"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-font-sample__head"
}, "How big titles will look \u2014 ", theme.fonts.heading), /*#__PURE__*/React.createElement("h4", {
  className: "dk-font-sample__heading",
  style: {
    fontFamily: fontStack(theme.fonts.heading)
  }
}, "Welcome back, Ebenezer \u2014 your candidates are ready."), /*#__PURE__*/React.createElement("div", {
  className: "dk-font-sample__head",
  style: {
    marginTop: 18
  }
}, "How normal paragraphs will look \u2014 ", theme.fonts.body), /*#__PURE__*/React.createElement("p", {
  className: "dk-font-sample__body",
  style: {
    fontFamily: fontStack(theme.fonts.body)
  }
}, "These are the letters your visitors will see all the time. Read this sentence out loud \u2014 if it feels comfortable, you've picked a good font.")));

// ----------- Button style -----------
const ButtonSection = ({
  theme,
  setTheme,
  editMode
}) => {
  const colors = theme.colors[editMode];
  return /*#__PURE__*/React.createElement("section", {
    className: "dk-section"
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    step: 4,
    icon: "sliders",
    title: "Button shape and size",
    subtitle: "Decide how the buttons on your website should look \u2014 square corners or rounded, and how big they should be.",
    tip: "A 'button' is anything visitors click to do something \u2014 like 'Save' or 'Continue'. Bigger buttons are easier to tap, especially on phones."
  }), /*#__PURE__*/React.createElement("div", {
    className: "dk-form-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-field-label"
  }, "Corner shape", /*#__PURE__*/React.createElement(Tooltip, {
    text: "This changes whether the corners of buttons are sharp like a card, gently rounded, or fully rounded into a pill shape."
  })), /*#__PURE__*/React.createElement("div", {
    className: "dk-radio-grid"
  }, RADII.map(r => /*#__PURE__*/React.createElement("button", {
    key: r.id,
    className: `dk-radio-card ${theme.button.radius === r.id ? 'is-active' : ''}`,
    onClick: () => setTheme({
      ...theme,
      button: {
        ...theme.button,
        radius: r.id
      }
    }),
    "aria-pressed": theme.button.radius === r.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-radio-card__demo",
    style: {
      borderRadius: r.value,
      background: colors.primary,
      color: readableFg(colors.primary)
    }
  }, "Button"), /*#__PURE__*/React.createElement("span", {
    className: "dk-radio-card__label"
  }, r.label), /*#__PURE__*/React.createElement("span", {
    className: "dk-radio-card__blurb"
  }, r.sample))))), /*#__PURE__*/React.createElement("div", {
    className: "dk-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-field-label"
  }, "Button size", /*#__PURE__*/React.createElement(Tooltip, {
    text: "Bigger buttons are easier to see and tap \u2014 especially helpful for people on phones or with less steady hands. Medium suits most websites."
  })), /*#__PURE__*/React.createElement("div", {
    className: "dk-radio-grid"
  }, SIZE_OPTIONS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    className: `dk-radio-card ${theme.button.size === s.id ? 'is-active' : ''}`,
    onClick: () => setTheme({
      ...theme,
      button: {
        ...theme.button,
        size: s.id
      }
    }),
    "aria-pressed": theme.button.size === s.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-radio-card__demo",
    style: {
      background: colors.primary,
      color: readableFg(colors.primary),
      borderRadius: RADII.find(r => r.id === theme.button.radius).value,
      padding: s.id === "sm" ? "5px 10px" : s.id === "lg" ? "11px 22px" : "8px 16px",
      fontSize: s.id === "sm" ? 11 : s.id === "lg" ? 15 : 13
    }
  }, "Button"), /*#__PURE__*/React.createElement("span", {
    className: "dk-radio-card__label"
  }, s.label), /*#__PURE__*/React.createElement("span", {
    className: "dk-radio-card__blurb"
  }, s.blurb)))))));
};

// ----------- Readability check (was Accessibility) -----------
const A11ySection = ({
  theme,
  editMode
}) => {
  const c = theme.colors[editMode];
  const pairs = [{
    fg: c.text,
    bg: c.background,
    label: "Normal paragraphs",
    where: "Everywhere people read sentences."
  }, {
    fg: readableFg(c.primary),
    bg: c.primary,
    label: "Words on buttons",
    where: "Like the text on your 'Save' button."
  }, {
    fg: c.primary,
    bg: c.background,
    label: "Links on the page",
    where: "Clickable text that takes people somewhere."
  }, {
    fg: readableFg(c.accent),
    bg: c.accent,
    label: "Words on highlights",
    where: "Notification badges and important markers."
  }];
  return /*#__PURE__*/React.createElement("section", {
    className: "dk-section"
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    step: 5,
    icon: "shield",
    title: `Readability check — ${editMode === "light" ? "light" : "dark"} version`,
    subtitle: "We check that your colour choices are easy to read for everyone \u2014 including visitors with poor eyesight.",
    tip: "Some colour combinations look fine to most people but are very hard to read for someone with weaker vision or in bright sunlight. This check warns you before that happens."
  }), /*#__PURE__*/React.createElement("div", {
    className: "dk-a11y"
  }, pairs.map((p, i) => {
    const r = contrastRatio(p.fg, p.bg);
    const v = readabilityLabel(r);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: `dk-a11y__row dk-a11y__row--${v.tone}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "dk-a11y__sample",
      style: {
        background: p.bg,
        color: p.fg,
        fontFamily: fontStack(theme.fonts.body)
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600
      }
    }, "Aa"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 22,
        fontWeight: 700
      }
    }, "Aa")), /*#__PURE__*/React.createElement("div", {
      className: "dk-a11y__copy"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dk-a11y__label"
    }, p.label), /*#__PURE__*/React.createElement("div", {
      className: "dk-a11y__where"
    }, p.where)), /*#__PURE__*/React.createElement("div", {
      className: "dk-a11y__verdict"
    }, /*#__PURE__*/React.createElement("span", {
      className: `dk-a11y__badge dk-a11y__badge--${v.tone}`
    }, /*#__PURE__*/React.createElement(Icon, {
      name: v.tone === "pass" ? "check" : "alert",
      size: 14
    }), v.title), /*#__PURE__*/React.createElement("div", {
      className: "dk-a11y__detail"
    }, v.detail)));
  })));
};

// ----------- Card (settings panel) -----------
const ThemeEditor = ({
  theme,
  setTheme,
  editMode,
  setEditMode,
  dirty,
  onCancel,
  onPublish,
  onReset
}) => /*#__PURE__*/React.createElement("div", {
  className: "dk-card",
  "data-edit-mode": editMode
}, /*#__PURE__*/React.createElement("header", {
  className: "dk-card__head"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
  className: "dk-card__title"
}, "Make this website look like yours"), /*#__PURE__*/React.createElement("p", {
  className: "dk-card__sub"
}, "Work through the five steps below. You can change anything you like \u2014 nothing happens to your live website until you press the big blue ", /*#__PURE__*/React.createElement("strong", null, "Publish changes"), " button at the bottom."), /*#__PURE__*/React.createElement("div", {
  className: "dk-card__how"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "info-circle",
  size: 18
}), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "How this page works:"), " the settings are on this side. The ", /*#__PURE__*/React.createElement("strong", null, "preview on the right"), " shows what your visitors will see \u2014 it updates straight away as you change things, so you can try options without worry."))), dirty && /*#__PURE__*/React.createElement("span", {
  className: "dk-card__status",
  role: "status"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-card__status-dot"
}), "You have unsaved changes")), /*#__PURE__*/React.createElement(LogoSection, {
  theme: theme,
  setTheme: setTheme
}), /*#__PURE__*/React.createElement(ModeSwitcher, {
  theme: theme,
  editMode: editMode,
  setEditMode: setEditMode
}), /*#__PURE__*/React.createElement(ColorSection, {
  theme: theme,
  setTheme: setTheme,
  editMode: editMode
}), /*#__PURE__*/React.createElement(TypographySection, {
  theme: theme,
  setTheme: setTheme
}), /*#__PURE__*/React.createElement(ButtonSection, {
  theme: theme,
  setTheme: setTheme,
  editMode: editMode
}), /*#__PURE__*/React.createElement(A11ySection, {
  theme: theme,
  editMode: editMode
}), /*#__PURE__*/React.createElement("footer", {
  className: "dk-card__actions"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-card__actions-info"
}, /*#__PURE__*/React.createElement("p", {
  className: "dk-card__actions-help"
}, "When you're happy with the preview on the right, press ", /*#__PURE__*/React.createElement("strong", null, "Publish changes"), " \u2014 your visitors will see the new look on their next page load. ", /*#__PURE__*/React.createElement("strong", null, "Cancel"), " puts everything back to what's currently published."), /*#__PURE__*/React.createElement("button", {
  className: "dk-card__reset",
  onClick: onReset
}, /*#__PURE__*/React.createElement(Icon, {
  name: "undo",
  size: 14
}), "Reset everything to the Dodokpo default")), /*#__PURE__*/React.createElement("div", {
  className: "dk-card__actions-buttons"
}, /*#__PURE__*/React.createElement("button", {
  className: "dk-btn dk-btn--ghost",
  onClick: onCancel,
  disabled: !dirty
}, /*#__PURE__*/React.createElement(Icon, {
  name: "x",
  size: 16
}), "Cancel"), /*#__PURE__*/React.createElement("button", {
  className: "dk-btn dk-btn--primary",
  onClick: onPublish,
  disabled: !dirty
}, /*#__PURE__*/React.createElement(Icon, {
  name: "send",
  size: 16
}), "Publish changes"))));
window.ThemeEditor = ThemeEditor;
})(); } catch (e) { __ds_ns.__errors.push({ path: "theme-settings/ThemeEditor.jsx", error: String((e && e.message) || e) }); }

// theme-settings/ThemePreview.jsx
try { (() => {
// Theme preview — right column. Shows the live theme rendered as
// (a) candidate assessment, (b) admin dashboard, (c) shared components.

const PREVIEW_TABS = [{
  id: "candidate",
  label: "What a visitor sees",
  icon: "user"
}, {
  id: "admin",
  label: "What you see",
  icon: "chart"
}, {
  id: "components",
  label: "Buttons & form bits",
  icon: "square"
}];

// Wordmark used in the preview when the user hasn't uploaded a logo yet.
const PreviewWordmark = ({
  theme,
  colors,
  onDark
}) => {
  const c = colors || theme.colors.light;
  const txt = onDark ? "#FFFFFF" : c.primary;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: fontStack(theme.fonts.heading),
      fontWeight: 700,
      fontSize: 16,
      letterSpacing: "-0.01em",
      color: txt
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      background: c.accent,
      color: "#fff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 800
    }
  }, theme.orgInitials || "D"), theme.orgName || "Dodokpo");
};

// ----------- Candidate view -----------
const QUESTION_TYPES = [{
  id: "multiple-choice",
  label: "Multiple Choice",
  icon: "circle-dot",
  section: "Section 2 · Quantitative reasoning"
}, {
  id: "multi-select",
  label: "Multi Select",
  icon: "check-square",
  section: "Section 3 · Verbal reasoning"
}, {
  id: "true-false",
  label: "True or False",
  icon: "yes-no",
  section: "Section 4 · Logical reasoning"
}, {
  id: "fill-blanks",
  label: "Fill in the Blanks",
  icon: "text-cursor",
  section: "Section 5 · Comprehension"
}, {
  id: "matrix",
  label: "Matrix",
  icon: "matrix",
  section: "Section 6 · Self-assessment"
}, {
  id: "code",
  label: "Code",
  icon: "code",
  section: "Section 7 · Technical · Python"
}, {
  id: "ai-generate",
  label: "Generate with AI",
  icon: "sparkle",
  section: "Section 8 · Open-ended"
}];
const QUESTION_BY_TYPE = {
  "multiple-choice": {
    title: "A water tank fills at 12 L/min. How long to fill 540 L?",
    desc: "Choose the option that best matches your reasoning. You can revisit this question before submission."
  },
  "multi-select": {
    title: "Which of the following are renewable energy sources?",
    desc: "Select all that apply. Two or more answers may be correct."
  },
  "true-false": {
    title: "Africa's median age in 2024 was lower than 20 years.",
    desc: "Indicate whether the statement is true or false based on the data provided."
  },
  "fill-blanks": {
    title: "Complete the sentence with the most appropriate words.",
    desc: "Read the paragraph carefully. Each blank accepts a single word."
  },
  "matrix": {
    title: "Rate your confidence with each of the following skills.",
    desc: "Choose the option in each row that best reflects your current proficiency."
  },
  "code": {
    title: "Write a function that returns the n-th Fibonacci number.",
    desc: "Use Python 3. Your solution must run within 1.5 seconds for n ≤ 10⁶ and pass the hidden test cases."
  },
  "ai-generate": {
    title: "Draft a 2-sentence response to a frustrated customer.",
    desc: "The customer has waited 9 days for a refund. Use the AI assistant to draft, then edit before submitting."
  }
};

// Per-type body renderers
const QuestionMultipleChoice = () => /*#__PURE__*/React.createElement(React.Fragment, null, [{
  letter: "A",
  text: "38 minutes"
}, {
  letter: "B",
  text: "45 minutes",
  selected: true
}, {
  letter: "C",
  text: "52 minutes"
}, {
  letter: "D",
  text: "It cannot be determined from the information given."
}].map(o => /*#__PURE__*/React.createElement("div", {
  key: o.letter,
  className: `dk-cand__option ${o.selected ? 'is-selected' : ''}`
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__option-letter"
}, o.letter), /*#__PURE__*/React.createElement("span", null, o.text))));
const QuestionMultiSelect = () => /*#__PURE__*/React.createElement(React.Fragment, null, [{
  text: "Solar photovoltaic",
  checked: true
}, {
  text: "Natural gas turbines",
  checked: false
}, {
  text: "Onshore wind",
  checked: true
}, {
  text: "Coal-fired thermal",
  checked: false
}, {
  text: "Hydroelectric dams",
  checked: true
}].map((o, i) => /*#__PURE__*/React.createElement("div", {
  key: i,
  className: `dk-cand__option dk-cand__option--check ${o.checked ? 'is-selected' : ''}`
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__check"
}, o.checked && /*#__PURE__*/React.createElement(Icon, {
  name: "check",
  size: 12
})), /*#__PURE__*/React.createElement("span", null, o.text))), /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__hint"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "info",
  size: 13
}), " 3 selected \xB7 Multiple answers may be correct"));
const QuestionTrueFalse = () => /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__tf"
}, /*#__PURE__*/React.createElement("button", {
  className: "dk-cand__tf-card is-selected"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__tf-icon"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "check",
  size: 20
})), /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__tf-label"
}, "True")), /*#__PURE__*/React.createElement("button", {
  className: "dk-cand__tf-card"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__tf-icon"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "x",
  size: 20
})), /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__tf-label"
}, "False")));
const QuestionFillBlanks = () => /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__blanks"
}, /*#__PURE__*/React.createElement("p", {
  className: "dk-cand__blanks-para"
}, "The capital of Ghana is", " ", /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__blank dk-cand__blank--filled"
}, "Accra"), " ", "and the country gained independence in the year", " ", /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__blank dk-cand__blank--filled"
}, "1957"), ". Its currency is the Ghanaian", " ", /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__blank dk-cand__blank--active"
}, "cedi"), ", first introduced in", " ", /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__blank"
}, "_____"), "."), /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__hint"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "info",
  size: 13
}), " Press Tab to jump between blanks"));
const QuestionMatrix = () => {
  const cols = ["Novice", "Basic", "Confident", "Expert"];
  const rows = [{
    skill: "Python",
    answer: 2
  }, {
    skill: "SQL queries",
    answer: 3
  }, {
    skill: "Statistical models",
    answer: 1
  }, {
    skill: "Data visualisation",
    answer: 2
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__matrix"
  }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null), cols.map(c => /*#__PURE__*/React.createElement("th", {
    key: c
  }, c)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("th", {
    scope: "row"
  }, r.skill), cols.map((c, j) => /*#__PURE__*/React.createElement("td", {
    key: c
  }, /*#__PURE__*/React.createElement("span", {
    className: `dk-cand__matrix-dot ${r.answer === j ? 'is-active' : ''}`
  }, r.answer === j && /*#__PURE__*/React.createElement("span", {
    className: "dk-cand__matrix-dot-inner"
  })))))))));
};
const QuestionCode = () => /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__code"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__code-head"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__code-tab is-active"
}, "solution.py"), /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__code-tab"
}, "tests.py"), /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__code-lang"
}, "Python 3.11")), /*#__PURE__*/React.createElement("pre", {
  className: "dk-cand__code-body"
}, `1   def fib(n: int) -> int:
2       """Return the n-th Fibonacci number."""
3       if n < 2:
4           return n
5       a, b = 0, 1
6       for _ in range(n - 1):
7           a, b = b, a + b
8       return b
9   `), /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__code-foot"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__code-status"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__code-dot"
}), "4 / 8 tests passing"), /*#__PURE__*/React.createElement("button", {
  className: "dk-mini-btn dk-mini-btn--secondary",
  style: {
    padding: "5px 10px",
    fontSize: 11
  }
}, "Run tests")));
const QuestionAI = () => /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__ai"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__ai-context"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__ai-chip"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "info",
  size: 11
}), " Context"), "Order #A-7821 \xB7 refund of $46.20 \xB7 last contact 9 days ago \xB7 customer escalated twice."), /*#__PURE__*/React.createElement("textarea", {
  className: "dk-cand__ai-textarea",
  placeholder: "Draft your response here, or use the assistant to start...",
  defaultValue: "Hi Naa, thank you for staying patient with us \u2014 your refund of $46.20 has now been issued and should reach your account within 1\u20133 business days. I've added a note to your file so any future request is prioritised."
}), /*#__PURE__*/React.createElement("div", {
  className: "dk-cand__ai-actions"
}, /*#__PURE__*/React.createElement("button", {
  className: "dk-cand__ai-btn"
}, /*#__PURE__*/React.createElement(Icon, {
  name: "sparkle",
  size: 13
}), "Generate with AI"), /*#__PURE__*/React.createElement("span", {
  className: "dk-cand__ai-meta"
}, "2 sentences \xB7 47 words \xB7 tone: warm, professional")));
const QUESTION_BODY = {
  "multiple-choice": QuestionMultipleChoice,
  "multi-select": QuestionMultiSelect,
  "true-false": QuestionTrueFalse,
  "fill-blanks": QuestionFillBlanks,
  "matrix": QuestionMatrix,
  "code": QuestionCode,
  "ai-generate": QuestionAI
};
const CandidatePreview = ({
  theme,
  editMode
}) => {
  const colors = theme.colors[editMode];
  const isDark = editMode === "dark";
  const logoSrc = isDark ? theme.logoDark || theme.logoLight : theme.logoLight;
  const radiusPx = RADII.find(r => r.id === theme.button.radius).value;
  const [qType, setQType] = React.useState("multiple-choice");
  const q = QUESTION_BY_TYPE[qType];
  const Body = QUESTION_BODY[qType];
  return /*#__PURE__*/React.createElement("div", {
    className: `dk-mini ${isDark ? "dk-mini--dark" : ""}`,
    style: {
      "--mini-bg": colors.background,
      "--mini-surface": colors.surface,
      "--mini-text": colors.text,
      "--mini-text-muted": "color-mix(in oklab, " + colors.text + " 55%, " + colors.background + ")",
      "--mini-border": "color-mix(in oklab, " + colors.text + " 12%, " + colors.background + ")",
      "--mini-border-strong": "color-mix(in oklab, " + colors.text + " 20%, " + colors.background + ")",
      "--mini-primary": colors.primary,
      "--mini-primary-fg": readableFg(colors.primary),
      "--mini-secondary": colors.secondary,
      "--mini-accent": colors.accent,
      "--mini-radius": radiusPx + "px",
      "--mini-body-font": fontStack(theme.fonts.body),
      "--mini-heading-font": fontStack(theme.fonts.heading),
      background: colors.background
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-mini__chrome"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-mini__chrome-dots"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("span", {
    className: "dk-mini__url"
  }, "app.dodokpo.com/assess/aml-en-graduate-3")), /*#__PURE__*/React.createElement("div", {
    className: "dk-cand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__brand"
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    className: "dk-cand__logo",
    src: logoSrc,
    alt: "logo",
    style: {
      maxHeight: 22
    }
  }) : /*#__PURE__*/React.createElement(PreviewWordmark, {
    theme: theme,
    colors: colors
  })), /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__progress"
  }, /*#__PURE__*/React.createElement("span", null, "Question 4 of 12"), /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__progress-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__progress-fill"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__qtypes",
    role: "tablist",
    "aria-label": "Question type"
  }, QUESTION_TYPES.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    role: "tab",
    "aria-selected": qType === t.id,
    className: `dk-cand__qtype ${qType === t.id ? 'is-active' : ''}`,
    onClick: () => setQType(t.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t.icon,
    size: 13
  }), " ", t.label))), /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__body"
  }, /*#__PURE__*/React.createElement("p", {
    className: "dk-cand__q-num"
  }, QUESTION_TYPES.find(t => t.id === qType).section), /*#__PURE__*/React.createElement("h3", {
    className: "dk-cand__q-title"
  }, q.title), /*#__PURE__*/React.createElement("p", {
    className: "dk-cand__q-desc"
  }, q.desc), /*#__PURE__*/React.createElement(Body, null)), /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-cand__timer"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    className: "dk-cand__timer-value"
  }, "23:14"), /*#__PURE__*/React.createElement("span", null, "remaining")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--secondary"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chev-left",
    size: 12
  }), " Previous"), /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--primary"
  }, "Next question ", /*#__PURE__*/React.createElement(Icon, {
    name: "chev-right",
    size: 12
  }))))));
};

// ----------- Admin dashboard view -----------
const AdminPreview = ({
  theme,
  editMode
}) => {
  const colors = theme.colors[editMode];
  const isDark = editMode === "dark";
  const radiusPx = RADII.find(r => r.id === theme.button.radius).value;
  const sidebarFg = readableFg(colors.primary);
  return /*#__PURE__*/React.createElement("div", {
    className: `dk-mini ${isDark ? "dk-mini--dark" : ""}`,
    style: {
      "--mini-bg": colors.background,
      "--mini-surface": colors.surface,
      "--mini-text": colors.text,
      "--mini-text-muted": "color-mix(in oklab, " + colors.text + " 55%, " + colors.background + ")",
      "--mini-border": "color-mix(in oklab, " + colors.text + " 10%, " + colors.background + ")",
      "--mini-primary": colors.primary,
      "--mini-primary-fg": sidebarFg,
      "--mini-accent": colors.accent,
      "--mini-radius": radiusPx + "px",
      "--mini-body-font": fontStack(theme.fonts.body),
      "--mini-heading-font": fontStack(theme.fonts.heading),
      background: colors.background
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-mini__chrome"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-mini__chrome-dots"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("span", {
    className: "dk-mini__url"
  }, "app.dodokpo.com/admin/overview")), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__nav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__brand"
  }, theme.orgName || "Dodokpo"), /*#__PURE__*/React.createElement("button", {
    className: "dk-admin__nav-item is-active"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "home",
    size: 12
  }), " Overview"), /*#__PURE__*/React.createElement("button", {
    className: "dk-admin__nav-item"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clipboard",
    size: 12
  }), " Assessments"), /*#__PURE__*/React.createElement("button", {
    className: "dk-admin__nav-item"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 12
  }), " Candidates"), /*#__PURE__*/React.createElement("button", {
    className: "dk-admin__nav-item"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chart",
    size: 12
  }), " Reports")), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__body"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "dk-admin__title"
  }, "Assessment overview"), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__stat"
  }, /*#__PURE__*/React.createElement("p", {
    className: "dk-admin__stat-label"
  }, "Invited"), /*#__PURE__*/React.createElement("p", {
    className: "dk-admin__stat-value"
  }, "218"), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__stat-delta"
  }, "+18 this week")), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__stat"
  }, /*#__PURE__*/React.createElement("p", {
    className: "dk-admin__stat-label"
  }, "Completed"), /*#__PURE__*/React.createElement("p", {
    className: "dk-admin__stat-value"
  }, "164"), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__stat-delta"
  }, "75.2% rate")), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__stat"
  }, /*#__PURE__*/React.createElement("p", {
    className: "dk-admin__stat-label"
  }, "Avg. score"), /*#__PURE__*/React.createElement("p", {
    className: "dk-admin__stat-value"
  }, "72"), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__stat-delta",
    style: {
      color: "color-mix(in oklab, " + colors.accent + " 80%, black)"
    }
  }, "Above benchmark"))), /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__panel-head"
  }, /*#__PURE__*/React.createElement("h5", {
    className: "dk-admin__panel-title"
  }, "Recent submissions"), /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--primary",
    style: {
      padding: "5px 10px",
      fontSize: 11
    }
  }, "View all ", /*#__PURE__*/React.createElement(Icon, {
    name: "chev-right",
    size: 10
  }))), [{
    name: "Adwoa Boateng",
    id: "AML-EN-G3-014",
    score: "84",
    status: "pass"
  }, {
    name: "Kwame Mensah",
    id: "AML-EN-G3-013",
    score: "68",
    status: "pending"
  }, {
    name: "Esi Owusu",
    id: "AML-EN-G3-012",
    score: "91",
    status: "pass"
  }].map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    className: "dk-admin__row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-admin__row-avatar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-admin__row-dot"
  }, r.name.split(" ").map(n => n[0]).join("")), /*#__PURE__*/React.createElement("span", null, r.name)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      color: "var(--mini-text-muted)"
    }
  }, r.score, "/100"), /*#__PURE__*/React.createElement("span", {
    className: `dk-admin__mini-badge ${r.status === "pass" ? "dk-admin__mini-badge--pass" : "dk-admin__mini-badge--pending"}`
  }, r.status === "pass" ? "Passed" : "Review")))))));
};

// ----------- Components / button gallery -----------
const ComponentsPreview = ({
  theme,
  editMode
}) => {
  const colors = theme.colors[editMode];
  const isDark = editMode === "dark";
  const radiusPx = RADII.find(r => r.id === theme.button.radius).value;
  const sz = theme.button.size;
  const btnPad = sz === "sm" ? "6px 12px" : sz === "lg" ? "12px 22px" : "9px 18px";
  const btnFs = sz === "sm" ? 12 : sz === "lg" ? 15 : 13;
  return /*#__PURE__*/React.createElement("div", {
    className: `dk-mini ${isDark ? "dk-mini--dark" : ""}`,
    style: {
      "--mini-bg": colors.background,
      "--mini-surface": colors.surface,
      "--mini-text": colors.text,
      "--mini-text-muted": "color-mix(in oklab, " + colors.text + " 55%, " + colors.background + ")",
      "--mini-border": "color-mix(in oklab, " + colors.text + " 10%, " + colors.background + ")",
      "--mini-border-strong": "color-mix(in oklab, " + colors.text + " 20%, " + colors.background + ")",
      "--mini-primary": colors.primary,
      "--mini-primary-fg": readableFg(colors.primary),
      "--mini-secondary": colors.secondary,
      "--mini-accent": colors.accent,
      "--mini-radius": radiusPx + "px",
      "--mini-body-font": fontStack(theme.fonts.body),
      "--mini-heading-font": fontStack(theme.fonts.heading),
      background: colors.background,
      padding: 20,
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__label"
  }, "Primary buttons \xB7 ", RADII.find(r => r.id === theme.button.radius).label.toLowerCase(), " \xB7 ", sz), /*#__PURE__*/React.createElement("div", {
    className: "dk-flex"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--primary",
    style: {
      fontFamily: "var(--mini-body-font)",
      padding: btnPad,
      fontSize: btnFs
    }
  }, "Default"), /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--primary",
    style: {
      fontFamily: "var(--mini-body-font)",
      padding: btnPad,
      fontSize: btnFs,
      filter: "brightness(0.88)"
    }
  }, "Hover"), /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--primary",
    style: {
      fontFamily: "var(--mini-body-font)",
      padding: btnPad,
      fontSize: btnFs,
      opacity: 0.4
    },
    disabled: true
  }, "Disabled"), /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--primary",
    style: {
      fontFamily: "var(--mini-body-font)",
      padding: btnPad,
      fontSize: btnFs
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13
  }), " Confirm"))), /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__label"
  }, "Secondary & accent"), /*#__PURE__*/React.createElement("div", {
    className: "dk-flex"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--secondary",
    style: {
      fontFamily: "var(--mini-body-font)",
      padding: btnPad,
      fontSize: btnFs
    }
  }, "Save draft"), /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--accent",
    style: {
      fontFamily: "var(--mini-body-font)",
      padding: btnPad,
      fontSize: btnFs
    }
  }, "Highlight"), /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--ghost",
    style: {
      fontFamily: "var(--mini-body-font)",
      padding: btnPad,
      fontSize: btnFs
    }
  }, "Cancel"))), /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__label"
  }, "Form input \xB7 focus"), /*#__PURE__*/React.createElement("div", {
    className: "dk-flex",
    style: {
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "dk-mini-input",
    placeholder: "candidate@org.com",
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "dk-mini-btn dk-mini-btn--primary",
    style: {
      fontFamily: "var(--mini-body-font)",
      padding: btnPad,
      fontSize: btnFs
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "send",
    size: 13
  }), " Invite"))), /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__label"
  }, "Badges & chips"), /*#__PURE__*/React.createElement("div", {
    className: "dk-flex"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-mini-badge dk-mini-badge--primary"
  }, "In progress"), /*#__PURE__*/React.createElement("span", {
    className: "dk-mini-badge dk-mini-badge--accent"
  }, "New"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 10px",
      borderRadius: 9999,
      background: "color-mix(in oklab, " + colors.text + " 8%, " + colors.background + ")",
      color: "var(--mini-text-muted)",
      fontFamily: "var(--mini-body-font)",
      fontSize: 11,
      fontWeight: 600
    }
  }, "Draft"))), /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-comp-grid__label"
  }, "Typography sample"), /*#__PURE__*/React.createElement("h4", {
    style: {
      fontFamily: "var(--mini-heading-font)",
      fontWeight: 700,
      fontSize: 22,
      margin: "2px 0 6px",
      color: "var(--mini-text)",
      letterSpacing: "-0.01em"
    }
  }, "Aptitude assessment, Q3 2026"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--mini-body-font)",
      fontSize: 13,
      color: "var(--mini-text-muted)",
      margin: 0,
      lineHeight: 1.55
    }
  }, "Headings render in ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "var(--mini-text)"
    }
  }, theme.fonts.heading), ". Paragraph copy renders in ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "var(--mini-text)"
    }
  }, theme.fonts.body), ". Together they shape every screen across the platform."))));
};

// ----------- Panel shell -----------
const ThemePreview = ({
  theme,
  editMode,
  setEditMode,
  tab,
  setTab
}) => /*#__PURE__*/React.createElement("aside", {
  className: "dk-preview-panel",
  "aria-label": "Live preview of your changes",
  "data-edit-mode": editMode
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-preview-panel__head"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-preview-panel__heading"
}, /*#__PURE__*/React.createElement("h3", {
  className: "dk-preview-panel__title"
}, "Live preview \u2014 ", editMode === "light" ? "light" : "dark", " version"), /*#__PURE__*/React.createElement(Tooltip, {
  text: "This is a small working copy of your website. As you change colours, fonts and buttons on the left, you'll see them appear here straight away. Nothing here is shown to real visitors yet."
})), /*#__PURE__*/React.createElement("p", {
  className: "dk-preview-panel__sub"
}, "This is what your visitors will see in ", /*#__PURE__*/React.createElement("strong", null, editMode === "light" ? "light" : "dark", " mode"), ". It updates as you change things on the left."), /*#__PURE__*/React.createElement("div", {
  className: "dk-preview-panel__modes",
  role: "radiogroup",
  "aria-label": "Preview which version"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-preview-panel__tablabel"
}, "Showing version:"), /*#__PURE__*/React.createElement("div", {
  className: "dk-preview-modeswitch"
}, /*#__PURE__*/React.createElement("button", {
  role: "radio",
  "aria-checked": editMode === "light",
  className: `dk-preview-modeswitch__btn ${editMode === "light" ? "is-active" : ""}`,
  onClick: () => setEditMode("light")
}, /*#__PURE__*/React.createElement(Icon, {
  name: "sun",
  size: 14
}), " Light"), /*#__PURE__*/React.createElement("button", {
  role: "radio",
  "aria-checked": editMode === "dark",
  className: `dk-preview-modeswitch__btn ${editMode === "dark" ? "is-active" : ""}`,
  onClick: () => setEditMode("dark")
}, /*#__PURE__*/React.createElement(Icon, {
  name: "moon",
  size: 14
}), " Dark"))), /*#__PURE__*/React.createElement("div", {
  className: "dk-preview-panel__tabwrap"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-preview-panel__tablabel"
}, "Showing page:"), /*#__PURE__*/React.createElement("div", {
  className: "dk-preview-tabs",
  role: "tablist",
  "aria-label": "Which page to preview"
}, PREVIEW_TABS.map(t => /*#__PURE__*/React.createElement("button", {
  key: t.id,
  role: "tab",
  "aria-selected": tab === t.id,
  className: `dk-preview-tabs__btn ${tab === t.id ? 'is-active' : ''}`,
  onClick: () => setTab(t.id)
}, /*#__PURE__*/React.createElement(Icon, {
  name: t.icon,
  size: 14
}), " ", t.label))))), /*#__PURE__*/React.createElement("div", {
  className: "dk-preview-stage"
}, tab === "candidate" && /*#__PURE__*/React.createElement(CandidatePreview, {
  theme: theme,
  editMode: editMode
}), tab === "admin" && /*#__PURE__*/React.createElement(AdminPreview, {
  theme: theme,
  editMode: editMode
}), tab === "components" && /*#__PURE__*/React.createElement(ComponentsPreview, {
  theme: theme,
  editMode: editMode
})), /*#__PURE__*/React.createElement("div", {
  className: "dk-preview-caption"
}, /*#__PURE__*/React.createElement("span", {
  className: "dk-preview-caption__dot"
}), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, "You're the only one who sees this for now."), " Your real visitors won't see any changes until you press ", /*#__PURE__*/React.createElement("em", null, "Publish changes"), ".")));
Object.assign(window, {
  CandidatePreview,
  AdminPreview,
  ComponentsPreview,
  ThemePreview
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "theme-settings/ThemePreview.jsx", error: String((e && e.message) || e) }); }

// theme-settings/icons.jsx
try { (() => {
// Shared SVG icons (Lucide-style, currentColor, 1.75-2px stroke).
const Icon = ({
  name,
  size = 16,
  stroke = 2
}) => {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };
  switch (name) {
    case "home":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 22V12h6v10"
      }));
    case "clipboard":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "8",
        y: "2",
        width: "8",
        height: "4",
        rx: "1"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
      }));
    case "users":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "9",
        cy: "7",
        r: "4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M22 21v-2a4 4 0 0 0-3-3.87"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 3.13a4 4 0 0 1 0 7.75"
      }));
    case "chart":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M3 3v18h18"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m7 14 4-4 4 4 5-5"
      }));
    case "shield":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6Z"
      }));
    case "settings":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      }));
    case "help":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"
      }));
    case "chev-down":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "m6 9 6 6 6-6"
      }));
    case "chev-right":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "m9 18 6-6-6-6"
      }));
    case "chev-left":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "m15 18-6-6 6-6"
      }));
    case "building":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "4",
        y: "2",
        width: "16",
        height: "20",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M8 10h.01M8 14h.01M16 10h.01M16 14h.01"
      }));
    case "user":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "7",
        r: "4"
      }));
    case "key":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "8",
        cy: "15",
        r: "4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10.85 12.15 19 4M18 5l3 3M15 8l3 3"
      }));
    case "bell":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10.3 21a1.94 1.94 0 0 0 3.4 0"
      }));
    case "credit-card":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "5",
        width: "20",
        height: "14",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 10h20"
      }));
    case "plug":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M9 2v6M15 2v6M5 8h14v3a7 7 0 0 1-14 0Z"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12 18v4"
      }));
    case "palette":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M12 2a10 10 0 1 0 0 20c1.5 0 2-1 2-2v-2a2 2 0 0 1 2-2h3a3 3 0 0 0 3-3 10 10 0 0 0-10-11Z"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "7.5",
        cy: "10.5",
        r: "1"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "11",
        cy: "6.5",
        r: "1"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "16",
        cy: "7.5",
        r: "1"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "17.5",
        cy: "12",
        r: "1"
      }));
    case "globe":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z"
      }));
    case "upload":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M17 8l-5-5-5 5M12 3v12"
      }));
    case "image":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "9",
        cy: "9",
        r: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m21 15-5-5L5 21"
      }));
    case "x":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M18 6 6 18M6 6l12 12"
      }));
    case "check":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "m20 6-11 11-5-5"
      }));
    case "alert":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M12 9v4M12 17h.01"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
      }));
    case "eye":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      }));
    case "save":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M17 21v-8H7v8M7 3v5h8"
      }));
    case "undo":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M3 7v6h6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M21 17a9 9 0 0 0-15-6.7L3 13"
      }));
    case "send":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"
      }));
    case "type":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M4 7V4h16v3M9 20h6M12 4v16"
      }));
    case "square":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2"
      }));
    case "clock":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12 6v6l4 2"
      }));
    case "flag":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M4 22V4a2 2 0 0 1 2-2h11l-3 5 3 5H6"
      }));
    case "info":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12 16v-4M12 8h.01"
      }));
    case "search":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "11",
        cy: "11",
        r: "8"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m21 21-4.3-4.3"
      }));
    case "grid":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "3",
        width: "7",
        height: "7",
        rx: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "14",
        y: "3",
        width: "7",
        height: "7",
        rx: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "14",
        width: "7",
        height: "7",
        rx: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "14",
        y: "14",
        width: "7",
        height: "7",
        rx: "1"
      }));
    case "clipboard-check":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "8",
        y: "2",
        width: "8",
        height: "4",
        rx: "1"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m9 14 2 2 4-4"
      }));
    case "clipboard-list":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "8",
        y: "2",
        width: "8",
        height: "4",
        rx: "1"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 12h6M9 16h4"
      }));
    case "users-cog":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M14 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "7.5",
        cy: "7",
        r: "4"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "18",
        cy: "15",
        r: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M18 11v1M18 18v1M21.5 13l-.9.5M14.5 16.5l-.9.5M21.5 17l-.9-.5M14.5 13.5l-.9-.5"
      }));
    case "toggle":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "2",
        y: "7",
        width: "20",
        height: "10",
        rx: "5"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "16",
        cy: "12",
        r: "2.5",
        fill: "currentColor",
        stroke: "none"
      }));
    case "archive":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M21 8v13H3V8M1 3h22v5H1zM10 12h4"
      }));
    case "info-circle":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12 16v-4M12 8h.01"
      }));
    case "sidebar":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 3v18"
      }));
    case "moon":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
      }));
    case "sun":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      }));
    case "droplet":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
      }));
    case "sliders":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14h6M9 8h6M17 16h6"
      }));
    case "circle-dot":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3",
        fill: "currentColor",
        stroke: "none"
      }));
    case "check-square":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m8 12 3 3 5-6"
      }));
    case "yes-no":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "m4 12 3 3 5-6"
      }), /*#__PURE__*/React.createElement("path", {
        d: "m15 9 5 6M20 9l-5 6"
      }));
    case "text-cursor":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1M7 22h1a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4H7"
      }));
    case "matrix":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "3",
        width: "7",
        height: "7",
        rx: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "14",
        y: "3",
        width: "7",
        height: "7",
        rx: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "14",
        width: "7",
        height: "7",
        rx: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "14",
        y: "14",
        width: "7",
        height: "7",
        rx: "1"
      }));
    case "code":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "m16 18 6-6-6-6M8 6l-6 6 6 6"
      }));
    case "sparkle":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
      }));
    default:
      return null;
  }
};
window.Icon = Icon;
})(); } catch (e) { __ds_ns.__errors.push({ path: "theme-settings/icons.jsx", error: String((e && e.message) || e) }); }

// theme-settings/utils.jsx
try { (() => {
// WCAG contrast utilities + small helpers.

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  return {
    r: n >> 16 & 255,
    g: n >> 8 & 255,
    b: n & 255
  };
}
function relLum({
  r,
  g,
  b
}) {
  const c = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastRatio(hexA, hexB) {
  const l1 = relLum(hexToRgb(hexA));
  const l2 = relLum(hexToRgb(hexB));
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Returns 'pass' (AA normal), 'warn' (AA large only), 'fail'.
function contrastGrade(ratio) {
  if (ratio >= 4.5) return "pass";
  if (ratio >= 3) return "warn";
  return "fail";
}

// Pick black or white text on top of a given hex bg for best contrast.
function readableFg(bgHex) {
  return contrastRatio(bgHex, "#FFFFFF") >= contrastRatio(bgHex, "#000000") ? "#FFFFFF" : "#08283B";
}
window.contrastRatio = contrastRatio;
window.contrastGrade = contrastGrade;
window.readableFg = readableFg;

// Plain-language readability label for a contrast ratio.
function readabilityLabel(ratio) {
  if (ratio >= 7) return {
    tone: "pass",
    title: "Very easy to read",
    detail: "Excellent — anyone can read this clearly."
  };
  if (ratio >= 4.5) return {
    tone: "pass",
    title: "Easy to read",
    detail: "Good — meets accessibility standards."
  };
  if (ratio >= 3) return {
    tone: "warn",
    title: "A bit hard to read",
    detail: "Works for large text only. Pick darker or lighter colours for body text."
  };
  return {
    tone: "fail",
    title: "Very hard to read",
    detail: "Many people will struggle to read this. Please change one of the colours."
  };
}
window.readabilityLabel = readabilityLabel;

// ---------------------------------------------------------------------------
// Accessibility audit — used by the Publish flow and the live readability check.
// Returns:
//   { pairs:[…], failing:[…], adjusted:bool, blocked:bool, fallbacks:{text?} }
// `blocked` is true when a fail can't be safely auto-fixed (e.g. button label
// on primary). `adjusted` is true when we *can* auto-fix (e.g. body text on
// page background).
// ---------------------------------------------------------------------------
// Audit one mode's colour set. Returns { pairs, failing, fallbacks }.
function auditMode(c, modeLabel) {
  const pairs = [{
    id: "body",
    fg: c.text,
    bg: c.background,
    label: `Body text on page (${modeLabel} mode)`,
    fixable: true
  }, {
    id: "card",
    fg: c.text,
    bg: c.surface,
    label: `Body text on cards (${modeLabel} mode)`,
    fixable: true
  }, {
    id: "btn",
    fg: readableFg(c.primary),
    bg: c.primary,
    label: `Button label (${modeLabel} mode)`,
    fixable: false
  }, {
    id: "accent",
    fg: readableFg(c.accent),
    bg: c.accent,
    label: `Accent / highlight text (${modeLabel} mode)`,
    fixable: false
  }].map(p => {
    const ratio = contrastRatio(p.fg, p.bg);
    return {
      ...p,
      ratio,
      grade: contrastGrade(ratio)
    };
  });
  const failing = pairs.filter(p => p.grade === "fail");
  const fallbacks = {};
  const body = pairs.find(p => p.id === "body");
  if (body && body.grade === "fail") {
    const candidate = readableFg(c.background);
    if (contrastGrade(contrastRatio(candidate, c.background)) !== "fail") {
      fallbacks.text = candidate;
    }
  }
  return {
    pairs,
    failing,
    fallbacks
  };
}
function auditAccessibility(theme) {
  const light = auditMode(theme.colors.light, "light");
  const dark = auditMode(theme.colors.dark, "dark");
  const pairs = [...light.pairs.map(p => ({
    ...p,
    mode: "light"
  })), ...dark.pairs.map(p => ({
    ...p,
    mode: "dark"
  }))];
  const failing = pairs.filter(p => p.grade === "fail");
  const unfixable = failing.filter(p => !p.fixable);
  const fallbacks = {
    light: light.fallbacks,
    dark: dark.fallbacks
  };
  const anyFallback = !!(fallbacks.light.text || fallbacks.dark.text);
  return {
    pairs,
    failing,
    perMode: {
      light,
      dark
    },
    adjusted: failing.length > 0 && unfixable.length === 0 && anyFallback,
    blocked: unfixable.length > 0,
    fallbacks
  };
}
function applyAccessibilityFallbacks(theme, audit) {
  if (!audit || !audit.fallbacks) return theme;
  const next = {
    ...theme,
    colors: {
      light: {
        ...theme.colors.light
      },
      dark: {
        ...theme.colors.dark
      }
    }
  };
  if (audit.fallbacks.light && audit.fallbacks.light.text) next.colors.light.text = audit.fallbacks.light.text;
  if (audit.fallbacks.dark && audit.fallbacks.dark.text) next.colors.dark.text = audit.fallbacks.dark.text;
  return next;
}
window.auditAccessibility = auditAccessibility;
window.applyAccessibilityFallbacks = applyAccessibilityFallbacks;
window.auditMode = auditMode;

// ---------------------------------------------------------------------------
// Logo validation — runs before we accept an uploaded file.
// Enforces the validation criteria from the user stories: PNG/SVG/JPEG, ≤2 MB,
// reasonable pixel dimensions. Returns either { ok:true, dataUrl, name } or
// { ok:false, message }.
// ---------------------------------------------------------------------------
const LOGO_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxWidth: 2048,
  maxHeight: 2048,
  minHeight: 24,
  acceptedTypes: ["image/png", "image/svg+xml", "image/jpeg", "image/webp"],
  acceptedLabel: "PNG, SVG, JPEG or WebP"
};
window.LOGO_LIMITS = LOGO_LIMITS;
async function validateLogoFile(file) {
  if (!file) return {
    ok: false,
    message: "No file selected."
  };
  if (!LOGO_LIMITS.acceptedTypes.includes(file.type)) {
    return {
      ok: false,
      message: `That file type isn't supported. Please use ${LOGO_LIMITS.acceptedLabel}.`
    };
  }
  if (file.size > LOGO_LIMITS.maxBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      message: `That file is ${mb} MB — please use one under 2 MB (about one phone photo).`
    };
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
  // Skip pixel check for SVG (vector).
  if (file.type !== "image/svg+xml") {
    const dims = await new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({
        w: img.naturalWidth,
        h: img.naturalHeight
      });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    if (!dims) return {
      ok: false,
      message: "That file doesn't look like a valid picture."
    };
    if (dims.w > LOGO_LIMITS.maxWidth || dims.h > LOGO_LIMITS.maxHeight) {
      return {
        ok: false,
        message: `That picture is ${dims.w}×${dims.h} pixels — please use one no larger than 2048×2048.`
      };
    }
    if (dims.h < LOGO_LIMITS.minHeight) {
      return {
        ok: false,
        message: `That picture is too small (${dims.h}px tall). Use one at least 24px tall for clarity.`
      };
    }
  }
  return {
    ok: true,
    dataUrl,
    name: file.name
  };
}
window.validateLogoFile = validateLogoFile;

// ---------------------------------------------------------------------------
// Confirm modal — used by Publish, Cancel and Reset flows. Renders into the
// body via a portal-style fixed overlay; closes on Esc and click-out.
// ---------------------------------------------------------------------------
const ConfirmModal = ({
  data,
  onClose
}) => {
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const isPublishWithAudit = data.kind === "publish" && data.audit && data.audit.failing.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "dk-modal-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "dk-modal-title",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("header", {
    className: "dk-modal__head"
  }, /*#__PURE__*/React.createElement("div", {
    className: `dk-modal__icon dk-modal__icon--${data.confirmTone === "danger" ? "danger" : "primary"}`
  }, /*#__PURE__*/React.createElement(Icon, {
    name: data.kind === "publish" ? "send" : data.kind === "reset" ? "undo" : "alert",
    size: 22
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    id: "dk-modal-title",
    className: "dk-modal__title"
  }, data.title), /*#__PURE__*/React.createElement("p", {
    className: "dk-modal__detail"
  }, data.detail))), isPublishWithAudit && /*#__PURE__*/React.createElement("div", {
    className: `dk-modal__audit ${data.audit.blocked ? "is-blocked" : "is-warning"}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-modal__audit-head"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield",
    size: 18
  }), /*#__PURE__*/React.createElement("strong", null, data.audit.blocked ? "Some colours are too hard to read" : "We'll make one small fix when you publish")), /*#__PURE__*/React.createElement("ul", {
    className: "dk-modal__audit-list"
  }, data.audit.failing.map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-modal__audit-swatch",
    style: {
      background: p.bg,
      color: p.fg
    }
  }, "Aa"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "dk-modal__audit-label"
  }, p.label), /*#__PURE__*/React.createElement("div", {
    className: "dk-modal__audit-detail"
  }, p.fixable ? `Too low contrast (${p.ratio.toFixed(2)}:1). We'll switch your text colour to keep this readable.` : `Too low contrast (${p.ratio.toFixed(2)}:1). Please pick a darker or lighter shade before publishing.`)))))), /*#__PURE__*/React.createElement("footer", {
    className: "dk-modal__foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dk-btn dk-btn--ghost",
    onClick: onClose
  }, "Not yet"), /*#__PURE__*/React.createElement("button", {
    className: `dk-btn dk-btn--${data.confirmTone === "danger" ? "danger" : "primary"}`,
    disabled: data.confirmTone === "disabled",
    onClick: data.onConfirm
  }, data.confirmLabel))));
};
window.ConfirmModal = ConfirmModal;

// ---------------------------------------------------------------------------
// Toast — small slide-in confirmation pinned bottom-right.
// ---------------------------------------------------------------------------
const Toast = ({
  data,
  onClose
}) => /*#__PURE__*/React.createElement("div", {
  className: `dk-toast dk-toast--${data.tone}`,
  role: "status"
}, /*#__PURE__*/React.createElement("div", {
  className: `dk-toast__icon dk-toast__icon--${data.tone}`
}, /*#__PURE__*/React.createElement(Icon, {
  name: data.tone === "warn" ? "alert" : data.tone === "pass" ? "check" : "info",
  size: 18
})), /*#__PURE__*/React.createElement("div", {
  className: "dk-toast__body"
}, /*#__PURE__*/React.createElement("div", {
  className: "dk-toast__title"
}, data.title), /*#__PURE__*/React.createElement("div", {
  className: "dk-toast__detail"
}, data.detail)), /*#__PURE__*/React.createElement("button", {
  className: "dk-toast__close",
  "aria-label": "Dismiss",
  onClick: onClose
}, /*#__PURE__*/React.createElement(Icon, {
  name: "x",
  size: 16
})));
window.Toast = Toast;

// Tooltip: a small "?" icon that reveals a short explanation on hover or focus.
// Built for keyboard + mouse + touch. Wraps the popover in a span so it can
// live inline with other text.
const Tooltip = ({
  text,
  children,
  label = "More information"
}) => {
  const [open, setOpen] = React.useState(false);
  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const toggle = e => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(o => !o);
  };
  return /*#__PURE__*/React.createElement("span", {
    className: "dk-tip",
    onMouseEnter: show,
    onMouseLeave: hide
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "dk-tip__trigger",
    "aria-label": label,
    "aria-expanded": open,
    onFocus: show,
    onBlur: hide,
    onClick: toggle
  }, children || /*#__PURE__*/React.createElement(Icon, {
    name: "help",
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    className: `dk-tip__bubble ${open ? 'is-open' : ''}`,
    role: "tooltip"
  }, text));
};
window.Tooltip = Tooltip;
})(); } catch (e) { __ds_ns.__errors.push({ path: "theme-settings/utils.jsx", error: String((e && e.message) || e) }); }

// ui_kits/amaliblog/ArticleRow.jsx
try { (() => {
// AmaliBlog — Article row.

const ArticleRow = ({
  article,
  onOpen
}) => /*#__PURE__*/React.createElement("article", {
  className: "ab-row",
  onClick: () => onOpen && onOpen(article)
}, /*#__PURE__*/React.createElement("div", {
  className: "ab-row__thumb",
  style: {
    background: article.cover
  }
}, article.coverLabel && /*#__PURE__*/React.createElement("span", {
  className: "ab-row__cover-label"
}, article.coverLabel)), /*#__PURE__*/React.createElement("div", {
  className: "ab-row__body"
}, /*#__PURE__*/React.createElement("div", {
  className: "ab-row__author"
}, article.author), /*#__PURE__*/React.createElement("h3", {
  className: "ab-row__title"
}, article.title), /*#__PURE__*/React.createElement("p", {
  className: "ab-row__desc"
}, article.preview), /*#__PURE__*/React.createElement("div", {
  className: "ab-row__tags"
}, article.tags.slice(0, 2).map(t => /*#__PURE__*/React.createElement("span", {
  key: t,
  className: "ab-chip"
}, t)), article.tags.length > 2 && /*#__PURE__*/React.createElement("span", {
  className: "ab-chip ab-chip--more"
}, "+", article.tags.length - 2)), /*#__PURE__*/React.createElement("div", {
  className: "ab-row__meta"
}, /*#__PURE__*/React.createElement("span", {
  className: "ab-row__date"
}, article.date), /*#__PURE__*/React.createElement("span", {
  className: "ab-row__sep"
}), /*#__PURE__*/React.createElement("span", {
  className: "ab-meta-stat"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7M7 10H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3M7 10l4-8a2 2 0 0 1 4 0v3"
})), article.likes), /*#__PURE__*/React.createElement("span", {
  className: "ab-meta-stat"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
})), article.comments), /*#__PURE__*/React.createElement("button", {
  className: "ab-row__icon-btn",
  "aria-label": "Bookmark"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
}))), /*#__PURE__*/React.createElement("button", {
  className: "ab-row__icon-btn",
  "aria-label": "More"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "1"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "19",
  cy: "12",
  r: "1"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "5",
  cy: "12",
  r: "1"
}))))));
window.ArticleRow = ArticleRow;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/amaliblog/ArticleRow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/amaliblog/BlogNav.jsx
try { (() => {
// AmaliBlog — top nav.

const BlogNav = ({
  onWriteClick
}) => /*#__PURE__*/React.createElement("header", {
  className: "ab-nav"
}, /*#__PURE__*/React.createElement("div", {
  className: "ab-nav__left"
}, /*#__PURE__*/React.createElement("button", {
  className: "ab-icon-btn",
  "aria-label": "Menu"
}, /*#__PURE__*/React.createElement("svg", {
  width: "20",
  height: "20",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 6h18M3 12h18M3 18h18"
}))), /*#__PURE__*/React.createElement("a", {
  className: "ab-brand",
  href: "#"
}, /*#__PURE__*/React.createElement("span", {
  className: "ab-wordmark"
}, /*#__PURE__*/React.createElement("span", null, "A"), /*#__PURE__*/React.createElement("span", null, "m"), /*#__PURE__*/React.createElement("span", null, "a"), /*#__PURE__*/React.createElement("span", null, "l"), /*#__PURE__*/React.createElement("span", null, "i"), /*#__PURE__*/React.createElement("span", {
  className: "ab-wordmark__b"
}, "B"), /*#__PURE__*/React.createElement("span", null, "l"), /*#__PURE__*/React.createElement("span", null, "o"), /*#__PURE__*/React.createElement("span", null, "g")))), /*#__PURE__*/React.createElement("div", {
  className: "ab-search"
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "ab-search__icon"
}, /*#__PURE__*/React.createElement("circle", {
  cx: "11",
  cy: "11",
  r: "8"
}), /*#__PURE__*/React.createElement("path", {
  d: "m21 21-4.3-4.3"
})), /*#__PURE__*/React.createElement("input", {
  className: "ab-search__input",
  placeholder: "Search"
}), /*#__PURE__*/React.createElement("button", {
  className: "ab-search__submit",
  "aria-label": "Search"
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("circle", {
  cx: "11",
  cy: "11",
  r: "8"
}), /*#__PURE__*/React.createElement("path", {
  d: "m21 21-4.3-4.3"
})))), /*#__PURE__*/React.createElement("div", {
  className: "ab-nav__right"
}, /*#__PURE__*/React.createElement("button", {
  className: "ab-write",
  onClick: onWriteClick
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
})), "Write"), /*#__PURE__*/React.createElement("button", {
  className: "ab-icon-btn ab-icon-btn--with-dot",
  "aria-label": "Notifications"
}, /*#__PURE__*/React.createElement("svg", {
  width: "20",
  height: "20",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M10.3 21a1.94 1.94 0 0 0 3.4 0"
})), /*#__PURE__*/React.createElement("span", {
  className: "ab-icon-btn__dot"
})), /*#__PURE__*/React.createElement("div", {
  className: "ab-nav__avatar"
}, /*#__PURE__*/React.createElement("span", null, "RH"))));
window.BlogNav = BlogNav;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/amaliblog/BlogNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/amaliblog/FeedTabs.jsx
try { (() => {
// AmaliBlog — feed tabs.

const FeedTabs = ({
  active,
  onChange
}) => /*#__PURE__*/React.createElement("nav", {
  className: "ab-tabs"
}, /*#__PURE__*/React.createElement("button", {
  className: `ab-tab ${active === "for-you" ? 'is-active' : ''}`,
  onClick: () => onChange("for-you")
}, "For you"), /*#__PURE__*/React.createElement("button", {
  className: `ab-tab ${active === "featured" ? 'is-active' : ''}`,
  onClick: () => onChange("featured")
}, "Featured", active === "featured" && /*#__PURE__*/React.createElement("span", {
  className: "ab-tab__tooltip"
}, "Stories with most reads")));
window.FeedTabs = FeedTabs;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/amaliblog/FeedTabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/amaliblog/Pagination.jsx
try { (() => {
// AmaliBlog — Pagination.

const Pagination = ({
  current = 2,
  total = 100,
  onChange
}) => {
  const pages = [];
  // Compact: 1 2 3 4 5 … 100
  for (let i = 1; i <= 5; i++) pages.push(i);
  pages.push("…");
  pages.push(total);
  return /*#__PURE__*/React.createElement("nav", {
    className: "ab-paginate",
    "aria-label": "Pagination"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ab-paginate__arrow",
    disabled: current <= 1
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m15 18-6-6 6-6"
  }))), pages.map((p, i) => p === "…" ? /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "ab-paginate__gap"
  }, p) : /*#__PURE__*/React.createElement("button", {
    key: i,
    className: `ab-paginate__page ${p === current ? 'is-active' : ''}`,
    onClick: () => onChange && onChange(p)
  }, p)), /*#__PURE__*/React.createElement("button", {
    className: "ab-paginate__arrow",
    disabled: current >= total
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  }))));
};
window.Pagination = Pagination;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/amaliblog/Pagination.jsx", error: String((e && e.message) || e) }); }

// ui_kits/amaliblog/RightRail.jsx
try { (() => {
// AmaliBlog — Right rail. Staff Picks + Recommended Topics.

const STAFF_PICKS = [{
  initials: "HR",
  role: "HR",
  title: "Amalitech HR Policies",
  date: "Oct 6, 2025",
  tone: "darkblue"
}, {
  initials: "IT",
  role: "IT",
  title: "Password Management Policy",
  date: "Oct 6, 2025",
  tone: "orange"
}, {
  initials: "FM",
  role: "Finance",
  title: "Importance of Budgeting",
  date: "Oct 6, 2025",
  tone: "green"
}];
const TOPICS = ["Training Insights", "Web Development", "Mobile App Development", "Artificial Intelligence", "Platforms", "Cybersecurity", "Data Analytics", "Miscellaneous", "AmaliTech Life", "Cloud Transformation", "Client & Project Experience"];
const RightRail = () => /*#__PURE__*/React.createElement("aside", {
  className: "ab-rail"
}, /*#__PURE__*/React.createElement("section", {
  className: "ab-rail__section"
}, /*#__PURE__*/React.createElement("h3", {
  className: "ab-rail__title"
}, "Staff Picks"), /*#__PURE__*/React.createElement("ul", {
  className: "ab-picks"
}, STAFF_PICKS.map(p => /*#__PURE__*/React.createElement("li", {
  key: p.role,
  className: "ab-pick"
}, /*#__PURE__*/React.createElement("div", {
  className: "ab-pick__head"
}, /*#__PURE__*/React.createElement("span", {
  className: `ab-pick__avatar ab-pick__avatar--${p.tone}`
}, p.initials), /*#__PURE__*/React.createElement("span", {
  className: "ab-pick__role"
}, p.role)), /*#__PURE__*/React.createElement("div", {
  className: "ab-pick__title"
}, p.title), /*#__PURE__*/React.createElement("div", {
  className: "ab-pick__date"
}, p.date)))), /*#__PURE__*/React.createElement("a", {
  href: "#",
  className: "ab-rail__more"
}, "See full list")), /*#__PURE__*/React.createElement("section", {
  className: "ab-rail__section"
}, /*#__PURE__*/React.createElement("h3", {
  className: "ab-rail__title"
}, "Recommended Topics"), /*#__PURE__*/React.createElement("div", {
  className: "ab-topics"
}, TOPICS.map(t => /*#__PURE__*/React.createElement("button", {
  key: t,
  className: "ab-topic"
}, t)))));
window.RightRail = RightRail;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/amaliblog/RightRail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/arms_dashboard/AppsGrid.jsx
try { (() => {
// ARMS — Apps grid. A monochrome row of "applet" cards.
//
// In the Figma each card is the same height as the others in the row,
// with a glyph in a soft tile + a tiny label below. Tap-target is the
// whole card.

const APPS = [{
  id: "clock",
  label: "Clock in",
  icon: "clock"
}, {
  id: "employee",
  label: "Employee Manager",
  icon: "users"
}, {
  id: "leave",
  label: "Leave Manager",
  icon: "calendar"
}, {
  id: "loan",
  label: "Loan Manager",
  icon: "wallet"
}, {
  id: "perf",
  label: "Performance Manager",
  icon: "bar-chart"
}];
const Glyph = ({
  name
}) => {
  // Lucide-style 2 px stroke outline icons.
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };
  switch (name) {
    case "clock":
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M12 7v5l3 2"
      }));
    case "users":
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
        d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "9",
        cy: "7",
        r: "4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
      }));
    case "calendar":
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "4",
        width: "18",
        height: "18",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 2v4M8 2v4M3 10h18"
      }));
    case "wallet":
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("path", {
        d: "M20 12V8H6a2 2 0 0 1 0-4h12v4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M4 6v12a2 2 0 0 0 2 2h14v-4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M18 12a2 2 0 0 0 0 4h4v-4Z"
      }));
    case "bar-chart":
      return /*#__PURE__*/React.createElement("svg", props, /*#__PURE__*/React.createElement("line", {
        x1: "12",
        y1: "20",
        x2: "12",
        y2: "10"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "18",
        y1: "20",
        x2: "18",
        y2: "4"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "6",
        y1: "20",
        x2: "6",
        y2: "16"
      }));
    default:
      return null;
  }
};
const AppsGrid = () => /*#__PURE__*/React.createElement("section", {
  className: "arms-section"
}, /*#__PURE__*/React.createElement("h2", {
  className: "arms-section__title"
}, "Apps"), /*#__PURE__*/React.createElement("div", {
  className: "arms-apps"
}, APPS.map(app => /*#__PURE__*/React.createElement("button", {
  key: app.id,
  className: "arms-app"
}, /*#__PURE__*/React.createElement("span", {
  className: "arms-app__glyph"
}, /*#__PURE__*/React.createElement(Glyph, {
  name: app.icon
})), /*#__PURE__*/React.createElement("span", {
  className: "arms-app__label"
}, app.label)))));
window.AppsGrid = AppsGrid;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/arms_dashboard/AppsGrid.jsx", error: String((e && e.message) || e) }); }

// ui_kits/arms_dashboard/Celebrations.jsx
try { (() => {
// ARMS — Celebrations strip. Photographic-style avatar tiles for birthdays /
// anniversaries / new hires. In the Figma these are real photos; we use solid
// color stand-ins with initials + the canonical layout.

const PEOPLE = [{
  name: "Stephens Edem Sablah",
  role: "Employee",
  date: "10th Oct 2025 · Birthday",
  initials: "SE",
  tone: "darkblue"
}, {
  name: "Paa Kwesi Ephraim",
  role: "Employee",
  date: "10th Oct 2025 · Anniversary",
  initials: "PE",
  tone: "orange"
}, {
  name: "Bright Kumodzro",
  role: "Employee",
  date: "10th Oct 2025 · Birthday",
  initials: "BK",
  tone: "green"
}, {
  name: "Rhoda Arthur",
  role: "Employee",
  date: "10th Oct 2025 · Anniversary",
  initials: "RA",
  tone: "purple"
}];
const Celebrations = () => /*#__PURE__*/React.createElement("section", {
  className: "arms-section"
}, /*#__PURE__*/React.createElement("h2", {
  className: "arms-section__title"
}, "Celebrations"), /*#__PURE__*/React.createElement("div", {
  className: "arms-celebrations"
}, PEOPLE.map(p => /*#__PURE__*/React.createElement("article", {
  key: p.name,
  className: "arms-celebration"
}, /*#__PURE__*/React.createElement("div", {
  className: `arms-celebration__photo arms-celebration__photo--${p.tone}`
}, /*#__PURE__*/React.createElement("span", null, p.initials)), /*#__PURE__*/React.createElement("div", {
  className: "arms-celebration__meta"
}, /*#__PURE__*/React.createElement("div", {
  className: "arms-celebration__name"
}, p.name), /*#__PURE__*/React.createElement("div", {
  className: "arms-celebration__role"
}, p.role), /*#__PURE__*/React.createElement("div", {
  className: "arms-celebration__date"
}, p.date)))), /*#__PURE__*/React.createElement("button", {
  className: "arms-celebration__more",
  "aria-label": "See more"
}, /*#__PURE__*/React.createElement("svg", {
  width: "18",
  height: "18",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m9 18 6-6-6-6"
})))));
window.Celebrations = Celebrations;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/arms_dashboard/Celebrations.jsx", error: String((e && e.message) || e) }); }

// ui_kits/arms_dashboard/PlansEmpty.jsx
try { (() => {
// ARMS — Plans (empty state). "You're all caught up."

const PlansEmpty = () => /*#__PURE__*/React.createElement("section", {
  className: "arms-section arms-plans"
}, /*#__PURE__*/React.createElement("h2", {
  className: "arms-section__title"
}, "Plans"), /*#__PURE__*/React.createElement("div", {
  className: "arms-plans__empty"
}, /*#__PURE__*/React.createElement("div", {
  className: "arms-plans__caught-up"
}, "You're all caught up"), /*#__PURE__*/React.createElement("div", {
  className: "arms-plans__sub"
}, "Tasks that need attention appear here."), /*#__PURE__*/React.createElement("button", {
  className: "arms-plans__add"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M12 5v14M5 12h14"
})), "Add a new task")));
window.PlansEmpty = PlansEmpty;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/arms_dashboard/PlansEmpty.jsx", error: String((e && e.message) || e) }); }

// ui_kits/arms_dashboard/RightRail.jsx
try { (() => {
// ARMS — Right rail. Who's out (today + tomorrow), public holidays.

const WHOS_OUT_TODAY = ["BK", "SE", "PE", "RA"]; // 4 people
const WHOS_OUT_TOMORROW = ["BK", "PE", "RA"];
const HOLIDAYS = [{
  date: "5th Dec, 2025",
  name: "Farmer's Day",
  flag: "🇬🇭"
}, {
  date: "25th Dec, 2025",
  name: "Christmas Day",
  flag: "🇬🇭"
}, {
  date: "26th Dec, 2025",
  name: "Christmas Day",
  flag: "🇬🇭"
}];
const AvatarStack = ({
  ids,
  max = 3
}) => {
  const shown = ids.slice(0, max);
  const rest = Math.max(0, ids.length - max);
  return /*#__PURE__*/React.createElement("div", {
    className: "arms-stack"
  }, shown.map((id, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: `arms-stack__av tone-${i}`
  }, id)), rest > 0 && /*#__PURE__*/React.createElement("span", {
    className: "arms-stack__more"
  }, "+", rest));
};
const RightRail = () => /*#__PURE__*/React.createElement("aside", {
  className: "arms-rail"
}, /*#__PURE__*/React.createElement("section", {
  className: "arms-rail__section"
}, /*#__PURE__*/React.createElement("h3", {
  className: "arms-rail__title"
}, "Who's out"), /*#__PURE__*/React.createElement("div", {
  className: "arms-out"
}, /*#__PURE__*/React.createElement("div", {
  className: "arms-out__row"
}, /*#__PURE__*/React.createElement("span", {
  className: "arms-out__when"
}, "Today"), /*#__PURE__*/React.createElement(AvatarStack, {
  ids: WHOS_OUT_TODAY
})), /*#__PURE__*/React.createElement("div", {
  className: "arms-out__row"
}, /*#__PURE__*/React.createElement("span", {
  className: "arms-out__when"
}, "Tomorrow"), /*#__PURE__*/React.createElement(AvatarStack, {
  ids: WHOS_OUT_TOMORROW
})))), /*#__PURE__*/React.createElement("section", {
  className: "arms-rail__section"
}, /*#__PURE__*/React.createElement("h3", {
  className: "arms-rail__title"
}, "Upcoming Public Holidays"), /*#__PURE__*/React.createElement("ul", {
  className: "arms-holidays"
}, HOLIDAYS.map((h, i) => /*#__PURE__*/React.createElement("li", {
  key: i,
  className: "arms-holiday"
}, /*#__PURE__*/React.createElement("span", {
  className: "arms-holiday__date"
}, h.date), /*#__PURE__*/React.createElement("span", {
  className: "arms-holiday__name"
}, h.name), /*#__PURE__*/React.createElement("span", {
  className: "arms-holiday__flag",
  "aria-hidden": "true"
}, h.flag))))));
window.RightRail = RightRail;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/arms_dashboard/RightRail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/arms_dashboard/Topbar.jsx
try { (() => {
// ARMS — Topbar
// Logo (SVG, official AmaliTech wordmark), app-switcher pill, user avatar.

const Topbar = ({
  dark
}) => /*#__PURE__*/React.createElement("header", {
  className: "arms-topbar"
}, /*#__PURE__*/React.createElement("div", {
  className: "arms-topbar__brand"
}, /*#__PURE__*/React.createElement("img", {
  className: "arms-logo",
  src: dark ? "../../assets/logo-wordmark-white.svg" : "../../assets/logo-wordmark-default.svg",
  alt: "AmaliTech",
  height: "28"
})), /*#__PURE__*/React.createElement("div", {
  className: "arms-topbar__right"
}, /*#__PURE__*/React.createElement("button", {
  className: "arms-pill-btn",
  "aria-label": "Apps"
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "3",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "14",
  y: "3",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "14",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "14",
  y: "14",
  width: "7",
  height: "7",
  rx: "1"
})), "Apps"), /*#__PURE__*/React.createElement("div", {
  className: "arms-user"
}, /*#__PURE__*/React.createElement("span", {
  className: "arms-user__name"
}, "Bright"), /*#__PURE__*/React.createElement("div", {
  className: "arms-user__avatar"
}, "BK"))));
window.Topbar = Topbar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/arms_dashboard/Topbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/arms_dashboard/WidgetCard.jsx
try { (() => {
// ARMS — Widget card. The three rows below the Apps grid.
//
// One glyph (colored), a title + helper text, a single primary action button.
// Action is always a pill button with the canonical brand verb (sentence case).

const WidgetCard = ({
  tone = "orange",
  title,
  helper,
  action,
  onAction,
  glyph
}) => /*#__PURE__*/React.createElement("article", {
  className: `arms-widget arms-widget--${tone}`
}, /*#__PURE__*/React.createElement("div", {
  className: "arms-widget__icon"
}, glyph), /*#__PURE__*/React.createElement("div", {
  className: "arms-widget__body"
}, /*#__PURE__*/React.createElement("div", {
  className: "arms-widget__title"
}, title), /*#__PURE__*/React.createElement("div", {
  className: "arms-widget__helper"
}, helper)), /*#__PURE__*/React.createElement("button", {
  className: "arms-widget__action",
  onClick: onAction
}, action));

// 3 pre-built widgets that ship on the canonical screen.
const LeaveWidget = () => /*#__PURE__*/React.createElement(WidgetCard, {
  tone: "orange",
  title: "My Annual Leave",
  helper: "An overview of your available leave days.",
  action: "Book a leave",
  glyph: /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 2v4M8 2v4M3 10h18"
  }))
});
const ClockWidget = () => /*#__PURE__*/React.createElement(WidgetCard, {
  tone: "darkblue",
  title: "11:01 am",
  helper: "Have you clocked your time?",
  action: "Clock in",
  glyph: /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v5l3 2"
  }))
});
const LoanWidget = () => /*#__PURE__*/React.createElement(WidgetCard, {
  tone: "green",
  title: "My Loan Request",
  helper: "Overview of your total loan request.",
  action: "Check in",
  glyph: /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "6",
    width: "20",
    height: "12",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 10h20M6 14h4"
  }))
});
window.WidgetCard = WidgetCard;
window.LeaveWidget = LeaveWidget;
window.ClockWidget = ClockWidget;
window.LoanWidget = LoanWidget;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/arms_dashboard/WidgetCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/leave_management/IncidentsTable.jsx
try { (() => {
// Leave Management — Incidents table.

const INCIDENTS = [{
  id: "INC-2031",
  title: "Laptop won't boot after update",
  cat: "Hardware",
  prio: "high",
  status: "open",
  opened: "5th Dec, 2025"
}, {
  id: "INC-2030",
  title: "VPN refusing connection from Takoradi",
  cat: "Network",
  prio: "medium",
  status: "in-progress",
  opened: "4th Dec, 2025"
}, {
  id: "INC-2029",
  title: "Adobe license expired",
  cat: "Software",
  prio: "low",
  status: "open",
  opened: "3rd Dec, 2025"
}, {
  id: "INC-2027",
  title: "Slack messages not syncing",
  cat: "Software",
  prio: "medium",
  status: "resolved",
  opened: "1st Dec, 2025"
}];
const StatusBadge = ({
  status
}) => {
  const map = {
    "open": {
      label: "Open",
      cls: "lms-badge--info"
    },
    "in-progress": {
      label: "In progress",
      cls: "lms-badge--warn"
    },
    "resolved": {
      label: "Resolved",
      cls: "lms-badge--success"
    }
  };
  const m = map[status];
  return /*#__PURE__*/React.createElement("span", {
    className: `lms-badge ${m.cls}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "lms-badge__dot"
  }), m.label);
};
const PrioBadge = ({
  p
}) => {
  const map = {
    high: {
      label: "High",
      cls: "lms-badge--error"
    },
    medium: {
      label: "Medium",
      cls: "lms-badge--warn"
    },
    low: {
      label: "Low",
      cls: "lms-badge--neutral"
    }
  };
  const m = map[p];
  return /*#__PURE__*/React.createElement("span", {
    className: `lms-badge ${m.cls}`
  }, m.label);
};
const IncidentsTable = () => /*#__PURE__*/React.createElement("section", {
  className: "lms-incidents"
}, /*#__PURE__*/React.createElement("header", {
  className: "lms-incidents__head"
}, /*#__PURE__*/React.createElement("h2", {
  className: "lms-section__title"
}, "My Incidents"), /*#__PURE__*/React.createElement("div", {
  className: "lms-incidents__actions"
}, /*#__PURE__*/React.createElement("button", {
  className: "lms-pill-btn lms-pill-btn--secondary"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M22 11.08V12a10 10 0 1 1-5.93-9.14"
}), /*#__PURE__*/React.createElement("path", {
  d: "m9 11 3 3 9-9"
})), "Invite User"), /*#__PURE__*/React.createElement("button", {
  className: "lms-pill-btn lms-pill-btn--primary"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "3",
  width: "18",
  height: "18",
  rx: "2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M9 9h6M9 13h6M9 17h4"
})), "Generate Report"))), /*#__PURE__*/React.createElement("div", {
  className: "lms-table"
}, /*#__PURE__*/React.createElement("div", {
  className: "lms-table__head"
}, /*#__PURE__*/React.createElement("span", null, "ID"), /*#__PURE__*/React.createElement("span", null, "Title"), /*#__PURE__*/React.createElement("span", null, "Category"), /*#__PURE__*/React.createElement("span", null, "Priority"), /*#__PURE__*/React.createElement("span", null, "Status"), /*#__PURE__*/React.createElement("span", null, "Opened")), INCIDENTS.map(i => /*#__PURE__*/React.createElement("div", {
  key: i.id,
  className: "lms-table__row"
}, /*#__PURE__*/React.createElement("span", {
  className: "lms-table__mono"
}, i.id), /*#__PURE__*/React.createElement("span", {
  className: "lms-table__title"
}, i.title), /*#__PURE__*/React.createElement("span", null, i.cat), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(PrioBadge, {
  p: i.prio
})), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(StatusBadge, {
  status: i.status
})), /*#__PURE__*/React.createElement("span", {
  className: "lms-table__date"
}, i.opened)))));
window.IncidentsTable = IncidentsTable;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/leave_management/IncidentsTable.jsx", error: String((e && e.message) || e) }); }

// ui_kits/leave_management/Sidebar.jsx
try { (() => {
// Leave Management — Sidebar
//
// 280 px wide. Logo top, primary nav, settings + help at the bottom.

const NAV = [{
  id: "dashboard",
  label: "Dashboard",
  icon: "home"
}, {
  id: "menu",
  label: "Menu",
  icon: "pie",
  active: true
}, {
  id: "calendar",
  label: "Calendar",
  icon: "calendar",
  expandable: true,
  children: [{
    id: "today",
    label: "Today"
  }, {
    id: "month",
    label: "Month"
  }, {
    id: "year",
    label: "Year"
  }]
}, {
  id: "files",
  label: "Files",
  icon: "files"
}, {
  id: "messages",
  label: "Messages",
  icon: "message"
}, {
  id: "projects",
  label: "Projects",
  icon: "layout"
}, {
  id: "analytics",
  label: "Analytics",
  icon: "pie"
}, {
  id: "notifications",
  label: "Notifications",
  icon: "bell"
}];
const FOOTER_NAV = [{
  id: "settings",
  label: "Settings",
  icon: "settings"
}, {
  id: "help",
  label: "Help & support",
  icon: "help"
}];
const SidebarIcon = ({
  name
}) => {
  const p = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };
  switch (name) {
    case "home":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9 22V12h6v10"
      }));
    case "pie":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M21.21 15.89A10 10 0 1 1 8 2.83"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M22 12A10 10 0 0 0 12 2v10z"
      }));
    case "calendar":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "4",
        width: "18",
        height: "18",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M16 2v4M8 2v4M3 10h18"
      }));
    case "files":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M21 8v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h8z"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M14 1v6h6"
      }));
    case "message":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      }));
    case "layout":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M3 9h18M9 21V9"
      }));
    case "bell":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
        d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10.3 21a1.94 1.94 0 0 0 3.4 0"
      }));
    case "settings":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      }));
    case "help":
      return /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"
      }));
    default:
      return null;
  }
};
const NavItem = ({
  item,
  expanded,
  onToggle
}) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
  className: `lms-nav__item ${item.active ? 'is-active' : ''}`,
  onClick: () => item.expandable && onToggle(item.id)
}, /*#__PURE__*/React.createElement("span", {
  className: "lms-nav__icon"
}, /*#__PURE__*/React.createElement(SidebarIcon, {
  name: item.icon
})), /*#__PURE__*/React.createElement("span", {
  className: "lms-nav__label"
}, item.label), item.expandable && /*#__PURE__*/React.createElement("span", {
  className: `lms-nav__chevron ${expanded ? 'is-open' : ''}`
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m6 9 6 6 6-6"
})))), item.expandable && expanded && item.children && /*#__PURE__*/React.createElement("div", {
  className: "lms-nav__children"
}, item.children.map(c => /*#__PURE__*/React.createElement("button", {
  key: c.id,
  className: "lms-nav__child"
}, /*#__PURE__*/React.createElement("span", {
  className: "lms-nav__icon"
}, /*#__PURE__*/React.createElement(SidebarIcon, {
  name: "pie"
})), /*#__PURE__*/React.createElement("span", {
  className: "lms-nav__label"
}, c.label)))));
const Sidebar = () => {
  const [expanded, setExpanded] = React.useState("calendar");
  const toggle = id => setExpanded(prev => prev === id ? null : id);
  return /*#__PURE__*/React.createElement("aside", {
    className: "lms-sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lms-sidebar__brand"
  }, /*#__PURE__*/React.createElement("img", {
    className: "lms-logo",
    src: "../../assets/logo-wordmark-default.svg",
    alt: "AmaliTech",
    height: "22"
  })), /*#__PURE__*/React.createElement("nav", {
    className: "lms-nav"
  }, NAV.map(item => /*#__PURE__*/React.createElement(NavItem, {
    key: item.id,
    item: item,
    expanded: expanded === item.id,
    onToggle: toggle
  }))), /*#__PURE__*/React.createElement("nav", {
    className: "lms-nav lms-nav--footer"
  }, FOOTER_NAV.map(item => /*#__PURE__*/React.createElement(NavItem, {
    key: item.id,
    item: item
  }))));
};
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/leave_management/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/leave_management/StatCard.jsx
try { (() => {
// Leave Management — Stat card. Two-up at the top of the screen.

const StatCard = ({
  tone,
  title,
  helper,
  action,
  value
}) => /*#__PURE__*/React.createElement("article", {
  className: "lms-stat"
}, /*#__PURE__*/React.createElement("div", {
  className: `lms-stat__dot lms-stat__dot--${tone}`
}), /*#__PURE__*/React.createElement("div", {
  className: "lms-stat__body"
}, /*#__PURE__*/React.createElement("div", {
  className: "lms-stat__title"
}, title), /*#__PURE__*/React.createElement("div", {
  className: "lms-stat__helper"
}, helper), value && /*#__PURE__*/React.createElement("div", {
  className: "lms-stat__value"
}, value), /*#__PURE__*/React.createElement("button", {
  className: "lms-stat__action"
}, action)));
const OpenIncidentsCard = () => /*#__PURE__*/React.createElement(StatCard, {
  tone: "orange",
  title: "Open Incidents",
  helper: "Number of unresolved incidents",
  value: "3",
  action: "Add new incident"
});
const AnnualLeaveCard = () => /*#__PURE__*/React.createElement(StatCard, {
  tone: "green",
  title: "My Annual Leave",
  helper: "Number of annual leaves remaining",
  value: "12 days",
  action: "Book a leave"
});
window.StatCard = StatCard;
window.OpenIncidentsCard = OpenIncidentsCard;
window.AnnualLeaveCard = AnnualLeaveCard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/leave_management/StatCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/leave_management/ToolCarousel.jsx
try { (() => {
// Leave Management — Tools & Certifications carousel.
//
// Each tool card carries the real (or stylised) brand mark, name, and a
// "X+ years of using …" description. Carousel arrows on either side.

const TOOLS = [{
  id: "jira",
  name: "Jira",
  desc: "5+ years of Jira use for project tracking and team alignment.",
  logo: "jira"
}, {
  id: "blender",
  name: "Blender",
  desc: "3+ years of 3D modelling experience for huge and popular brands.",
  logo: "blender"
}, {
  id: "photoshop",
  name: "Photoshop",
  desc: "6+ years of designing with Photoshop for large, medium and small brands.",
  logo: "photoshop"
}, {
  id: "illustrator",
  name: "Illustrator",
  desc: "9+ years of illustrating visuals for large, medium and small brands.",
  logo: "illustrator"
}];
const ToolLogo = ({
  name
}) => {
  // Stylised tool-brand marks. Solid-color tiles + identifying letter to avoid
  // any trademarked artwork. Reads "good enough" at carousel-card scale.
  const tile = (bg, fg, ch, font = "display") => /*#__PURE__*/React.createElement("div", {
    className: "lms-tool__mark",
    style: {
      background: bg,
      color: fg,
      fontFamily: font === "display" ? "var(--font-display)" : "var(--font-sans)"
    }
  }, ch);
  switch (name) {
    case "jira":
      return tile("#0052CC", "#FFFFFF", "Jr");
    case "blender":
      return tile("#FF7B33", "#1F2A30", "B", "display");
    case "photoshop":
      return tile("#001E36", "#31A8FF", "Ps");
    case "illustrator":
      return tile("#330000", "#FF9A00", "Ai");
    default:
      return tile("#ECECEB", "#3E3D3A", "—");
  }
};
const ToolCarousel = () => /*#__PURE__*/React.createElement("section", {
  className: "lms-tools"
}, /*#__PURE__*/React.createElement("header", {
  className: "lms-tools__head"
}, /*#__PURE__*/React.createElement("h2", {
  className: "lms-section__title"
}, "Tools & Certifications"), /*#__PURE__*/React.createElement("button", {
  className: "lms-pill-btn lms-pill-btn--secondary"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M12 5v14M5 12h14"
})), "Add new tool")), /*#__PURE__*/React.createElement("div", {
  className: "lms-tools__grid"
}, TOOLS.map(t => /*#__PURE__*/React.createElement("article", {
  key: t.id,
  className: "lms-tool"
}, /*#__PURE__*/React.createElement(ToolLogo, {
  name: t.logo
}), /*#__PURE__*/React.createElement("div", {
  className: "lms-tool__name"
}, t.name), /*#__PURE__*/React.createElement("div", {
  className: "lms-tool__desc"
}, t.desc)))), /*#__PURE__*/React.createElement("div", {
  className: "lms-tools__pager"
}, /*#__PURE__*/React.createElement("button", {
  className: "lms-tools__arrow",
  "aria-label": "Previous"
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m15 18-6-6 6-6"
}))), /*#__PURE__*/React.createElement("div", {
  className: "lms-tools__dots"
}, /*#__PURE__*/React.createElement("span", {
  className: "is-active"
}), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("button", {
  className: "lms-tools__arrow lms-tools__arrow--solid",
  "aria-label": "Next"
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m9 18 6-6-6-6"
})))));
window.ToolCarousel = ToolCarousel;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/leave_management/ToolCarousel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/leave_management/Topbar.jsx
try { (() => {
// Leave Management — Topbar with breadcrumb.

const Topbar = () => /*#__PURE__*/React.createElement("header", {
  className: "lms-topbar"
}, /*#__PURE__*/React.createElement("div", {
  className: "lms-topbar__left"
}, /*#__PURE__*/React.createElement("button", {
  className: "lms-back",
  "aria-label": "Back"
}, /*#__PURE__*/React.createElement("svg", {
  width: "18",
  height: "18",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m15 18-6-6 6-6"
}))), /*#__PURE__*/React.createElement("h1", {
  className: "lms-topbar__title"
}, "Dashboard")), /*#__PURE__*/React.createElement("div", {
  className: "lms-topbar__right"
}, /*#__PURE__*/React.createElement("button", {
  className: "lms-pill-btn"
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "3",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "14",
  y: "3",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "3",
  y: "14",
  width: "7",
  height: "7",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "14",
  y: "14",
  width: "7",
  height: "7",
  rx: "1"
})), "Apps"), /*#__PURE__*/React.createElement("div", {
  className: "lms-user"
}, /*#__PURE__*/React.createElement("span", {
  className: "lms-user__name"
}, "Bright"), /*#__PURE__*/React.createElement("div", {
  className: "lms-user__avatar"
}, "BK"))));
const Breadcrumb = () => /*#__PURE__*/React.createElement("nav", {
  className: "lms-breadcrumb",
  "aria-label": "Breadcrumb"
}, /*#__PURE__*/React.createElement("a", {
  href: "#",
  className: "lms-breadcrumb__home"
}, /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
})), "Dashboard"), /*#__PURE__*/React.createElement("span", {
  className: "lms-breadcrumb__sep"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m9 18 6-6-6-6"
}))), /*#__PURE__*/React.createElement("a", {
  href: "#"
}, "Robert Hlovor"), /*#__PURE__*/React.createElement("span", {
  className: "lms-breadcrumb__sep"
}, /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m9 18 6-6-6-6"
}))), /*#__PURE__*/React.createElement("span", {
  className: "lms-breadcrumb__current"
}, "Profile"));
window.Topbar = Topbar;
window.Breadcrumb = Breadcrumb;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/leave_management/Topbar.jsx", error: String((e && e.message) || e) }); }

})();
