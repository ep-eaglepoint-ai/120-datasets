#!/usr/bin/env python3
"""
Patch Application Script
Applies the file transfer system improvements from repository_before to repository_after.
"""

import os
import sys
import shutil
from pathlib import Path


def apply_patch():
    """Apply the patch by copying files from repository_after to repository_before"""
    
    print("File Transfer System - Patch Application")
    print("=" * 50)
    
    # Get script directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # Define paths
    repo_before = project_root / "repository_before"
    repo_after = project_root / "repository_after"
    
    # Check if directories exist
    if not repo_before.exists():
        print(f"Error: {repo_before} does not exist")
        return 1
    
    if not repo_after.exists():
        print(f"Error: {repo_after} does not exist")
        return 1
    
    print(f"Source (after): {repo_after}")
    print(f"Target (before): {repo_before}")
    print()
    
    # Backup original files
    backup_dir = project_root / "backup_before_patch"
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    
    print("Creating backup of original files...")
    shutil.copytree(repo_before, backup_dir)
    print(f"✓ Backup created at: {backup_dir}")
    
    # Files to patch
    files_to_patch = [
        "server.py",
        "client.py", 
        "README.md"
    ]
    
    # Apply patch by copying files
    print("\nApplying patch...")
    for filename in files_to_patch:
        source_file = repo_after / filename
        target_file = repo_before / filename
        
        if source_file.exists():
            shutil.copy2(source_file, target_file)
            print(f"✓ Patched: {filename}")
        else:
            print(f"⚠ Warning: {filename} not found in repository_after")
    
    # Copy additional files if they exist
    additional_files = [
        "run_tests.py",
        "test_setup.py"
    ]
    
    print("\nCopying additional files...")
    for filename in additional_files:
        source_file = repo_after / filename
        target_file = repo_before / filename
        
        if source_file.exists():
            shutil.copy2(source_file, target_file)
            print(f"✓ Copied: {filename}")
    
    print("\n" + "=" * 50)
    print("Patch applied successfully!")
    print(f"Original files backed up to: {backup_dir}")
    print("\nThe repository_before now contains the robust implementation.")
    print("You can test the patched system by running:")
    print("  cd repository_before")
    print("  python server.py")
    print("  # In another terminal:")
    print("  python client.py test.txt")
    print("=" * 50)
    
    return 0


def reverse_patch():
    """Reverse the patch by restoring from backup"""
    
    print("File Transfer System - Patch Reversal")
    print("=" * 50)
    
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    repo_before = project_root / "repository_before"
    backup_dir = project_root / "backup_before_patch"
    
    if not backup_dir.exists():
        print("Error: No backup found. Cannot reverse patch.")
        return 1
    
    print(f"Restoring from backup: {backup_dir}")
    print(f"Target: {repo_before}")
    
    # Remove current repository_before
    if repo_before.exists():
        shutil.rmtree(repo_before)
    
    # Restore from backup
    shutil.copytree(backup_dir, repo_before)
    
    print("✓ Patch reversed successfully!")
    print("The repository_before has been restored to its original state.")
    
    return 0


def main():
    """Main function with command-line options"""
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--reverse":
            return reverse_patch()
        elif sys.argv[1] == "--help":
            print("Usage:")
            print("  python apply_patch.py        # Apply patch")
            print("  python apply_patch.py --reverse  # Reverse patch")
            print("  python apply_patch.py --help     # Show this help")
            return 0
        else:
            print(f"Unknown option: {sys.argv[1]}")
            print("Use --help for usage information")
            return 1
    
    return apply_patch()


if __name__ == "__main__":
    sys.exit(main())