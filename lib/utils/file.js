"use strict";

var path = require("path");
var fs = require("fs");

exports.detectAndCopyEnvFiles = function(logger, folderFullPath, matchRulesString, directCopyRules, projectData) {
    const matchRules = new RegExp(matchRulesString);
    const dirContents = fs.readdirSync(folderFullPath);

    /**
     * Check if need to make a "direct copy" of a file.
     *
     * NOTES:
     * - Usually it happens when copying a file into the `iOS` folder to
     *      avoid leaving all unneeded `env.` files into the `iOS` app builds.
     */
    const doDirectFileCopy = (filename, filePath) => {
        if (Object.keys(directCopyRules).includes(filename)) {
            const destinationFilePath = path.join(projectData.projectDir, directCopyRules[filename]);
            logger.info(`-o[NeoEnv]o--> Direct copying a file "${filename}" to "${directCopyRules[filename]}"`);
            fs.writeFileSync(destinationFilePath, fs.readFileSync(filePath));
        }
    }

    const testEnvFileToCopy = (parentPath, item) => {
        const itemPath = path.join(parentPath, item);

        try {
            if (fs.statSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
                // Loop into the folder.
                fs.readdirSync(itemPath).forEach((deeperItem) => testEnvFileToCopy(
                    path.join(parentPath,item),
                    deeperItem));
            }
            else {
                logger.debug('-o[NeoEnv]o--- Check file:', item);
                if (matchRules.test(item)) {
                    const destinationFileName = buildDestinationFileName(item);
                    const destinationFilePath = path.join(parentPath, destinationFileName);

                    logger.info(`-o[NeoEnv]o--> Copying env. file "${item}" to "${destinationFileName}"`);

                    // Check if the dest. file is the same as the source file.
                    //  - If `yes`, skip the copy.
                    if (!doesSourceMatchDestination(logger, itemPath, destinationFilePath)) {
                        fs.writeFileSync(destinationFilePath, fs.readFileSync(itemPath));
                    }
                    else {
                        logger.debug('-o[NeoEnv]o--x Not writing new file, as file that exists matches the file that it will be replaced with.');
                    }

                    // Check if need to do a "direct file copy"
                    doDirectFileCopy(destinationFileName, destinationFilePath);
                }
            }
        }
        catch (_error) { }
    };

    // Start to check and copy files.
    dirContents.forEach((item) => testEnvFileToCopy(folderFullPath, item));
}

exports.detectAndDeleteEnvFiles = function(logger, folderFullPath, matchRulesString) {
    const matchRules = new RegExp(matchRulesString);
    const dirContents = fs.readdirSync(folderFullPath);

    // The atom func to test and delete the file if matches.
    const testForFileToDelete = (parentPath, item) => {
        const itemPath = path.join(parentPath, item);

        try {
            if (fs.statSync(itemPath) && fs.statSync(itemPath).isDirectory()) {
                // It is a folder, loop in.
                fs.readdirSync(itemPath).forEach((deeperItem) => testForFileToDelete(
                    path.join(parentPath,item),
                    deeperItem
                ));
            } else {
                if (matchRules.test(item)) {
                    logger.info('-o[NeoEnv]o--> Delete a `env.` based file:', itemPath);
                    fs.unlinkSync(itemPath);
                }
            }
        }
        catch (_error) { }
    };

    // Start to check and copy files.
    dirContents.forEach((item) => testForFileToDelete(folderFullPath, item));
}

exports.replaceContentInFile = function(logger, pattern, replacement, filePath){
    try {
        if (fs.existsSync(filePath)) {
            let fileContent = fs.readFileSync(filePath).toString();
            if (pattern.test(fileContent)) {
                fileContent = fileContent.replace(
                    pattern,
                    replacement
                );
                // Save to file
                fs.writeFileSync(filePath, fileContent);
            }
        }
        else {
            throw new Error(`-o[NeoEnv]o--x Could not find the file to update: "${filePath}"`);
        }
    }
    catch (error) {
        throw new Error(`-o[NeoEnv]o--x Error when updating the file: "${filePath}" with ERROR:`, JSON.stringify(error));
    }
}

/**
 * Build the destination filename.
 *
 * Based on the rules, it only remove the `env.` related section.
 * For example: `en.default.staging.json` will be renamed to `en.default.json`
 *
 */
function buildDestinationFileName(file) {
    const fileNameParts = file.split('.');
    const ext = fileNameParts[fileNameParts.length - 1]
    const fileName = fileNameParts.splice(0, fileNameParts.length - 2).join('.');
    return `${fileName}.${ext}`;
}

function doesSourceMatchDestination(logger, sourcePath, destinationPath) {
    let sourceFileContents, destinationFileContents;

    if (fs.existsSync(sourcePath)) {
        sourceFileContents = fs.readFileSync(sourcePath);
    }
    else {
        throw new Error(`-o[NeoEnv]o--x Source file "${sourcePath}" does not exist!`);
    }

    if (fs.existsSync(destinationPath)) {
        destinationFileContents = fs.readFileSync(destinationPath);
    }
    else {
        logger.debug(`-o[NeoEnv]o--x Destination file "${destinationPath}" does not exist!`);
        return false;
    }

    return sourceFileContents === destinationFileContents;
}