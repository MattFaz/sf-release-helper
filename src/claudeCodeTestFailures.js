// claudeCodeTestFailures.js
const vscode = require("vscode");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const path = require("path");

const execAsync = promisify(exec);

/**
 * Main entry point for Claude Code test failure analysis
 */
const claudeCodeTestFailures = async () => {
  try {
    vscode.window.showInformationMessage("SFRH: Starting Deployment Failure Analysis...");

    // Check if Claude Code CLI is available
    const isClaudeAvailable = await checkClaudeCodeCLI();
    if (!isClaudeAvailable) {
      return;
    }

    // Reuse existing functions from gooseTestFailures.js
    const { selectSFOrg, getDeploymentId, getDeploymentFailures } = require("./gooseTestFailures");

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
      vscode.window.showInformationMessage("SFRH: No deployment failures found!");
      return;
    }

    // Analyze with Claude Code
    await analyzeWithClaudeCode(failures, deploymentId);
  } catch (error) {
    console.error("Error in claudeCodeTestFailures:", error);
    vscode.window.showErrorMessage(`Error analyzing failures: ${error.message}`);
  }
};

/**
 * Check if Claude Code CLI is installed and accessible
 */
const checkClaudeCodeCLI = async () => {
  try {
    const { stdout } = await execAsync("claude --version", {
      env: {
        ...process.env,
        // Neutralize integration for probe as well
        ENABLE_IDE_INTEGRATION: "",
        CLAUDE_CODE_SSE_PORT: "",
      },
    });
    console.log("Claude Code CLI found:", stdout.trim());
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(
      "Claude Code CLI not found. Please ensure Claude Code is installed and the 'claude' command is available in your PATH."
    );

    // Offer to open installation instructions
    const openDocs = await vscode.window.showInformationMessage(
      "Would you like to open the Claude Code installation guide?",
      "Open Guide"
    );

    if (openDocs === "Open Guide") {
      vscode.env.openExternal(vscode.Uri.parse("https://docs.anthropic.com/en/docs/claude-code/quickstart"));
    }

    return false;
  }
};

/**
 * Analyze failures using Claude Code CLI (using terminal)
 */
const analyzeWithClaudeCode = async (failures, deploymentId) => {
  let workspaceRoot = "";
  let instructionFile = "";
  const modelArg = "sonnet"; // adjust if needed

  const outputChannel = vscode.window.createOutputChannel("Claude Code Analysis");

  try {
    vscode.window.showInformationMessage("SFRH: Sending deployment failures for analysis...");

    // Get workspace root
    workspaceRoot =
      (vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders[0] &&
        vscode.workspace.workspaceFolders[0].uri.fsPath) ||
      process.cwd();

    const sfrhDir = path.join(workspaceRoot, ".sfrh");

    // Ensure .sfrh directory exists
    await fs.mkdir(sfrhDir, { recursive: true });

    // Create initial deployment file with context
    const initialContent = `# Salesforce Deployment Analysis - Deployment ID: ${deploymentId}

## Deployment Failures

${formatFailuresForClaudeCode(failures, deploymentId)}

---

*This file will be updated with analysis and fixes as they are applied...*
`;

    const deploymentFile = path.join(sfrhDir, `${deploymentId}.md`);
    await fs.writeFile(deploymentFile, initialContent, "utf8");

    // Format instructions for Claude Code (no file needed)
    const instructions = `I have created a deployment analysis file at .sfrh/${deploymentId}.md with the deployment failure details.

Please complete the following tasks and update the .sfrh/${deploymentId}.md file progressively:

1. **Initial Analysis**: Read the deployment file and add your analysis of each failure:
   - Root cause analysis for each failure
   - Assessment of which issues can be automatically fixed

2. **Apply Automated Fixes**: For each failure that can be automatically fixed:
   - Read the failing source file
   - Apply the necessary code changes
   - Update .sfrh/${deploymentId}.md to document what was changed

3. **Final Summary**: Complete the .sfrh/${deploymentId}.md file with:
   - Summary of fixes applied
   - List of any issues requiring manual intervention
   - Add "*Analysis completed by Claude Code*" at the end to indicate completion

IMPORTANT: 
- You have full access to read and modify files in this Salesforce project
- Update the .sfrh/${deploymentId}.md file as you work to show progress
- Only make code changes you are confident are correct
- End your final update with "*Analysis completed by Claude Code*" so the system knows you're done

Please start by reading the deployment file and adding your initial analysis.`;

    // Define output files that Claude will create
    const errorFile = path.join(sfrhDir, "claude-error.log");

    // Create a temporary instruction file to avoid shell escaping issues
    instructionFile = path.join(sfrhDir, "claude-instructions.txt");
    await fs.writeFile(instructionFile, instructions, "utf8");

    // Build command to run in terminal (use instruction file)
    const shellCommand = `claude --model ${modelArg} -p "${instructionFile}" 2> "${errorFile}"`;

    vscode.window.showInformationMessage("SFRH: Starting analysis & automated fixes...");

    // Create a terminal to run claude
    const terminal = vscode.window.createTerminal({
      name: "Claude Code Analysis",
      cwd: workspaceRoot,
      env: process.env,
    });

    // Show the terminal so user can see progress
    terminal.show();

    // Send the command
    terminal.sendText(shellCommand);

    // Create a status bar item to show progress
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(sync~spin) SFRH: Analyzing & fixing...";
    statusBarItem.tooltip = `SFRH: Analyzing deployment & applying fixes`;
    statusBarItem.show();

    // Monitor for completion
    let checkCount = 0;
    const maxChecks = 120; // 10 minutes with 5 second intervals
    const startTime = Date.now();

    const waitForCompletion = async () => {
      while (checkCount < maxChecks) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Check every 2 seconds
        checkCount++;

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        statusBarItem.text = `$(sync~spin) SFRH: Analyzing & fixing... ${elapsed}s`;

        // Check if deployment file has been updated by Claude (look for completion marker)
        try {
          const currentContent = await fs.readFile(deploymentFile, "utf8");
          // Check if Claude has added analysis (look for specific markers that indicate completion)
          if (
            currentContent.includes("## Analysis Complete") ||
            currentContent.includes("## Root Cause Analysis") ||
            currentContent.includes("## Fixes Applied") ||
            currentContent.includes("*Analysis completed by Claude Code*")
          ) {
            statusBarItem.text = "$(check) SFRH: Analysis & fixes complete!";
            vscode.window.showInformationMessage("SFRH: Analysis & automated fixes complete!");
            setTimeout(() => statusBarItem.dispose(), 3000); // Remove after 3 seconds
            return true;
          }
        } catch (e) {
          // File doesn't exist or can't be read, keep waiting
        }

        // Check if error occurred
        try {
          const errorContent = await fs.readFile(errorFile, "utf8");
          if (errorContent && errorContent.trim()) {
            statusBarItem.text = "$(error) SFRH: Analysis failed";
            statusBarItem.dispose();
            throw new Error(errorContent);
          }
        } catch (e) {
          if (e.code !== "ENOENT") throw e; // Only ignore file-not-found errors
        }

        // Show periodic updates in notifications
        // change to every 5 seconds
        if (checkCount % 5 === 0) {
          // Every minute
          vscode.window.showInformationMessage(`SFRH: Analyzing & applying fixes... (${elapsed}s)`);
        }
      }

      // Timeout reached
      statusBarItem.text = "$(warning) SFRH: Analysis timed out";
      statusBarItem.dispose();
      throw new Error("Analysis timed out after 10 minutes");
    };

    await waitForCompletion();

    // Read the deployment analysis file
    let deploymentContent = "*No analysis produced by Claude.*";

    try {
      deploymentContent = await fs.readFile(deploymentFile, "utf8");
    } catch (e) {
      // Deployment file doesn't exist, check error log
      try {
        const errorLog = await fs.readFile(errorFile, "utf8");
        if (errorLog) {
          vscode.window.showErrorMessage(`SFRH: Analysis encountered an error: ${errorLog}`);
        }
      } catch {}
    }

    // Show results in output panel
    outputChannel.clear();
    outputChannel.appendLine("=== SFRH: Salesforce Deployment Analysis & Fixes ===\n");
    outputChannel.appendLine(`Deployment Analysis File: ${deploymentFile}\n`);

    outputChannel.appendLine("=== SFRH: Completed Analysis & Fixes ===");
    // outputChannel.appendLine(deploymentContent);

    outputChannel.show();

    // Show completion message and automatically open the report
    vscode.window.showInformationMessage(`SFRH: Analysis & automated fixes complete! Opening deployment report...`);

    // Automatically open the deployment analysis file
    try {
      const doc = await vscode.workspace.openTextDocument(deploymentFile);
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(`SFRH: Could not open deployment report: ${error.message}`);
    }

    // Clean up temporary instruction file
    try {
      await fs.unlink(instructionFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  } catch (error) {
    console.error("Error running Claude Code analysis:", error);

    // Check error log
    try {
      const errorLog = await fs.readFile(path.join(workspaceRoot, ".sfrh", "claude-error.log"), "utf8");
      if (errorLog) {
        vscode.window.showErrorMessage(`SFRH: Claude Code error: ${errorLog}`);

        // Check for common issues
        if (/ANTHROPIC_API_KEY/i.test(errorLog)) {
          vscode.window.showErrorMessage(
            "SFRH: Claude Code requires ANTHROPIC_API_KEY to be set. Please set your API key in your terminal environment."
          );
        }
      }
    } catch {
      vscode.window.showErrorMessage(`SFRH: Claude Code analysis failed: ${error.message}`);
    }

    // Clean up temporary instruction file on error
    try {
      if (instructionFile) {
        await fs.unlink(instructionFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
};

/**
 * Format failures for Claude Code analysis (simplified for single file approach)
 */
const formatFailuresForClaudeCode = (failures, deploymentId) => {
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

`;
    }
  });

  return context;
};

module.exports = claudeCodeTestFailures;

// Export individual functions for reuse
module.exports.checkClaudeCodeCLI = checkClaudeCodeCLI;
module.exports.analyzeWithClaudeCode = analyzeWithClaudeCode;
module.exports.formatFailuresForClaudeCode = formatFailuresForClaudeCode;
