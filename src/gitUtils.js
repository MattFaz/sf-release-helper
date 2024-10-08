const { execSync } = require("child_process");

const checkGithubCLI = () => {
    try {
        execSync("gh --version");
        return true;
    } catch (error) {
        console.error("GitHub CLI not found. Please install it.");
        return false;
    }
};

const getCurrentBranch = () => {
    try {
        // Execute git command to get current branch
        const branch = execSync("git rev-parse --abbrev-ref HEAD")
            .toString()
            .trim();
        return branch;
    } catch (error) {
        console.error("Error getting current branch:", error);
        return null;
    }
};

const checkoutMainAndPull = () => {
    try {
        execSync("git checkout main && git pull");
        return true;
    } catch (error) {
        console.error("Error checking out main and pulling:", error);
        return false;
    }
};

const createNewBranch = (branchName) => {
    try {
        execSync(`git checkout -b ${branchName}`);
        return true;
    } catch (error) {
        console.error("Error creating new branch:", error);
        return false;
    }
};

const getGitUser = () => {
    try {
        const name = execSync("git config user.name").toString().trim();
        const email = execSync("git config user.email").toString().trim();
        return { name, email };
    } catch (error) {
        console.error("Error getting Git user:", error);
        return null;
    }
};

module.exports = {
    checkGithubCLI,
    getCurrentBranch,
    checkoutMainAndPull,
    createNewBranch,
    getGitUser,
};
