const vscode = require("vscode");
const { execSync } = require("child_process");
const { getCurrentBranch } = require("./gitUtils");

const createEnvBranchAndPR = async (env) => {
    const currentBranch = getCurrentBranch();
    if (!currentBranch) {
        vscode.window.showErrorMessage("Unable to get current branch");
        return;
    }

    try {
        let targetBranch = env;
        let newBranch = `${currentBranch}_${env}`;
        let releaseNumber = "";

        // Handle release branch creation
        if (env === "release") {
            releaseNumber = await vscode.window.showInputBox({
                prompt: "Enter release number (e.g. 24.18 or 24.18-1)",
                validateInput: (input) => {
                    if (!/^\d+\.\d+(-\d+)?$/.test(input)) {
                        return "Invalid release number format. Use format: XX.XX or XX.XX-X";
                    }
                    return null;
                },
            });
            if (!releaseNumber) {
                return;
            }
            targetBranch = `release/${releaseNumber}`;
        }

        // Create new branch
        try {
            execSync(`git checkout -b ${newBranch}`);
            vscode.window.showInformationMessage(
                `Created & switched to branch: ${newBranch}`
            );
        } catch (error) {
            if (error.message.includes("already exists")) {
                vscode.window.showErrorMessage(
                    `Branch ${newBranch} already exists. Delete it first.`
                );
                return;
            } else {
                throw error;
            }
        }

        // Merge environment branch
        try {
            execSync(`git pull origin ${targetBranch}`);
            vscode.window.showInformationMessage(
                `Merged latest ${targetBranch} changes into ${newBranch}`
            );
        } catch (error) {
            throw error;
        }

        // Push changes
        execSync(`git push --set-upstream origin ${newBranch}`);
        vscode.window.showInformationMessage("Pushed changes to remote");

        // Create PR
        const branchNameWithoutPrefix = currentBranch.replace(
            /^(feature\/|bug\/)/,
            ""
        );
        const prTitle = `${branchNameWithoutPrefix} ${targetBranch}`;
        let prCommand = `gh pr create --base ${targetBranch} --head ${newBranch} --title "${prTitle}"`;
        const prUrl = execSync(prCommand).toString().trim();
        vscode.env.openExternal(vscode.Uri.parse(prUrl));
        vscode.window.showInformationMessage(`Created PR: ${prUrl}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
};

module.exports = createEnvBranchAndPR;
