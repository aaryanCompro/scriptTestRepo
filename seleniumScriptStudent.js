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

function isNewRelicEnvironment() {
  return typeof $webDriver !== "undefined" && typeof $selenium !== "undefined";
}
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
    loginUsername = secrets["student-username"];
    loginPassword = secrets["student-password"];
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

async function setUpVariables() {
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

async function recommendationsPresent(skill, result) {
  const recommendationsContainer = await driver.wait(until.elementLocated(By.className("activities")), 10000);
  const recommendations = await recommendationsContainer.findElements(By.tagName("article"));
  if (recommendations.length > 0) {
    console.log("Recommendations found for " + skill + " skill");
    result[`${skill}`].recommendationsLoading = true;
    const c1BackButton = await driver.wait(until.elementLocated(By.className("c1-back-button")), 10000);
    await c1BackButton.click();
    return new Promise((res, rej) => res(true));
  } else {
    return new Promise((res, rej) => rej("Empty recommendations section"));
  }
}

async function areRecommendationsLoading(skill, result) {
  try {
    const activityHeader = await driver.wait(until.elementLocated(By.className("activity-header")), 50000);
    const activityHeaderText = await activityHeader.getText();
    if (activityHeaderText === "Recommended for you") {
      let areRecommendationsPresent = await recommendationsPresent(skill, result);
      if (areRecommendationsPresent === true) {
        return new Promise((res, rej) => res(true));
      } else {
        return new Promise((res, rej) => rej(areRecommendationsPresent));
      }
    } else if (activityHeaderText === "Continue") {
      console.log("Activity is in continue state ... completeing the activity");
      const recommendationsContainer = await driver.wait(until.elementLocated(By.className("activities")), 10000);
      const inProgressActivity = await recommendationsContainer.findElement(By.tagName("article"));
      await inProgressActivity.click();
      const activityButtonContainer = await driver.wait(until.elementLocated(By.className("activity-button-container")), 20000);
      const continueButton = await activityButtonContainer.findElement(By.className("custom-btn-purple"));
      await continueButton.click();
      if (skill === "Reading") {
        let iframe = await driver.wait(until.elementLocated(By.css("iframe")), 10000);

        await driver.switchTo().frame(iframe);
        let startButton = await driver.wait(until.elementLocated(By.xpath(`//button[text()='Start']`)), 10000);
        await startButton.click();
        let chooseAnswerButton = await driver.wait(until.elementLocated(By.xpath(`//button[text()='Choose answer']`)), 10000);
        await driver.wait(until.elementIsVisible(chooseAnswerButton), 10000);
        await driver.wait(until.elementIsEnabled(chooseAnswerButton), 10000);
        await driver.executeScript("arguments[0].click();", chooseAnswerButton);
        let fieldSetElement = await driver.wait(until.elementLocated(By.tagName("fieldset")), 10000);
        let option = await fieldSetElement.findElement(By.tagName("div"));
        let clickableOption = await option.findElement(By.tagName("div"));
        await clickableOption.click();
        let checkAnswer = await driver.wait(until.elementLocated(By.xpath(`//button[text()='Check answer']`)), 10000);
        await driver.wait(until.elementIsVisible(checkAnswer), 10000);
        await driver.wait(until.elementIsEnabled(checkAnswer), 10000);
        await checkAnswer.click();
        let chooseAnActivityButton = await driver.wait(until.elementLocated(By.xpath(`//button[text()='Choose an activity']`)), 10000);
        await driver.wait(until.elementIsVisible(chooseAnActivityButton), 10000);
        await driver.wait(until.elementIsEnabled(chooseAnActivityButton), 10000);
        await chooseAnActivityButton.click();
        await driver.switchTo().defaultContent();
        let areRecommendationsPresent = await areRecommendationsLoading(skill, result);
        if (areRecommendationsPresent === true) {
          return new Promise((res, rej) => res(true));
        } else {
          return new Promise((res, rej) => rej(areRecommendationsPresent));
        }
      } else if (skill === "Listening") {
        let iframe = await driver.wait(until.elementLocated(By.css("iframe")), 10000);
        await driver.switchTo().frame(iframe);
        let startButton = await driver.wait(until.elementLocated(By.xpath(`//button[text()='Start']`)), 10000);
        await startButton.click();
        const playAudioButton = await driver.wait(until.elementLocated(By.xpath("//*[@aria-label='audio play button']")));
        await playAudioButton.click();
        let fieldSetElement = await driver.wait(until.elementLocated(By.tagName("fieldset")), 10000);
        let optionContainer = await driver.wait(async function () {
          let elements = await fieldSetElement.findElements(By.tagName("div"));
          return elements.length > 0 ? elements[0] : false;
        }, 120000);
        let option = await optionContainer.findElement(By.tagName("div"));

        let clickableOption = await option.findElement(By.tagName("div"));
        await driver.wait(until.elementIsVisible(clickableOption), 10000);
        await driver.wait(until.elementIsEnabled(clickableOption), 10000);
        await driver.executeScript("arguments[0].click();", clickableOption);
        let submitAnswer = await driver.wait(until.elementLocated(By.xpath(`//button[text()='Submit answer']`)), 10000);
        await driver.wait(until.elementIsVisible(submitAnswer), 10000);
        await driver.wait(until.elementIsEnabled(submitAnswer), 10000);
        await submitAnswer.click();
        let chooseAnActivityButton = await driver.wait(until.elementLocated(By.xpath(`//button[text()='Choose an activity']`)), 10000);
        await driver.wait(until.elementIsVisible(chooseAnActivityButton), 10000);
        await driver.wait(until.elementIsEnabled(chooseAnActivityButton), 10000);
        await driver.executeScript("arguments[0].click();", chooseAnActivityButton);
        await driver.switchTo().defaultContent();
        let areRecommendationsPresent = await areRecommendationsLoading(skill, result);
        if (areRecommendationsPresent) {
          return new Promise((res, rej) => res(true));
        } else {
          return new Promise((res, rej) => rej(areRecommendationsPresent));
        }
      }
    }
  } catch (err) {
    try {
      console.log(err);
      await driver.wait(until.elementLocated(By.className("congratulations-section")), 50000);
      if (skill === "Reading") {
        result.result = true;
      } else if (skill === "Listening") {
        result.listeningRecommendationsLoading = true;
      }
      const c1BackButton = await driver.wait(until.elementLocated(By.className("c1-back-button")), 10000);
      await c1BackButton.click();
      return new Promise((res, rej) => res(true));
    } catch (err) {
      console.log(err);
      console.log("Reccomendations not loading for" + skill + " skill");
      result[`${skill}`].recommendationsLoading = false;
      return new Promise((res, rej) => rej(err));
    }
  }
}

async function checkForRecommendations(skill, selectors, result) {
  try {
    let classUUIDWithBundleCode = `${classId}-${selectors.bundleCardToggleButtonIdReplacer}`;
    const materialContainerId = "bundleCollapse-" + classUUIDWithBundleCode;
    let materialContainer = await driver.wait(until.elementLocated(By.id(materialContainerId)), 50000);
    let materialTiles = await materialContainer.findElements(By.className("umbrella-tile"));
    for (let i = 0; i < materialTiles.length; i++) {
      let anchorElement = await materialTiles[i].findElement(By.tagName("a"));
      let titleElement;
      try {
        titleElement = await anchorElement.findElement(By.className("my-progress"));
      } catch (err) {
        continue;
      }
      let title = await titleElement.getText();
      if (title === skill) {
        console.log("Opening mosaic app to check recommendations for " + skill + " skill");
        await driver.executeScript("arguments[0].click();", anchorElement);
        break;
      }
    }
    const isRecommendationsLoading = await areRecommendationsLoading(skill, result);
    if (isRecommendationsLoading === true) {
      return new Promise((res, rej) => res(true));
    } else {
      return new Promise((res, rej) => rej(isRecommendationsLoading));
    }
  } catch (err) {
    console.log(err);
    return new Promise((res, rej) => rej(err));
  }
}

async function checkDataViews(mosaicComponent, skills, result) {
  try {
    await driver.wait(async function () {
      try {
        const allDataViews = await mosaicComponent.findElements(By.className("analytic-value"));
        let spanElement = allDataViews[0];
        let text = await spanElement.getText();

        return text != "";
      } catch (err) {
        // sometimes the value loads just after the span element which is null initially
        // so when we check its text, the value of the span element changes because
        //  it is now loaded so we get stale element error in this case so to handle this we once again check the span element which now has some value instead of null
        if (err.name === "StaleElementReferenceError") {
          return false;
        } else {
          throw new Error(err);
        }
      }
    }, 50000);

    const skillTiles = await mosaicComponent.findElements(By.className("progress-info"));
    for (let i = 0; i < skillTiles.length; i++) {
      const skill = await skillTiles[i].findElement(By.className("product-title"));
      let skillText = await skill.getText();
      skillText = skillText.trim();
      if (!skills[skillText]) continue;
      console.log("Checking class data views for " + skillText);
      console.log(skillText);
      const allDataViews = await skillTiles[i].findElements(By.className("analytic-value"));
      for (let i = 0; i < allDataViews.length; i++) {
        let analyticValue = await allDataViews[i].getText();
        if (!analyticValue) {
          result[skillText].classDataViewsLoading = false;
          break;
        } else {
          result[skillText].classDataViewsLoading = true;
        }
      }
    }
    let allDataViewsLoading = true;
    for (const skill in skills) {
      if (skills[skill]) {
        if (result[skill].classDataViewsLoading == false) allDataViewsLoading = false;
      }
    }
    if (allDataViewsLoading) {
      return new Promise((res, rej) => res(true));
    } else {
      return new Promise((res, rej) => rej("Error in loading data views"));
    }
  } catch (err) {
    if (result[skillText].classDataViewsLoading === null) {
      result[skillText].classDataViewsLoading = false;
    }
    console.log(err);
    return new Promise((res, rej) => rej(err));
  }
}
async function checkLearnerDataViews(mosaicComponent, skills, result) {
  try {
    await driver.wait(async function () {
      try {
        const allDataViews = await mosaicComponent.findElements(By.className("analytic-result"));
        let spanElement = allDataViews[0];
        let text = await spanElement.getText();

        return text != "";
      } catch (err) {
        // sometimes the value loads just after the span element which is null initially
        // so when we check its text, the value of the span element changes because
        //  it is now loaded so we get stale element error in this case so to handle this we once again check the span element which now has some value instead of null
        if (err.name === "StaleElementReferenceError") {
          return false;
        } else {
          throw new Error(err);
        }
      }
    }, 20000);
    const skillTiles = await mosaicComponent.findElements(By.className("component-wrapper"));
    for (let i = 0; i < skillTiles.length; i++) {
      const skill = await skillTiles[i].findElement(By.className("component-title"));
      let skillText = await skill.getText();
      skillText = skillText.trim();
      if (!skills[skillText]) continue;
      console.log("Checking learner data views for " + skillText);
      const allDataViews = await skillTiles[i].findElements(By.className("analytic-result"));
      for (let i = 0; i < allDataViews.length; i++) {
        let text = await allDataViews[i].getText();
        if (!text) {
          result[skillText].learnerDataViewsLoading = false;
          break;
        } else {
          result[skillText].learnerDataViewsLoading = true;
        }
      }

      if (!result[skillText].learnerDataViewsLoading) {
        return new Promise((res, rej) => rej(`${skillText} data views content not loading`));
      }

      let completedActivityCount = await allDataViews[0].getText();
      completedActivityCount = +completedActivityCount;
      if (completedActivityCount > 0) {
        const openActivityListBtn = await skillTiles[i].findElement(By.className("toggable-btn"));
        await openActivityListBtn.click();
        await driver.wait(until.elementLocated(By.className("component-content collapse show")));
        const activityData = await driver.findElement(By.className("component-content-activity-container"));

        let activityTitle = await activityData.findElement(By.className("component-content-activity-container-activity-data-title"));
        activityTitle = await activityTitle.getText();
        let activityStatus = await activityData.findElement(By.className("component-content-activity-container-activity-data-status"));
        activityStatus = await activityStatus.getText();
        let activityDate = await activityData.findElement(By.className("component-content-activity-container-activity-data-date"));
        activityDate = await activityDate.getText();
        if (activityTitle && activityStatus && activityDate) {
          result[skillText].learnerDataViewActivitiesPresent = true;
        } else {
          result[skillText].learnerDataViewActivitiesPresent = false;
        }
      } else {
        result[skillText].learnerDataViewActivitiesPresent = false;
      }
    }
    return new Promise((res, rej) => res(true));
  } catch (err) {
    console.log(err);
    return new Promise((res, rej) => rej(err));
  }
}
async function checkCefrThumb() {
  const cefrReportContainer = await driver.wait(until.elementLocated(By.className("cefr-plot-container")), 10000);
  let cefrThumbWebElement = await driver.wait(async function () {
    try {
      const cefrReportThumb = await cefrReportContainer.findElement(By.xpath('./div[contains(@class,"thumb")]'));
      if (cefrReportThumb) {
        return cefrReportThumb;
      }
    } catch (err) {
      return undefined;
    }
  }, 50000);
  if (cefrThumbWebElement != undefined) {
    return new Promise((res, rej) => res(true));
  } else {
    return new Promise((res, rej) => rej(false));
  }
}
async function checkCefrReport(skill, result) {
  try {
    console.log("Checking CEFR Report");
    driver.executeScript("window.scrollTo(0, 0);");

    const mosaicComponent = await driver.wait(until.elementLocated(By.tagName("mosaic-learner-view-component")), 10000);
    const skillSections = await mosaicComponent.findElements(By.className("component-wrapper"));
    for (let j = 0; j < skillSections.length; j++) {
      const componentTitle = await skillSections[j].findElement(By.className("component-title"));
      const skillText = await componentTitle.getText();
      if (skillText != skill) continue;
      console.log(skillText);

      const analyticResults = await skillSections[j].findElements(By.className("analytic-result"));
      let cefrReportElement;
      for (let i = 0; i < analyticResults.length; i++) {
        let analyticValue = await analyticResults[i].getText();
        analyticValue = analyticValue.trim();
        if (analyticValue === "Report available") {
          cefrReportElement = analyticResults[i];
          break;
        }
      }
      await cefrReportElement.click();
      await driver.wait(until.elementLocated(By.className("overlay-loader")), 10000);
      await driver.wait(until.stalenessOf(driver.findElement(By.className("overlay-loader"))), 5000);
      const isCefrThumbPresent = await checkCefrThumb();
      if (isCefrThumbPresent) {
        result[skill].cefrReportLoading = true;
        return new Promise((res, rej) => res(true));
      } else {
        result[skill].cefrReportLoading = false;
        return new Promise((res, rej) => rej("CEFR thumb not loading"));
      }
    }
  } catch (err) {
    // sometimes the overlay loader appears and instantly dissapears due to which its presence is not detected by the webdriver and timeout error is thrown . In this case we need to check for the cefr plotter again.
    if (err.name === "TimeoutError") {
      const isCefrThumbPresent = await checkCefrThumb();
      if (isCefrThumbPresent) {
        result[skill].cefrReportLoading = true;
        return new Promise((res, rej) => res(true));
      } else {
        result[skill].cefrReportLoading = false;
        return new Promise((res, rej) => rej("CEFR thumb not loading"));
      }
    } else {
      result[skill].cefrReportLoading = false;
      return new Promise((res, rej) => rej(err));
    }
  }
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
    let username = isNewRelicEnvironment() ? $secure.STUDENT_USERNAME : loginUsername;
    let password = isNewRelicEnvironment() ? $secure.STUDENT_PASSWORD : loginPassword;
    await loginbtn.click();
    const gigyaLoginForm = await driver.wait(until.elementLocated(By.id("gigya-login-form")), 100000);
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

async function redirectLearnerProgressPage() {
  let backbtn = await driver.wait(until.elementLocated(By.className("back-button")), 50000);
  await backbtn.click();
}

async function checkForClassesWithBundleActivated(bundle, selectors) {
  try {
    console.log("Checking for classes");
    const allBundleTitles = await driver.wait(until.elementsLocated(By.className("bundle-title")), 20000);
    console.log("Classes found");
    console.log(`Checking for ${bundle} activated classes`);
    let bundleTitle;
    for (let i = 0; i < allBundleTitles.length; i++) {
      const elementText = await allBundleTitles[i].getText();
      if (elementText === bundle) {
        bundleTitle = allBundleTitles[i];
        break;
      }
    }
    if (bundleTitle) {
      const toggleButton = await bundleTitle.findElement(By.xpath('./ancestor::a[contains(@class,"toggle-btn")]'));
      const toggleButtonId = await toggleButton.getAttribute("id");
      let classUUID = toggleButtonId.replace("bundle-card-toggle-btn-", "");
      classUUID = classUUID.replace(`-${selectors.bundleCardToggleButtonIdReplacer}`, "");
      classId = classUUID;
      console.log(`Class id of the first class with ${bundle} umbrella activated is ${classUUID}`);
      return new Promise((res, rej) => {
        res(true);
      });
    } else {
      return new Promise((res, rej) => {
        rej("No class with rl-25 activated found");
      });
    }
  } catch (err) {
    return new Promise((res, rej) => {
      rej(err);
    });
  }
}

async function checkLearnerAssignmentDataViews(skill, bundle) {
  try {
    console.log(`Checking learner assignment data views for ${bundle} with ${skill} skill.`);
    const allCompletedAssignments = await driver.wait(until.elementsLocated(By.css(".completed-assignments-detail  .assignments-content")), 10000);
    let bundleCompletedAssignment;
    for (let i = 0; i < allCompletedAssignments.length; i++) {
      let assignmentTitle = await allCompletedAssignments[i].findElement(By.className("assignment-detail component-title"));
      assignmentTitle = await assignmentTitle.getText();
      assignmentTitle = assignmentTitle.trim();
      if (assignmentTitle === `${skill} - ${bundle}`) {
        bundleCompletedAssignment = allCompletedAssignments[i];
        break;
      }
    }
    if (!bundleCompletedAssignment) {
      return new Promise((res, rej) => rej(`No ${bundle} with ${skill} skill completed assignment found`));
    }
    return new Promise((res, rej) => {
      res(true);
    });
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
}

async function goToDashBoard() {
  const homeBtn = await driver.wait(until.elementLocated(By.className("navbar-brand")), 50000);
  await homeBtn.click();
}

async function testMosaicAppStudentC1Integration() {
  const startTime = performance.now();
  await setUpVariables();
  const siteUrl = "https://qa.cambridgeone.org/";
  console.log("Launch Site " + siteUrl);
  await driver.get(siteUrl);
  // Login as a student
  try {
    await login();
    loginSuccessful = true;
  } catch (err) {
    loginSuccessful = false;
    console.log(err);
    console.log(result);
  }

  for (const [bundle, bundleData] of Object.entries(config)) {
    let result = createResultObjectForBundle(bundle, bundleData.skills);

    if (JSON.stringify(result) != "{}") {
      console.log(`\nStarting checks for ${bundle}`);

      // Check for bundle activated classes
      try {
        await checkForClassesWithBundleActivated(bundle, bundleData.selectors);
        result.bundleActivatedClassPresent = true;
      } catch (err) {
        result.bundleActivatedClassPresent = false;
        console.log(err);
        console.log(result);
      }
    }

    for (const [skill, isEnabled] of Object.entries(bundleData.skills)) {
      if (isEnabled) {
        // Check if recommendations are loading
        try {
          console.log("Checking Recommendations");
          await checkForRecommendations(skill, bundleData.selectors, result);
        } catch (err) {
          console.log(result);
          console.log(err);
        }
      }
    }
    if (JSON.stringify(result) != "{}") {
      // Open My Progress view and check class data views
      try {
        const myProgressBtnId = `agg-button-${classId}`;
        const myProgressBtn = await driver.wait(until.elementLocated(By.id(myProgressBtnId)), 50000);
        console.log("Clicking my progress button");
        await myProgressBtn.click();
        const mosaicComponent = await driver.wait(until.elementLocated(By.tagName("mosaic-class-view-component")), 50000);
        console.log("Checking Class Data Views");
        await checkDataViews(mosaicComponent, bundleData.skills, result);
        console.log("Opening Learner Data Views");
        const classDataBundleDetailElement = await mosaicComponent.findElement(By.xpath('./ancestor::div[@class="class-data-bundle-detail"]'));
        await classDataBundleDetailElement.findElement(By.className("bundle-card-container")).click();
      } catch (err) {
        console.log(err);
        console.log(result);
      }

      // Check if learner data views are loading
      try {
        const mosaicComponent = await driver.wait(until.elementLocated(By.tagName("mosaic-learner-view-component")), 50000);
        console.log("Checking Learner Data Views");
        await checkLearnerDataViews(mosaicComponent, bundleData.skills, result);
      } catch (err) {
        console.log(err);
        console.log(result);
      }
    }

    for (const [skill, isEnabled] of Object.entries(bundleData.skills)) {
      if (isEnabled) {
        try {
          await checkCefrReport(skill, result);
        } catch (err) {
          console.log(err);
          console.log(result);
        }

        await redirectLearnerProgressPage();
      }
    }

    for (const [skill, isEnabled] of Object.entries(bundleData.skills)) {
      if (isEnabled) {
        // Go back to dashboard view
        await goToDashBoard();

        // Open assignment view and check learner assignment data views
        try {
          const myProgressBtn = await driver.wait(until.elementLocated(By.id(`agg-button-${classId}`)), 100000);
          const myProgressBtnContainer = await await driver.executeScript("return arguments[0].parentNode;", myProgressBtn);
          const myAssignmentsBtn = await myProgressBtnContainer.findElement(By.className("homework-button"));
          await myAssignmentsBtn.click();
          await checkLearnerAssignmentDataViews(skill, bundle);
          result[skill].learnerAssignmentDataViewsLoading = true;
        } catch (err) {
          result[skill].learnerAssignmentDataViewsLoading = false;
          console.log(err);
          console.log(result);
        }
      }
    }

    console.log(`${bundle} :`, result);
    configResult[bundle] = result;
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

testMosaicAppStudentC1Integration();
