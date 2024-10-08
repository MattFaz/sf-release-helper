const vscode = require("vscode");
const { getGitUser } = require("./gitUtils");

const getGitUserInfo = async () => {
    const user = getGitUser();
    if (user) {
        vscode.window.showInformationMessage(
            `Current Git User: ${user.name} (${user.email})`
        );
    } else {
        vscode.window.showErrorMessage("Unable to get Git user information");
    }
};

module.exports = getGitUserInfo;
