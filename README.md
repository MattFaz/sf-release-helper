<h1 align="center">SF Release Helper</h1>

<p align="center">
    <i>SF Release Process from within VSCode simply be clicking!</i>
    <br>
    <i>Note: Designed for internal use and very specific release process.</i>
</p>

## Overview

SF Release Helper is a Visual Studio Code extension designed to streamline and automate common tasks in the SF development workflow. This extension provides a set of tools to manage branches, create pull requests, and facilitate the release process, making it easier for developers to follow best practices and maintain a consistent workflow.

## Features

1. **Create Feature/Bugfix Branch**: Quickly create a new feature or bugfix branch with proper naming conventions.
2. **Create Branch & PR for QA/UAT/Release**: Automate the process of creating environment-specific branches and pull requests.
3. **Checkout Base Branch**: Easily switch to the base branch of your current feature or bugfix branch.
4. **Checkout Main Branch**: Quickly switch to the main branch and pull the latest changes.
5. **Delete Branch**: Safely delete local and remote branches with a user-friendly interface.
6. **Report Issue/Enhancement**: Easily submit feedback or report issues directly to the project's GitHub repository.
7. **Sidebar Menu**: Access all features through a convenient sidebar menu in VS Code.

## Requirements

-   Visual Studio Code v1.93.0 or higher
-   Git installed and configured on your system
-   GitHub CLI (gh) installed and authenticated for PR creation
-   Branches are created based on a ticket number (SQSCS-#### or AMS-####)
    -   _Note: This is very likely to differ to your Ticket format, clone this repo and modify for your usage_

## Installation

1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X)
3. Search for "SF Release Helper"
4. Click Install

## Usage

1. Open the SF Release Helper sidebar in VS Code's Activity Bar.
2. Click on the desired action in the menu.
3. Follow the prompts to complete the selected action.

## Configuration

No additional configuration is required. The extension uses your existing Git configuration.

## Known Issues

-   The extension assumes a specific branch naming convention
-   PR creation requires the GitHub CLI to be installed and authenticated
-   Untested on Windows
