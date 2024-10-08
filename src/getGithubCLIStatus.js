const vscode = require("vscode");
const { checkGithubCLI } = require("./gitUtils");

const getGithubCLIStatus = async () => {
    const githubCLIInstalled = checkGithubCLI();
    if (!githubCLIInstalled) {
        const action = await vscode.window.showErrorMessage(
            "GitHub CLI is not installed or not in PATH. It's required for some features of this extension.",
            "Install Instructions"
        );
        if (action === "Install Instructions") {
            vscode.env.openExternal(
                vscode.Uri.parse("https://cli.github.com/manual/installation")
            );
        }
    }
};

module.exports = getGithubCLIStatus;
