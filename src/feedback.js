const vscode = require("vscode");
const { exec } = require("child_process");

const getGitHubInfo = () => {
    return new Promise((resolve, reject) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            reject(new Error("No workspace folder found"));
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        exec(
            "git config --get remote.origin.url",
            { cwd: rootPath },
            (error, stdout, stderr) => {
                if (error) {
                    reject(
                        new Error(`Error getting git remote: ${error.message}`)
                    );
                    return;
                }
                if (stderr) {
                    reject(new Error(`Git remote stderr: ${stderr}`));
                    return;
                }

                const remoteUrl = stdout.trim();
                const match = remoteUrl.match(
                    /github\.com[:/](.+?)\/(.+?)(?:\.git)?$/
                );

                if (match) {
                    resolve({
                        owner: match[1],
                        repo: match[2],
                    });
                } else {
                    reject(
                        new Error(
                            "Unable to parse GitHub owner and repo from remote URL"
                        )
                    );
                }
            }
        );
    });
};

const provideFeedback = async () => {
    try {
        const issueType = await vscode.window.showQuickPick(
            ["bug", "enhancement"],
            { placeHolder: "Select the type of issue" }
        );

        if (!issueType) {
            return; // User cancelled the selection
        }

        const title = await vscode.window.showInputBox({
            prompt: `Please provide a title for your ${issueType.toLowerCase()}`,
            placeHolder: `${issueType} title`,
        });

        if (!title) {
            return; // User cancelled the input
        }

        const feedback = await vscode.window.showInputBox({
            prompt: `Please provide details for your ${issueType.toLowerCase()}`,
            placeHolder: `${issueType} details...`,
        });

        if (!feedback) {
            return; // User cancelled the input
        }

        // Get GitHub info from current repo
        const { owner, repo } = await getGitHubInfo();

        // Construct the GitHub issue URL with assignees
        const issueUrl = `https://github.com/${owner}/${repo}/issues/new?title=${encodeURIComponent(
            title
        )}&body=${encodeURIComponent(feedback)}&labels=${encodeURIComponent(
            issueType
        )}`;

        // Open the GitHub issue page in the user's default browser
        vscode.env.openExternal(vscode.Uri.parse(issueUrl));

        vscode.window.showInformationMessage(
            `A new GitHub ${issueType.toLowerCase()} has been opened in your browser. Please submit it to provide your feedback.`
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Error providing feedback: ${error.message}`
        );
    }
};

module.exports = provideFeedback;
