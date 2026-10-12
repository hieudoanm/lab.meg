# MEG Lab Release Notes

## Overview

MEG Lab is a full-stack computational-neuroimaging workbench for organising projects, importing MEG recordings, and running reproducible signal-processing pipelines with project-scoped access control.

## Platform Downloads

### Linux

| No  | Package               | File               | Command                          |
| --- | --------------------- | ------------------ | -------------------------------- |
| 1   | **AppImage**          | `meg-lab.AppImage` | Run anywhere (no install)        |
| 2   | **Debian/Ubuntu**     | `meg-lab.deb`      | `sudo apt install ./meg-lab.deb` |
| 3   | **RPM (Fedora/RHEL)** | `meg-lab.rpm`      | `sudo dnf install ./meg-lab.rpm` |
| 4   | **Tarball**           | `meg-lab.tar.xz`   | Extract and run `./meg-lab`      |

### macOS

| No  | Package              | File          | Command                          |
| --- | -------------------- | ------------- | -------------------------------- |
| 1   | **DMG**              | `meg-lab.dmg` | Standard macOS installer         |
| 2   | **ZIP (App Bundle)** | `meg-lab.zip` | Extract and drag to Applications |

### Windows

| No  | Package           | File          | Command                    |
| --- | ----------------- | ------------- | -------------------------- |
| 1   | **MSI Installer** | `meg-lab.msi` | Standard Windows installer |
| 2   | **EXE**           | `meg-lab.exe` | Portable executable        |

## Verification

All artifacts include SHA256 checksums in `SHA256SUMS.txt`:

```bash
# Verify all downloads
sha256sum --check SHA256SUMS.txt
```

## Installation Requirements

| Platform | Requirements                                       |
| -------- | -------------------------------------------------- |
| Linux    | WebKitGTK 4.1+ (Ubuntu 22.04+, Fedora 38+, Arch)   |
| macOS    | macOS 12+ (Monterey) — uses system WebKit          |
| Windows  | Windows 10 1903+ (WebView2 runtime auto-installed) |

## Support

- [Documentation](https://github.com/hieudoanm/meg-lab/tree/master/docs)
- [Issues](https://github.com/hieudoanm/meg-lab/issues)
- [Security](https://github.com/hieudoanm/meg-lab/SECURITY.md)