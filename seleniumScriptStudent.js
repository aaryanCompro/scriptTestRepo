const { config } = require("./config.js");
let driver;
let chrome;
let By, until;
let cfAccessClientId;
let cfAccessClientSecret;
let loginUsername;
let loginPassword;
let classId = null;
let loginSuccessful = null;
let configResult = {}; // global result object to check for final error for script

function createResultObjectForBundle(bundle, skills) {
  const result = {};
  for (const skill in skills) {
    if (skills[skill]) {
      result[skill] = {
        recommendationsLoading: null,
        classDataViewsLoading: null,
        learnerDataViewsLoading: null,
        learnerDataViewActivitiesPresent: null,
        cefrReportLoading: null,
        learnerAssignmentDataViewsLoading: null,
      };
    }
  }
  if (JSON.stringify(result) != "{}") {
    result["bundleActivatedClassPresent"] = null;
  }

  return result;
}

