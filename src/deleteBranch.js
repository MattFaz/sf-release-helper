const vscode = require("vscode");
const { execSync } = require("child_process");
const { getCurrentBranch } = require("./gitUtils");

const deleteBranch = async () => {
    try {
        // Get list of local branches
        const branches = execSync("git branch")
            .toString()
            .split("\n")
            .map((b) => b.trim().replace("* ", ""))
            .filter((b) => b !== "");

        // Get current branch
        const currentBranch = getCurrentBranch();

        // Create QuickPick instance
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = "Select a branch to delete";
        quickPick.items = branches.map((branch) => ({ label: branch }));

        quickPick.onDidChangeValue((value) => {
            const filteredBranches = branches.filter((b) =>
                b.toLowerCase().includes(value.toLowerCase())
            );
            quickPick.items = filteredBranches.map((branch) => ({
                label: branch,
            }));
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
        });

        return new Promise((resolve) => {
            quickPick.onDidAccept(async () => {
                const selectedBranch = quickPick.selectedItems[0]?.label;
                quickPick.hide();

                if (selectedBranch) {
                    if (selectedBranch === currentBranch) {
                        vscode.window.showErrorMessage(
                            "Cannot delete the current branch. Please switch to another branch first."
                        );
                        resolve();
                        return;
                    }

                    const deleteOptions = [
                        "Local only",
                        "Local and remote",
                        "Cancel",
                    ];
                    const deleteChoice = await vscode.window.showQuickPick(
                        deleteOptions,
                        {
                            placeHolder: "Choose delete option",
                        }
                    );

                    if (deleteChoice === "Cancel") {
                        resolve();
                        return;
                    }

                    const confirmation = await vscode.window.showWarningMessage(
                        `Are you sure you want to delete the branch '${selectedBranch}' ${
                            deleteChoice === "Local and remote"
                                ? "locally and remotely"
                                : "locally"
                        }?`,
                        { modal: true },
                        "Yes",
                        "No"
                    );

                    if (confirmation === "Yes") {
                        try {
                            // Delete locally
                            execSync(`git branch -D ${selectedBranch}`);
                            let message = `Branch '${selectedBranch}' has been deleted locally.`;

                            // Attempt to delete remotely if chosen
                            if (deleteChoice === "Local and remote") {
                                try {
                                    execSync(
                                        `git push origin --delete ${selectedBranch}`
                                    );
                                    message = `Branch '${selectedBranch}' has been deleted locally and remotely.`;
                                } catch (remoteError) {
                                    // Check if the error is due to the branch not existing on remote
                                    if (
                                        remoteError.message.includes(
                                            "remote ref does not exist"
                                        )
                                    ) {
                                        message +=
                                            " The branch did not exist on the remote repository.";
                                    } else {
                                        message += ` However, there was an issue deleting it remotely: ${remoteError.message}`;
                                    }
                                }
                            }
                            vscode.window.showInformationMessage(message);
                        } catch (error) {
                            vscode.window.showErrorMessage(
                                `Failed to delete branch '${selectedBranch}': ${error.message}`
                            );
                        }
                    }
                }
                resolve();
            });

            quickPick.show();
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
};

module.exports = deleteBranch;
