const vscode = require("vscode");
const { getCurrentBranch } = require("./gitUtils");

const getCurrentBranchInfo = async () => {
    const branch = getCurrentBranch();
    if (branch) {
        vscode.window.showInformationMessage(`Current branch: ${branch}`);
    } else {
        vscode.window.showErrorMessage("Unable to get current branch");
    }
};

module.exports = getCurrentBranchInfo;
