const vscode = require("vscode");
const { checkoutMainAndPull } = require("./gitUtils");

const checkoutMainBranch = async () => {
    vscode.window.showInformationMessage(
        "Checking out main branch and pulling latest changes..."
    );
    if (!checkoutMainAndPull()) {
        vscode.window.showErrorMessage(
            "Failed to checkout main and pull. Please check your git status."
        );
    } else {
        vscode.window.showInformationMessage(
            "Successfully checked out main branch"
        );
    }
};

module.exports = checkoutMainBranch;
