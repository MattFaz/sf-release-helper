const vscode = require("vscode");
const getCurrentBranchInfo = require("./src/getCurrentBranchInfo");
const getGitUserInfo = require("./src/getGitUserInfo");
const createFeatureBranch = require("./src/createFeatureBranch");
const createEnvBranchAndPR = require("./src/createEnvBranchAndPR");
const checkoutBaseBranch = require("./src/checkoutBaseBranch");
const deleteBranch = require("./src/deleteBranch");
const checkoutMainBranch = require("./src/checkoutMainBranch");
const feedback = require("./src/feedback");
const getGithubCLIStatus = require("./src/getGithubCLIStatus");

class SalesforceHelperProvider {
    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (element) return Promise.resolve([]);

        // Menu Header
        const header = new vscode.TreeItem(
            "Salesforce Release Helper",
            vscode.TreeItemCollapsibleState.None
        );
        header.contextValue = "header";
        header.iconPath = new vscode.ThemeIcon(
            "info",
            new vscode.ThemeColor("charts.blue")
        );

        // Menu Items
        const menuItems = [
            {
                label: "Create feature / bugfix branch",
                command: "sf-release-helper.createFeatureBranch",
            },
            {
                label: "Create branch & PR for QA",
                command: "sf-release-helper.createQABranchAndPR",
            },
            {
                label: "Create branch & PR for UAT",
                command: "sf-release-helper.createUATBranchAndPR",
            },
            {
                label: "Create branch & PR for release",
                command: "sf-release-helper.createReleaseBranchAndPR",
            },
            {
                label: "Checkout base branch",
                command: "sf-release-helper.checkoutBaseBranch",
            },
            {
                label: "Checkout main branch",
                command: "sf-release-helper.checkoutMainBranch",
            },
            {
                label: "Delete branch",
                command: "sf-release-helper.deleteBranch",
            },
            {
                label: "Report Issue / Enhancement",
                command: "sf-release-helper.feedback",
            },
        ];

        const treeItems = menuItems.map((item, index) => {
            const treeItem = new vscode.TreeItem(
                `${index + 1}. ${item.label}`,
                vscode.TreeItemCollapsibleState.None
            );
            treeItem.command = { command: item.command, title: item.label };
            treeItem.iconPath = new vscode.ThemeIcon(
                "indent",
                new vscode.ThemeColor("charts.blue")
            );
            return treeItem;
        });

        return Promise.resolve([header, ...treeItems]);
    }
}

const activate = async (context) => {
    console.log("Salesforce Release Helper extension activated");
    // Create a TreeDataProvider for the sidebar menu
    const SFHelperProvider = new SalesforceHelperProvider();
    vscode.window.registerTreeDataProvider(
        "sf-release-helper-menu",
        SFHelperProvider
    );

    await getGithubCLIStatus();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "sf-release-helper.getCurrentBranch",
            getCurrentBranchInfo
        ),
        vscode.commands.registerCommand(
            "sf-release-helper.createFeatureBranch",
            createFeatureBranch
        ),
        vscode.commands.registerCommand(
            "sf-release-helper.getGitUser",
            getGitUserInfo
        ),
        vscode.commands.registerCommand(
            "sf-release-helper.createQABranchAndPR",
            () => createEnvBranchAndPR("qa")
        ),
        vscode.commands.registerCommand(
            "sf-release-helper.createUATBranchAndPR",
            () => createEnvBranchAndPR("uat")
        ),
        vscode.commands.registerCommand(
            "sf-release-helper.createReleaseBranchAndPR",
            () => createEnvBranchAndPR("release")
        ),
        vscode.commands.registerCommand(
            "sf-release-helper.checkoutBaseBranch",
            checkoutBaseBranch
        ),
        vscode.commands.registerCommand(
            "sf-release-helper.deleteBranch",
            deleteBranch
        ),
        vscode.commands.registerCommand(
            "sf-release-helper.checkoutMainBranch",
            checkoutMainBranch
        ),
        vscode.commands.registerCommand("sf-release-helper.feedback", feedback)
    );
};

// This method is called when your extension is deactivated
const deactivate = () => {};

module.exports = {
    activate,
    deactivate,
};
