
export const CPU_OPPONENT_COPY = {
  "rook": {
    "id": "rook",
    "name": "Rook",
    "description": "Makes a plan, then fights for the space to use it.",
    "tags": "Plans ahead · Controls space",
    "previews": {
      "rookie": "Strong at: Following a plan.\nWatch for: Slow answers and mistimed close attacks.",
      "beginner": "Strong at: Holding useful space.\nWatch for: Pressure that breaks the setup.",
      "intermediate": "Strong at: Spacing and learning habits.\nWatch for: Sudden pressure and missed gambles.",
      "advanced": "Strong at: Reading habits and fighting up close.\nWatch for: Hesitation at risky openings.",
      "expert": "Strong at: Adaptation, spacing and close conversions.\nWatch for: Baiting caution when a gamble is needed."
    }
  },
  "ember": {
    "id": "ember",
    "name": "Ember",
    "description": "Pushes the pace and looks for the next opening.",
    "tags": "Takes initiative · Keeps pressure",
    "previews": {
      "rookie": "Strong at: Quick approaches.\nWatch for: Repeated unsafe attacks.",
      "beginner": "Strong at: Basic pressure and follow-ups.\nWatch for: Chasing past a safe opening.",
      "intermediate": "Strong at: Sustained pressure and spotting escapes.\nWatch for: Impatient extensions.",
      "advanced": "Strong at: Pressure reads and defensive techs.\nWatch for: A baited extra attack.",
      "expert": "Strong at: Fast conversions, reads and pressure resets.\nWatch for: Impatience after a blocked push."
    }
  },
  "flint": {
    "id": "flint",
    "name": "Flint",
    "description": "Turns practiced movement into clean attacks.",
    "tags": "Precise movement · Clean follow-ups",
    "previews": {
      "rookie": "Strong at: Practiced movement.\nWatch for: Repeating a mistimed follow-up.",
      "beginner": "Strong at: Simple clean strings.\nWatch for: Starting them at the wrong distance.",
      "intermediate": "Strong at: Execution and reliable punishes.\nWatch for: Familiar routes after you change habits.",
      "advanced": "Strong at: Precise movement and matchup choices.\nWatch for: Conditioning the trusted follow-up.",
      "expert": "Strong at: Execution, adaptation and choosing conversions.\nWatch for: Baiting a rehearsed route."
    }
  },
  "vale": {
    "id": "vale",
    "name": "Vale",
    "description": "Stays composed, then turns defense into an opening.",
    "tags": "Patient defense · Punishes mistakes",
    "previews": {
      "rookie": "Strong at: Blocking obvious attacks.\nWatch for: Grabs and long waits.",
      "beginner": "Strong at: Basic whiff punishes.\nWatch for: Feints that keep the initiative.",
      "intermediate": "Strong at: Defense and proactive grabs.\nWatch for: Hesitation after a safe reset.",
      "advanced": "Strong at: Defense, safe approaches and pressure.\nWatch for: Delayed attacks that restart the wait.",
      "expert": "Strong at: Precise punishes and offense from defense.\nWatch for: Taking initiative while Vale waits for certainty."
    }
  },
  "kite": {
    "id": "kite",
    "name": "Kite",
    "description": "Changes pace and finds unusual ways through.",
    "tags": "Changes routes · Bold choices",
    "previews": {
      "rookie": "Strong at: Trying different routes.\nWatch for: Unsafe landings.",
      "beginner": "Strong at: Changing pace and escaping.\nWatch for: Dropped conversions.",
      "intermediate": "Strong at: Varied approaches and short conversions.\nWatch for: Bold recoveries.",
      "advanced": "Strong at: Pattern reads and reliable follow-ups.\nWatch for: A risky escape after being cornered.",
      "expert": "Strong at: Route changes, precise conversions and reads.\nWatch for: Recognizing the occasional bold recovery."
    }
  },
  "wren": {
    "id": "wren",
    "name": "Wren",
    "description": "Changes tools to match the fight in front of them.",
    "tags": "Flexible choices · Steady pace",
    "previews": {
      "rookie": "Strong at: Trying attack and defense.\nWatch for: Long pauses before a reset.",
      "beginner": "Strong at: Basic answers to several situations.\nWatch for: Comfortable repeated approaches.",
      "intermediate": "Strong at: Flexible tools and burst pressure.\nWatch for: Predictable resets under uncertainty.",
      "advanced": "Strong at: Matchup choices and conditioned punishes.\nWatch for: Baiting the return to neutral.",
      "expert": "Strong at: Adaptation, precise defense and varied pressure.\nWatch for: Conditioning the preferred neutral reset."
    }
  }
} as const;
