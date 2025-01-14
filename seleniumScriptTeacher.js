const config = {
  "RL-25 B2": {
    skills: {
      Reading: true,
      Listening: false,
    },
    selectors: {
      bundleCardToggleButtonIdReplacer: "rl-25",
    },
  },
  "RL-25 B1": {
    skills: {
      Reading: false,
    },
    selectors: {
      bundleCardToggleButtonIdReplacer: "rl-25",
    },
  },
  "Personalised Learning A2": {
    skills: {
      Reading: false,
      Listening: false,
    },
    selectors: {
      bundleCardToggleButtonIdReplacer: "mosaic",
    },
  },
  "Personalised Learning B2": {
    skills: {
      Reading: false,
      Listening: false,
    },
    selectors: {
      bundleCardToggleButtonIdReplacer: "mosaic",
    },
  },
};

let driver;
let chrome;
let By, until;
let cfAccessClientId;
let cfAccessClientSecret;
let loginUsername;
let loginPassword;
let createdAssignmentName = null;
let areMultipleSkillsPresent = false; // global flag to check whether multiple skills are present or not in a bundle
let configResult = {}; // global result object to check for final error for script

