const BRAND = {
  name: "mewbit",
  tagline: "neon sounds for every mood",
  presence: [
    "neon frequencies • /play",
    "vibe locked • /autoplay",
    "cyan nights • /lyrics",
    "mixing your mood • /queue",
    "mewbit.exe • /help",
  ],
  colors: {
    primary: "#19e6ff",
    secondary: "#ff2bd6",
    deep: "#17124f",
    success: "#22e6b8",
    warning: "#ffcc66",
    error: "#ff4f8b",
  },
};

function brandFooter(section) {
  return section ? `${BRAND.name} • ${section}` : BRAND.name;
}

module.exports = { BRAND, brandFooter };
