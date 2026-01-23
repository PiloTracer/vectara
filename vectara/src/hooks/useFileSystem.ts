import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AuthorizedFolder {
    id: string;
    path: string;
}

export function useFileSystem() {
    const [folders, setFolders] = useState<AuthorizedFolder[]>([]);

    const loadFolders = async () => {
        try {
            const result = await invoke<Record<string, string>>('get_authorized_folders');
            const folderArray = Object.entries(result).map(([id, path]) => ({
                id,
                path,
            }));
            setFolders(folderArray);
        } catch (error) {
            console.error('Failed to load folders:', error);
        }
    };

    const authorizeFolder = async () => {
        try {
            const pathId = await invoke<string>('authorize_folder');
            await loadFolders();
            return pathId;
        } catch (error) {
            console.error('Failed to authorize folder:', error);
            // Optional: re-throw if caller wants to handle it
        }
    };

    const revokeFolder = async (pathId: string) => {
        try {
            await invoke('revoke_folder', { pathId });
            await loadFolders();
        } catch (error) {
            console.error('Failed to revoke folder:', error);
        }
    };

    useEffect(() => {
        loadFolders();
    }, []);

    return {
        folders,
        authorizeFolder,
        revokeFolder,
        refreshFolders: loadFolders,
    };
}
