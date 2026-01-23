import { useFileSystem } from '../hooks/useFileSystem';

export function FolderManager() {
    const { folders, authorizeFolder, revokeFolder } = useFileSystem();

    return (
        <div style={styles.card}>
            <h3 style={styles.title}>API Bridge: Authorized Folders</h3>
            <p style={styles.desc}>
                Folders listed here are accessible to the Docker Backend via the API Bridge.
            </p>

            <div style={styles.list}>
                {folders.length === 0 && (
                    <div style={styles.empty}>No authorized folders. Click "Add Folder" to grant access.</div>
                )}
                {folders.map((folder) => (
                    <div key={folder.id} style={styles.item}>
                        <div style={styles.info}>
                            <span style={styles.path}>{folder.path}</span>
                            <span style={styles.id}>ID: {folder.id}</span>
                        </div>
                        <button onClick={() => revokeFolder(folder.id)} style={styles.revokeBtn}>
                            Revoke
                        </button>
                    </div>
                ))}
            </div>

            <button onClick={authorizeFolder} style={styles.addBtn}>
                + Add Folder
            </button>
        </div>
    );
}

const styles = {
    card: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: '15px',
        borderRadius: '4px',
        marginBottom: '20px',
        border: '1px solid #333'
    },
    title: {
        margin: '0 0 10px 0',
        fontSize: '1em',
        color: '#eee'
    },
    desc: {
        fontSize: '0.85em',
        color: '#888',
        marginBottom: '15px'
    },
    list: {
        marginBottom: '15px'
    },
    empty: {
        textAlign: 'center' as const,
        color: '#666',
        fontSize: '0.9em',
        padding: '10px',
        border: '1px dashed #444',
        borderRadius: '4px'
    },
    item: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: '#333',
        marginBottom: '5px',
        borderRadius: '4px',
        border: '1px solid #444'
    },
    info: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '2px'
    },
    path: {
        color: '#fff',
        fontSize: '0.9em',
        wordBreak: 'break-all' as const
    },
    id: {
        color: '#666',
        fontSize: '0.75em',
        fontFamily: 'monospace'
    },
    revokeBtn: {
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        padding: '5px 10px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.8em',
        marginLeft: '10px'
    },
    addBtn: {
        backgroundColor: '#28a745',
        color: 'white',
        border: 'none',
        padding: '8px 15px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.9em'
    }
};
