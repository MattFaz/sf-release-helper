const vscode = require("vscode");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

const gooseTestFailures = async () => {
  try {
    vscode.window.showInformationMessage("Starting Salesforce Deployment Failure Analysis...");

    // Let user select SF org
    const orgInfo = await selectSFOrg();

    if (!orgInfo) {
      return; // User cancelled or no orgs available
    }

    vscode.window.showInformationMessage(`Using SF org: ${orgInfo.username} (${orgInfo.alias || orgInfo.orgId})`);

    // Get deployment ID from user
    const deploymentId = await getDeploymentId();

    if (!deploymentId) return;

    // Get deployment failures
    const failures = await getDeploymentFailures(deploymentId, orgInfo);

    if (!failures || failures.length === 0) {
      vscode.window.showInformationMessage("No deployment failures found!");
      return;
    }

    // Send to Goose AI for analysis
    await analyzeWithGoose(failures, deploymentId);
  } catch (error) {
    console.error("Error in gooseTestFailures:", error);
    vscode.window.showErrorMessage(`Error analyzing failures: ${error.message}`);
  }
};

const selectSFOrg = async () => {
  try {
    vscode.window.showInformationMessage("Getting available Salesforce orgs...");

    const { stdout } = await execAsync("sf org list --json");
    const result = JSON.parse(stdout);

    if (result.status !== 0) {
      vscode.window.showErrorMessage("Failed to get org list. Please authenticate with SF CLI first.");
      return null;
    }

    // Combine all org types
    const allOrgs = [
      ...(result.result.nonScratchOrgs || []),
      ...(result.result.scratchOrgs || []),
      ...(result.result.devHubs || []),
    ];

    if (allOrgs.length === 0) {
      vscode.window.showErrorMessage("No authenticated Salesforce orgs found. Please run 'sf org login web' first.");
      return null;
    }

    // Create picker items
    const orgItems = allOrgs.map((org) => ({
      label: org.alias || org.username,
      description: org.username,
      detail: `${org.orgId} - ${org.instanceUrl} (${org.connectedStatus})`,
      org: org,
    }));

    // Sort by alias/username and put default org first if exists
    orgItems.sort((a, b) => {
      if (a.org.isDefaultUsername && !b.org.isDefaultUsername) return -1;
      if (!a.org.isDefaultUsername && b.org.isDefaultUsername) return 1;
      return a.label.localeCompare(b.label);
    });

    const selectedItem = await vscode.window.showQuickPick(orgItems, {
      placeHolder: "Select Salesforce org for deployment analysis",
      matchOnDescription: true,
      matchOnDetail: true,
    });

    return selectedItem ? selectedItem.org : null;
  } catch (error) {
    console.error("Error getting SF org list:", error);
    vscode.window.showErrorMessage(`Failed to get Salesforce orgs: ${error.message}`);
    return null;
  }
};

const getDeploymentId = async () => {
  const deploymentId = await vscode.window.showInputBox({
    prompt: "Enter Salesforce Deployment ID",
    placeHolder: "0Af1234567890123456",
    validateInput: (input) => {
      if (!input) return "Deployment ID is required";
      if (!/^0Af[a-zA-Z0-9]{15}$/.test(input)) {
        return "Invalid Deployment ID format (should start with 0Af followed by 15 characters)";
      }
    },
  });

  return deploymentId;
};

const getDeploymentFailures = async (deploymentId, orgInfo) => {
  try {
    vscode.window.showInformationMessage(`SFRH: Fetching deployment results for ${deploymentId}...`);

    // Use the target org if available
    const targetOrgFlag = orgInfo.alias ? `--target-org ${orgInfo.alias}` : "";
    const command = `sf project deploy report --job-id ${deploymentId} ${targetOrgFlag} --json`;

    const { stdout } = await execAsync(command);
    const result = JSON.parse(stdout);

    if (result.status !== 0) {
      throw new Error(`SF CLI error: ${result.message || result.name || "Unknown error"}`);
    }

    const deploymentResult = result.result;

    if (!deploymentResult.done) {
      vscode.window.showWarningMessage("Deployment is still in progress. Results may be incomplete.");
    }

    return extractSalesforceFailures(deploymentResult);
  } catch (error) {
    throw new Error(`Failed to get deployment results: ${error.message}`);
  }
};

const extractSalesforceFailures = (deploymentResult) => {
  const failures = [];

  // Extract component failures
  if (deploymentResult.details && deploymentResult.details.componentFailures) {
    deploymentResult.details.componentFailures.forEach((failure) => {
      failures.push({
        type: "Component Failure",
        component: failure.fullName,
        componentType: failure.type,
        fileName: failure.fileName,
        lineNumber: failure.lineNumber,
        columnNumber: failure.columnNumber,
        error: failure.error || failure.problem,
        problemType: failure.problemType,
        success: failure.success,
      });
    });
  }

  // Extract test failures
  if (
    deploymentResult.details &&
    deploymentResult.details.runTestResult &&
    deploymentResult.details.runTestResult.failures
  ) {
    deploymentResult.details.runTestResult.failures.forEach((testFailure) => {
      failures.push({
        type: "Test Failure",
        component: testFailure.name,
        componentType: testFailure.type || "Test",
        testMethod: testFailure.methodName,
        fileName: `${testFailure.name.replace(".", "/")}.cls`,
        error: testFailure.message,
        stackTrace: testFailure.stackTrace,
        executionTime: testFailure.time,
      });
    });
  }

  // Add deployment summary info
  if (failures.length > 0) {
    failures.unshift({
      type: "Deployment Summary",
      deploymentId: deploymentResult.id,
      status: deploymentResult.status,
      success: deploymentResult.success,
      startTime: deploymentResult.createdDate,
      endTime: deploymentResult.completedDate,
      totalComponents: deploymentResult.numberComponentsTotal || 0,
      failedComponents: deploymentResult.numberComponentErrors || 0,
      testFailures:
        deploymentResult.details && deploymentResult.details.runTestResult
          ? deploymentResult.details.runTestResult.failures.length
          : 0,
    });
  }

  return failures;
};

const analyzeWithGoose = async (failures, deploymentId) => {
  // Declare variables at function scope
  let gooseCommand = "";
  let workspaceRoot = "";
  let contextFile = "";

  try {
    vscode.window.showInformationMessage("Sending deployment failures to Goose AI for analysis...");

    // Format failures for Goose analysis
    const context = formatFailuresForGoose(failures, deploymentId);

    // Create analysis file in project .sfrh directory
    const fs = require("fs");
    const path = require("path");

    workspaceRoot =
      (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders[0] &&
        vscode.workspace.workspaceFolders[0].uri.fsPath) ||
      process.cwd();
    const sfrhDir = path.join(workspaceRoot, ".sfrh");

    // Ensure .sfrh directory exists
    if (!fs.existsSync(sfrhDir)) {
      fs.mkdirSync(sfrhDir, { recursive: true });
    }

    contextFile = path.join(sfrhDir, `${deploymentId}.md`);

    fs.writeFileSync(contextFile, context);

    // Run Goose AI analysis
    gooseCommand = `goose run --instructions "${contextFile}"`;

    vscode.window.showInformationMessage("Starting Goose AI analysis for deployment failures...");
    vscode.window.showInformationMessage(`Analysis context saved to: ${contextFile}`);

    // Show the command being executed
    const commandChannel = vscode.window.createOutputChannel("Goose Command Execution");
    commandChannel.clear();
    commandChannel.appendLine("=== Executing Goose AI Command ===\n");
    commandChannel.appendLine(`Working Directory: ${workspaceRoot}`);
    commandChannel.appendLine(`Command: ${gooseCommand}`);
    commandChannel.appendLine(`Context File: ${contextFile}`);
    commandChannel.appendLine("\n=== Command Output ===\n");
    commandChannel.show();

    // Execute Goose command
    const { stdout, stderr } = await execAsync(gooseCommand, {
      cwd: workspaceRoot,
      timeout: 120000, // 2 minute timeout
    });

    // Save raw results to log file
    const logFile = path.join(sfrhDir, "goose-session.log");
    const rawLog = `# Goose AI Session Log\n\n**Deployment ID:** ${deploymentId}\n**Analysis Date:** ${new Date().toISOString()}\n**Context File:** ${contextFile}\n\n## Raw Session Output\n\n${stdout}\n\n${
      stderr ? `## Stderr\n\n${stderr}` : ""
    }`;

    fs.writeFileSync(logFile, rawLog);

    // Check if Goose created the analysis file
    const analysisFile = path.join(sfrhDir, `${deploymentId}.md`);

    // Show results in output panel
    const outputChannel = vscode.window.createOutputChannel("Goose AI Analysis");
    outputChannel.clear();
    outputChannel.appendLine("=== SFRH: Salesforce Deployment Analysis ===\n");
    outputChannel.appendLine(`Context File: ${contextFile}`);
    outputChannel.appendLine(`Analysis File: ${analysisFile}`);
    outputChannel.appendLine(`Log File: ${logFile}\n`);
    outputChannel.appendLine(stdout);
    if (stderr) {
      outputChannel.appendLine("\n=== Stderr ===\n");
      outputChannel.appendLine(stderr);
    }
    outputChannel.show();

    vscode.window.showInformationMessage(`Goose AI analysis completed! Check ${analysisFile} for clean analysis.`);
  } catch (error) {
    console.error("Error running Goose analysis:", error);

    // Show detailed error information
    const errorChannel = vscode.window.createOutputChannel("Goose AI Error Details");
    errorChannel.clear();
    errorChannel.appendLine("=== Goose AI Command Error ===\n");
    errorChannel.appendLine(`Command: ${gooseCommand}`);
    errorChannel.appendLine(`Working Directory: ${workspaceRoot}`);
    errorChannel.appendLine(`Context File: ${contextFile}`);
    errorChannel.appendLine(`\nError Details:`);
    errorChannel.appendLine(error.message);
    if (error.stdout) {
      errorChannel.appendLine(`\nStdout:\n${error.stdout}`);
    }
    if (error.stderr) {
      errorChannel.appendLine(`\nStderr:\n${error.stderr}`);
    }
    errorChannel.show();

    vscode.window.showErrorMessage(`Goose AI analysis failed. Check the error details in the output panel.`);
  }
};

const formatFailuresForGoose = (failures, deploymentId) => {
  let context = ``;

  failures.forEach((failure, index) => {
    if (failure.type === "Component Failure") {
      context += `### Failure ${index}: Component Error
**Component:** ${failure.component}  
**Type:** ${failure.componentType}  
**File:** force-app/main/default/${failure.fileName}  
**Location:** Line ${failure.lineNumber}${failure.columnNumber ? `, Column ${failure.columnNumber}` : ""}  
**Problem Type:** ${failure.problemType || "Unknown"}  
**Error Message:**
\`\`\`
${failure.error}
\`\`\`
---

`;
    } else if (failure.type === "Test Failure") {
      context += `### Failure ${index}: Test Failure
**Test Class:** ${failure.component}  
**Test Method:** ${failure.testMethod}  
**File:** ${failure.fileName}  
**Execution Time:** ${failure.executionTime}ms  
**Error Message:**
\`\`\`
${failure.error}
\`\`\`

**Stack Trace:**
\`\`\`
${failure.stackTrace}
\`\`\`

---
`;
    }
  });

  context += `
Please Read the below deployment failures and perform the following for each failure:
1. Identify root cause of the failure
2. Automatically fix the failure if possible
3. If it cannot be automatically fixed, provide a manual fix
4. Update the .sfrh/${deploymentId}.md file to document the root cause and the fix

IMPORTANT: 
- You have full access to read and modify files in this Salesforce project
- Update the .sfrh/${deploymentId}.md file as you work to show progress
- End your final update with "*Analysis completed by Goose AI*" so the system knows you're done
`;

  return context;
};

module.exports = gooseTestFailures;

// Export individual functions for reuse by Claude Code integration
module.exports.selectSFOrg = selectSFOrg;
module.exports.getDeploymentId = getDeploymentId;
module.exports.getDeploymentFailures = getDeploymentFailures;
module.exports.extractSalesforceFailures = extractSalesforceFailures;
