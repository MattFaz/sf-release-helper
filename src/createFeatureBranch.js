const vscode = require("vscode");
const { checkoutMainAndPull, createNewBranch } = require("./gitUtils");

const createFeatureBranch = async () => {
    // Prompt user to select Feature or Bugfix
    const branchType = await vscode.window.showQuickPick(
        ["Feature", "Bugfix"],
        { placeHolder: "Select branch type" }
    );

    if (!branchType) {
        return;
    }

    // Prompt for ticket number
    const ticketNumber = await vscode.window.showInputBox({
        prompt: "Enter ticket number (SQSCS-#### or AMS-####)",
        validateInput: (input) => {
            if (!/^(SQSCS|AMS)-\d{4,}$/.test(input)) {
                return "Invalid ticket number format. Use SQSCS-#### or AMS-#### (minimum 4 digits).";
            }
            return null;
        },
    });

    if (!ticketNumber) {
        return;
    }

    // Checkout main and pull
    vscode.window.showInformationMessage(
        "Checking out main branch and pulling latest changes..."
    );
    if (!checkoutMainAndPull()) {
        vscode.window.showErrorMessage(
            "Failed to checkout main and pull. Please check your git status."
        );
        return;
    }

    // Create new branch
    const branchName = `${branchType.toLowerCase()}/${ticketNumber}`;
    vscode.window.showInformationMessage(`Creating new branch: ${branchName}`);
    if (createNewBranch(branchName)) {
        vscode.window.showInformationMessage(
            `Successfully created and checked out ${branchName}`
        );
    } else {
        vscode.window.showErrorMessage(
            `Failed to create branch ${branchName}. Please check your git status.`
        );
    }
};

module.exports = createFeatureBranch;
