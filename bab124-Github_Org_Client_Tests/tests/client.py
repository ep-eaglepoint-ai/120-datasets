#!/usr/bin/env python3
"""
GitHub Organization Client module.

This module provides a client for interacting with GitHub's API
to retrieve organization and repository information.
"""
from typing import Dict, List, Any, Optional
import requests


def get_json(url: str) -> Dict[str, Any]:
    """
    Fetch JSON data from a URL.

    Args:
        url (str): The URL to fetch data from.

    Returns:
        Dict[str, Any]: The JSON response as a dictionary.
    """
    response = requests.get(url)
    return response.json()


class GithubOrgClient:
    """
    A client for GitHub organization operations.

    This class provides methods to interact with GitHub's API
    to retrieve organization and repository information.
    """
    ORG_URL = "https://api.github.com/orgs/{org}"

    def __init__(self, org_name: str) -> None:
        """
        Initialize the GitHub Organization Client.

        Args:
            org_name (str): The name of the organization.
        """
        self._org_name = org_name

    @property
    def org(self) -> Dict[str, Any]:
        """
        Get organization information.

        Returns:
            Dict[str, Any]: Organization data from GitHub API.
        """
        return get_json(self.ORG_URL.format(org=self._org_name))

    @property
    def _public_repos_url(self) -> str:
        """
        Get the URL for the organization's public repositories.

        Returns:
            str: The URL to fetch public repositories.
        """
        return self.org.get("repos_url", "")

    def public_repos(self, license: Optional[str] = None) -> List[str]:
        """
        Get list of public repository names.

        Args:
            license (Optional[str]): Filter repositories by license key.
                                    If None, return all repositories.

        Returns:
            List[str]: List of repository names.
        """
        repos_data = get_json(self._public_repos_url)
        
        if license is None:
            return [repo.get("name") for repo in repos_data if "name" in repo]
        
        # Filter by license
        filtered_repos = []
        for repo in repos_data:
            if self.has_license(repo, license):
                if "name" in repo:
                    filtered_repos.append(repo["name"])
        
        return filtered_repos

    @staticmethod
    def has_license(repo: Dict[str, Any], license_key: str) -> bool:
        """
        Check if a repository has a specific license.

        Args:
            repo (Dict[str, Any]): Repository data dictionary.
            license_key (str): The license key to check for.

        Returns:
            bool: True if the repository has the specified license,
                  False otherwise.
        """
        if "license" not in repo:
            return False
        
        license_info = repo.get("license")
        
        if license_info is None:
            return False
        
        if not isinstance(license_info, dict):
            return False
        
        return license_info.get("key") == license_key
