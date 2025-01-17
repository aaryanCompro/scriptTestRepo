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

function createResultObjectForBundle(bundle, skills) {
  const result = {};
  for (const skill in skills) {
    if (skills[skill]) {
      result[skill] = {
        teacherAssignmentDataViewsLoading: null,
        createAssignment: null,
      };
    }
  }
  return result;
}

const isNewRelicEnvironment = () => {
  return typeof $webDriver !== "undefined" && typeof $selenium !== "undefined";
};
async function setGlobalParametersFromAWSSecretsManager() {
  try {
    const AWS = require("aws-sdk");
    const secretsManager = new AWS.SecretsManager({
      region: "us-west-2",
    });
    const data = await secretsManager.getSecretValue({ SecretId: "qa/mosaic-app/frontend-early-warning-system" }).promise();
    const secrets = JSON.parse(data.SecretString);
    cfAccessClientId = secrets["cf-client-access-id"];
    cfAccessClientSecret = secrets["cf-client-access-secret"];
    loginUsername = secrets["teacher-username"];
    loginPassword = secrets["teacher-password"];
    return new Promise((res, rej) => {
      res(true);
    });
  } catch (err) {
    console.error(`Error getting parameter: ${err}`);
    return new Promise((res, rej) => {
      rej(err);
    });
  }
}
async function setGlobalVariables() {
  if (isNewRelicEnvironment()) {
    driver = $webDriver;
    By = $selenium.By;
    until = $selenium.until;
    await $browser.addHeader("CF-Access-Client-Id", $secure.CF_ACCESS_CLIENT_ID);
    await $browser.addHeader("CF-Access-Client-Secret", $secure.CF_ACCESS_CLIENT_SECRET);
  } else {
    await setGlobalParametersFromAWSSecretsManager();
    const headers = {
      "CF-Access-Client-Id": cfAccessClientId,
      "CF-Access-Client-Secret": cfAccessClientSecret,
    };
    chrome = require("selenium-webdriver/chrome");
    const webdriver = require("selenium-webdriver");
    ({ By, until } = webdriver);
    driver = await setupWebDriver(webdriver, headers);
  }
  return new Promise((res, rej) => res(true));
}

async function setupWebDriver(webdriver, headers) {
  const options = new chrome.Options();
  options.addArguments(
    "--disable-web-security", // Disable web security to allow CORS
    "--disable-popup-blocking", // Disable popup blocking
    "--disable-notifications", // Disable notifications
    "--start-maximized" // Start browser maximized
  );
  const driver = await new webdriver.Builder().forBrowser("chrome").setChromeOptions(options).build();

  // Enable CDP and Network domain
  await driver.sendDevToolsCommand("Network.enable");
  await driver.sendDevToolsCommand("Network.setExtraHTTPHeaders", { headers });
  return driver;
}

async function login() {
  try {
    console.log("Click login button");
    let loginbtn = await driver.wait(until.elementLocated(By.className("btn btn-white-bg btn-started c1-btn-disabled login-btn")), 50000);
    let username = isNewRelicEnvironment() ? $secure.TEACHER_USERNAME_DEV : loginUsername;
    let password = isNewRelicEnvironment() ? $secure.TEACHER_PASSWORD_DEV : loginPassword;
    await loginbtn.click();
    const gigyaLoginForm = await driver.wait(until.elementLocated(By.id("gigya-login-form")), 50000);
    console.log("Input user name");
    const userIdInput = await gigyaLoginForm.findElement(By.className("gigya-input-text"));
    await userIdInput.sendKeys(username);
    console.log("Input password");
    const passInput = await gigyaLoginForm.findElement(By.className("gigya-input-password"));
    await passInput.sendKeys(password);
    console.log("Login");
    const loginButton = await gigyaLoginForm.findElement(By.className("gigya-input-submit"));
    await loginButton.submit();
    await driver.wait(until.elementsLocated(By.className("gigya-screen-loader")), 50000);

    await driver.wait(until.stalenessOf(driver.findElement(By.className("gigya-screen-loader"))), 50000);
    try {
      let isErrorMsg = await driver.wait(until.elementLocated(By.className("gigya-form-error-msg gigya-error-msg-active")), 10000);
      if (isErrorMsg) {
        const errorMsg = await isErrorMsg.getText();
        if (errorMsg === "Please check your login and password and try again. You are limited to 5 attempts, or you can reset your password") {
          result.loginSuccessful = false;
          return new Promise((res, rej) => rej("Wrong credentials entered"));
        } else {
          result.loginSuccessful = false;
          return new Promise((res, rej) => rej(errorMsg));
        }
      }
    } catch (err) {
      return new Promise((res, rej) => res(true));
    }
  } catch (err) {
    console.log(err);
    return new Promise((res, rej) => rej(err));
  }
}

async function openAssignmentsScreen(bundle) {
  try {
    const bundleItems = await driver.wait(until.elementsLocated(By.className("umbrella-info")), 50000);
    let rl25BundleItem;
    for (let i = 0; i < bundleItems.length; i++) {
      try {
        const titleElement = await bundleItems[i].findElement(By.className("umbrella-title"));
        let title = await titleElement.getAttribute("title");
        title = title.trim();
        if (title === bundle) {
          rl25BundleItem = bundleItems[i];
          break;
        }
      } catch (err) {
        const addBtn = await bundleItems[i].findElement(By.className("single-umbrella add-button-tile"));
        if (addBtn) {
          continue;
        }
      }
    }
    const rl25BundleItemContiner = await rl25BundleItem.findElement(By.xpath('./ancestor::div[@class="my-classes"]'));
    const rl25BundleLinkContainer = await rl25BundleItemContiner.findElement(By.className("class-link-container"));
    const assignmentLink = await rl25BundleLinkContainer.findElement(By.xpath("./*[@aria-label='Assignments']"));
    await driver.executeScript("arguments[0].click();", assignmentLink);
    return new Promise((res, rej) => {
      res(true);
    });
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
}

async function checkTeacherAssignmentDataViews(skill, bundle) {
  try {
    console.log(`Checking Teacher Assignment Data Views for ${skill}`);
    const assignmentContainer = await driver.wait(until.elementsLocated(By.className("assignment-container")), 10000);
    for (const mosaicAssignment of assignmentContainer) {
      const assignmenTitle = await mosaicAssignment.findElement(By.className("component-title"));
      let assignmenTitleText = await assignmenTitle.getText();
      if (assignmenTitleText != `${skill} - ${bundle}`) continue;
      const assignmentDataView = await mosaicAssignment.findElement(By.tagName("mosaic-assignment-data-view"));
      const learnerHeader = await assignmentDataView.findElement(By.className("learners-header"));

      try {
        let isAssignmentCompletedCountGreaterThanZero = false;
        await driver.wait(async function () {
          try {
            const completedLearnerCount = await learnerHeader.findElement(By.className("completed-learner-count"));
            let completedLearnerCountText = await completedLearnerCount.getText();
            if (completedLearnerCountText == "0") {
            } else {
              isAssignmentCompletedCountGreaterThanZero = true;
              return true;
            }
          } catch (err) {
            return false;
          }
        }, 50000);
        if (!isAssignmentCompletedCountGreaterThanZero) continue;
        await learnerHeader.click();

        // traverse on learners to check data view for the one who had completed the assignment
        let learnersDetails = await assignmentDataView.findElement(By.className("learners-details"));
        let learnersList = await learnersDetails.findElements(By.tagName("a"));
        for (const learner of learnersList) {
          let learnerStatusContainer = await learner.findElement(By.className("learner-status"));
          let learnerStatusSubContainer = await learnerStatusContainer.findElement(By.tagName("span"));
          let learnerStatus = await learnerStatusSubContainer.findElement(By.tagName("i"));
          let learnerStatusText = await learnerStatus.getText();
          if (learnerStatusText == "Late") continue; // if the user hasnt submitted the assignment
          await driver.wait(until.elementIsVisible(learner), 10000);
          await learner.click();
          try {
            const learnerDetails = await driver.wait(until.elementLocated(By.className("learner-details collapse show")), 10000);
            const loName = await learnerDetails.findElement(By.className("lo-name"));
            let skill = await loName.getText();
            const assignmentData = await learnerDetails.findElements(By.className("mosaic-data-text"));
            let errorInDataViews;
            for (let i = 0; i < assignmentData.length; i++) {
              let data = await assignmentData[i].getText();
              if (skill != "" && data != "") {
                errorInDataViews = false;
              } else {
                errorInDataViews = true;
                break;
              }
            }
            if (!errorInDataViews) {
              return new Promise((res, rej) => {
                res(true);
              });
            } else {
              throw new Error("Data Views UI not loading");
            }
          } catch (err) {
            console.log(err);
          }
        }
        throw new Error("No Assignment found for particular bundle and skill");
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }
    }
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
}

async function checkCreateAssignmentFunctionality(skill, bundle) {
  try {
    const createAssignmentBtnContainer = await driver.wait(until.elementLocated(By.className("create-assignment-btn")), 50000);
    const createAssignmentBtn = await createAssignmentBtnContainer.findElement(By.className("btn"));
    await driver.executeScript("arguments[0].click();", createAssignmentBtn);
    const sidebarListItemContainer = await driver.wait(until.elementLocated(By.className("component-list-wrapper")), 50000);
    const sidebarListItems = await sidebarListItemContainer.findElements(By.tagName("a"));
    let bundleTile;
    for (let i = 0; i < sidebarListItems.length; i++) {
      const titleContainer = await sidebarListItems[i].findElement(By.className("component-name"));
      let title = await titleContainer.getText();
      title = title.trim();
      if (title === bundle) {
        bundleTile = sidebarListItems[i];
        break;
      }
    }
    await bundleTile.click();

    if (areMultipleSkillsPresent) {
      const skillListItemContainer = await driver.wait(until.elementLocated(By.className("component-list-wrapper")), 50000);
      const skillListItems = await skillListItemContainer.findElements(By.tagName("a"));
      // Iterate on skills to check whether req skill is present or not
      for (const skillItem of skillListItems) {
        let skillTile = await skillItem.findElement(By.className("component-name"));
        let skillTileText = await skillTile.getText();
        if (skillTileText == skill) {
          await skillTile.click();
          break;
        }
      }
    }

    try {
      await driver.wait(until.elementLocated(By.className("overlay-loader")), 10000);
      await driver.wait(until.stalenessOf(driver.findElement(By.className("overlay-loader"))), 50000);
      const assignBtn = await driver.findElement(By.className("assign-button"));
      await assignBtn.click();
    } catch (err) {
      try {
        const assignBtn = await driver.findElement(By.className("assign-button"));
        await assignBtn.click();
      } catch (err) {
        console.log(err);
        throw new Error(err);
      }
    }

    console.log(`Creating an Assignment for ${skill} skill.`);

    const activityCountPresetBtn = await driver.wait(until.elementLocated(By.className("activity-count-preset")), 100000);
    await activityCountPresetBtn.click();
    const nextBtn = await driver.wait(until.elementLocated(By.className("next-button")), 100000);

    await nextBtn.click();

    const datePicker = await driver.wait(until.elementLocated(By.className("assignment-details-task-date-date-picker-container")), 100000);
    await datePicker.click();
    const currentDate = await driver.wait(until.elementLocated(By.className("vd-picker__table-day__current")), 100000);
    const currentDateSelector = await currentDate.findElement(By.xpath('./ancestor::button[@class="vd-picker__table-day"]'));
    await currentDateSelector.click();
    const dateSetBtn = await driver.findElement(By.className("vd-picker-validate__button vd-picker-validate__button-validate"));
    await dateSetBtn.click();
    await nextBtn.click();
    const summaryItems = await driver.wait(until.elementsLocated(By.className("assignment-details-task-summary-item-decription")), 100000);
    for (let i = 0; i < summaryItems.length; i++) {
      const summaryItemDescription = await summaryItems[i].findElement(By.className("assignment-details-task-summary-item-decription-heading"));
      let summaryItemHeader = await summaryItemDescription.getText();
      summaryItemHeader = summaryItemHeader.trim();
      if (summaryItemHeader === "Assignment name:") {
        const createdAssignmentNameContainer = summaryItems[i].findElement(By.className("assignment-details-task-summary-item-decription-value"));
        createdAssignmentName = await createdAssignmentNameContainer.getText();
        createdAssignmentName = createdAssignmentName.trim();
        break;
      }
    }

    const assignmentAssignBtn = await driver.wait(until.elementLocated(By.className("task-navigation-button assign-button")), 100000);
    await assignmentAssignBtn.click();
    const exitBtn = await driver.wait(until.elementLocated(By.className("exit-button")), 100000);
    await exitBtn.click();

    const assignmentTitles = await driver.wait(until.elementsLocated(By.className("assignment-title")), 100000);
    let createdAssignment;
    for (let i = 0; i < assignmentTitles.length; i++) {
      let title = await assignmentTitles[i].getText();
      title = title.trim();
      if (title === createdAssignmentName) {
        createdAssignment = assignmentTitles[i];
        break;
      }
    }
    const createdAssignmentDetail = await createdAssignment.findElement(By.xpath('./ancestor::*[contains(@class,"assignment-container")]'));
    const createdAssignmentDropDown = await createdAssignmentDetail.findElement(By.className("assignments-menu dropdown-toggle"));
    await createdAssignmentDropDown.click();
    const dropDownItems = await driver.wait(until.elementsLocated(By.className("dropdown-item")), 100000);
    let deleteOption;
    for (let i = 0; i < dropDownItems.length; i++) {
      let description = await dropDownItems[i].getText();
      description = description.trim();
      if (description === "Delete assignment") {
        deleteOption = dropDownItems[i];
        break;
      }
    }
    console.log("Deleting the created assignment");
    await deleteOption.click();
    await driver.sleep(10000);
    const modal = driver.wait(until.elementLocated(By.id("confirmDeleteAssignmentModal")), 100000);
    const deleteBtn = await modal.findElement(By.className("delete-button"));
    await deleteBtn.click();
    return new Promise((res, rej) => res(true));
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
}

async function goToDashBoard() {
  const homeBtn = await driver.wait(until.elementLocated(By.className("navbar-brand")), 50000);
  await homeBtn.click();
}

async function testMosaicAppTeacherC1Integration() {
  await setGlobalVariables();
  const siteUrl = "https://qa.cambridgeone.org/";
  console.log("Launch Site " + siteUrl);
  await driver.get(siteUrl);
  // Login as a teacher
  try {
    await login();
  } catch (err) {
    result.loginSuccessful = false;
    console.log(err);
    console.log(result);
    throw new Error(err);
  }

  for (const [bundle, bundleData] of Object.entries(config)) {
    // update global flag "areMultipleSkillsPresent" based on no of skills present
    if (Object.keys(bundleData.skills).length > 1) areMultipleSkillsPresent = true;
    else areMultipleSkillsPresent = false;

    let result = createResultObjectForBundle(bundle, bundleData.skills);

    if (JSON.stringify(result) != "{}") {
      console.log(`\nStarting checks for ${bundle}`);
      // Open assignment view for bundle activated class
      try {
        await openAssignmentsScreen(bundle);
      } catch (err) {
        console.log(err);
        console.log(result);
        continue;
      }
    }

    for (const [skill, isEnabled] of Object.entries(bundleData.skills)) {
      if (isEnabled) {
        // Check if teacher assignment data views are loading for all skills of this bundle
        try {
          await checkTeacherAssignmentDataViews(skill, bundle);
          result[skill].teacherAssignmentDataViewsLoading = true;
        } catch (err) {
          result[skill].teacherAssignmentDataViewsLoading = false;
          console.log(err);
          console.log(result);
        }
      }
    }

    for (const [skill, isEnabled] of Object.entries(bundleData.skills)) {
      if (isEnabled) {
        // Check if user is able to create an assignment or not //chala kr dekhni hai listening k liye
        try {
          await checkCreateAssignmentFunctionality(skill, bundle);
          result[skill].createAssignment = true;
        } catch (err) {
          result[skill].createAssignment = false;
          console.log(err);
          console.log(result);
        }
      }
    }

    if (JSON.stringify(result) != "{}") {
      console.log(`${bundle} :`, result);
      configResult[bundle] = result;
      console.log("\n----------------------------------------------------------------------------------");

      // Goto dashboard before checking for next bundle
      try {
        await goToDashBoard();
      } catch (err) {
        console.log(err);
        console.log(result);
      }
    }
  }

  await driver.quit();

  for (const [bundle, bundleData] of Object.entries(configResult))
    for (const [skill, skillData] of Object.entries(bundleData)) {
      for (const [flag, value] of Object.entries(skillData)) {
        if (value == false) throw new Error("Script Failed");
      }
    }

  return;
}
console.log("hey");
testMosaicAppTeacherC1Integration();
