# Filesystem Append-Only Storage

An append-only storage implementation using the filesystem, perfect for propagation networks.

## Directory Structure

```
bassline-data/
├── networks/
│   └── {network-id}/
│       ├── meta.json
│       └── groups/
│           └── {group-id}/
│               ├── meta.json
│               └── contacts/
│                   └── {contact-id}/
│                       ├── latest          # Symlink to newest version
│                       ├── v00000001.json  # First version
│                       ├── v00000002.json  # Second version
│                       └── v00000003.json  # Current version
```

## Design Principles

1. **Each value is a new file** - Never modify, only create
2. **Versions in filename** - Natural ordering, easy to list
3. **Symlink to latest** - Fast access to current value
4. **Directory hierarchy** - Natural sharding and organization
5. **Atomic writes** - Write to temp file, then atomic rename

## Benefits

- **Zero lock contention** - Parallel writes to different files
- **Natural backup/restore** - Just copy files
- **Git-friendly** - Can version control the data itself
- **Debugging heaven** - Can inspect any version with `cat`
- **Works on any filesystem** - No special requirements
- **Partial sync** - Can sync only specific groups/contacts