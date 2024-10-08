const vscode = require("vscode");
const { execSync } = require("child_process");
const { getCurrentBranch } = require("./gitUtils");

const checkoutBaseBranch = async () => {
    try {
        const currentBranch = getCurrentBranch();
        if (!currentBranch) throw new Error("Unable to get current branch");

        const baseBranch = currentBranch.replace(/_(qa|uat|release)$/, "");

        if (baseBranch === currentBranch) {
            // If no base branch found, prompt for branch type and then branch name/ticket number
            const branchType = await vscode.window.showQuickPick(
                ["feature", "bugfix"],
                { placeHolder: "Select branch type" }
            );

            if (!branchType) {
                throw new Error("Branch type not selected");
            }

            const branchInput = await vscode.window.showInputBox({
                prompt: `Enter the ${branchType} branch name or ticket number`,
                validateInput: (input) => {
                    if (input.startsWith(`${branchType}/`)) {
                        // Full branch name provided
                        const ticketNumber = input.split("/")[1];
                        if (!/^(SQSCS|AMS)-\d{4,}$/.test(ticketNumber)) {
                            return "Invalid ticket number format in branch name. Use SQSCS-#### or AMS-#### (minimum 4 digits).";
                        }
                    } else if (!/^(SQSCS|AMS)-\d{4,}$/.test(input)) {
                        return "Invalid ticket number format. Use SQSCS-#### or AMS-#### (minimum 4 digits).";
                    }
                    return null;
                },
            });

            if (!branchInput) {
                throw new Error("Branch name or ticket number not provided");
            }

            const featureBranch = branchInput.startsWith(`${branchType}/`)
                ? branchInput
                : `${branchType}/${branchInput}`;

            execSync(`git checkout ${featureBranch}`);
            vscode.window.showInformationMessage(
                `Switched to branch '${featureBranch}'`
            );
        } else {
            execSync(`git checkout ${baseBranch}`);
            vscode.window.showInformationMessage(
                `Switched to branch '${baseBranch}'`
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            `Error switching to base branch: ${error.message}.`
        );
    }
};

module.exports = checkoutBaseBranch;
