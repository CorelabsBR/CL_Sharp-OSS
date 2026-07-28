/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { FolderIcons } from "./FolderIconRegistry";

const DEFAULT_CLOSED = "folder.svg";
const DEFAULT_OPEN = "folder-open.svg";

export function resolveFolderIcon(
    folderName: string,
    expanded: boolean
): string {

    const icon = FolderIcons[
        folderName.toLowerCase()
    ];

    if (!icon) {
        return expanded
            ? DEFAULT_OPEN
            : DEFAULT_CLOSED;
    }

    return expanded
        ? icon.opened
        : icon.closed;
}