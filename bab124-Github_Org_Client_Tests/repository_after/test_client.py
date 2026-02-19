#!/usr/bin/env python3
"""
This module contains a test class for the GithubOrgClient class.
"""
import unittest
from unittest.mock import patch, MagicMock, PropertyMock
from parameterized import parameterized
from client import GithubOrgClient
from typing import Any, Dict, Tuple


class TestGithubOrgClient(unittest.TestCase):
    """
    Test case for the GithubOrgClient class.

    This test case verifies the behavior of the GithubOrgClient class
    by testing its org method with different org names.

    The get_json function is mocked to simulate API responses, allowing
    the tests to be executed without making actual HTTP calls.
    """
    @parameterized.expand([
        ("google",),
        ("abc",),
    ])
    @patch('client.get_json')
    def test_org(self, org_name: str, mock_get_json: MagicMock) -> None:
        """
        Test the org method of GithubOrgClient.

        This method verifies that the org method of the GithubOrgClient
        returns the expected result for different org names.

        Args:
            org_name (str): The name of the organization.
            mock_get_json (MagicMock): The mock object for the get_json
        function.

        Returns:
            None

        Raises:
            AssertionError: If the test fails.

        Examples:
            >>> client = GithubOrgClient("google")
            >>> client.org()
            {"org_key": "org_value"}
        """
        # Mock the response of get_json
        mock_get_json.return_value = {"org_key": "org_value"}

        # Create an instance of GithubOrgClient
        client: GithubOrgClient = GithubOrgClient(org_name)

        # Call the org method
        result: Dict[str, Any] = client.org

        # Assert that get_json was called once with the expected argument
        expected_url: str = f"https://api.github.com/orgs/{org_name}"
        mock_get_json.assert_called_once_with(expected_url)

        # Assert that the result is the expected value
        expected_result: Dict[str, Any] = {"org_key": "org_value"}
        self.assertEqual(result, expected_result)

    def test_public_repos_url(self):
        """
        Test the _public_repos_url property of GithubOrgClient.

        This method verifies that the _public_repos_url property
        returns the expected URL based on the mocked payload.

        Returns:
            None

        Raises:
            AssertionError: If the test fails.
        """
        # Mock the org method to return a known payload
        mock_payload = {"repos_url":
                        "https://api.github.com/orgs/testorg/repos"}
        with patch('client.GithubOrgClient.org', new_callable=PropertyMock(
                return_value=mock_payload)):
            # Create an instance of GithubOrgClient
            client = GithubOrgClient("testorg")

            # Access the _public_repos_url property
            result = client._public_repos_url

            # Assert that the result is the expected URL
            expected_url = "https://api.github.com/orgs/testorg/repos"
            self.assertEqual(result, expected_url)

    @patch('client.get_json')
    def test_public_repos(self, mock_get_json: MagicMock) -> None:
        """
        Test the public_repos method without license filtering.

        This method verifies that public_repos returns the correct
        list of repository names when no license filter is applied.

        Args:
            mock_get_json (MagicMock): Mock object for get_json function.

        Returns:
            None

        Raises:
            AssertionError: If the test fails.
        """
        # Mock repository data
        mock_repos = [
            {"name": "repo1", "license": {"key": "mit"}},
            {"name": "repo2", "license": {"key": "apache-2.0"}},
            {"name": "repo3", "license": None},
        ]
        mock_get_json.return_value = mock_repos

        # Mock the org property to return repos_url
        mock_payload = {"repos_url": "https://api.github.com/orgs/test/repos"}

        with patch('client.GithubOrgClient.org', new_callable=PropertyMock(
                return_value=mock_payload)):
            client = GithubOrgClient("test")
            result = client.public_repos()

            # Should return all repo names
            expected = ["repo1", "repo2", "repo3"]
            self.assertEqual(result, expected)

            # Verify get_json was called once with the repos_url
            mock_get_json.assert_called_once_with(
                "https://api.github.com/orgs/test/repos")

    @patch('client.get_json')
    def test_public_repos_with_license(self, mock_get_json: MagicMock) -> None:
        """
        Test the public_repos method with license filtering.

        This method verifies that public_repos correctly filters
        repositories by the specified license key.

        Args:
            mock_get_json (MagicMock): Mock object for get_json function.

        Returns:
            None

        Raises:
            AssertionError: If the test fails.
        """
        # Mock repository data with various licenses
        mock_repos = [
            {"name": "repo1", "license": {"key": "mit"}},
            {"name": "repo2", "license": {"key": "apache-2.0"}},
            {"name": "repo3", "license": {"key": "mit"}},
            {"name": "repo4", "license": None},
            {"name": "repo5"},  # No license field
        ]
        mock_get_json.return_value = mock_repos

        # Mock the org property
        mock_payload = {"repos_url": "https://api.github.com/orgs/test/repos"}

        with patch('client.GithubOrgClient.org', new_callable=PropertyMock(
                return_value=mock_payload)):
            client = GithubOrgClient("test")
            result = client.public_repos(license="mit")

            # Should only return repos with MIT license
            expected = ["repo1", "repo3"]
            self.assertEqual(result, expected)

    @parameterized.expand([
        ({"license": {"key": "mit"}}, "mit", True),
        ({"license": {"key": "apache-2.0"}}, "apache-2.0", True),
        ({"license": {"key": "gpl-3.0"}}, "gpl-3.0", True),
    ])
    def test_has_license_true(
        self, repo: Dict[str, Any], license_key: str, expected: bool
    ) -> None:
        """
        Test the has_license method for cases that should return True.

        This method verifies that has_license correctly identifies
        repositories that have the specified license.

        Args:
            repo (Dict[str, Any]): Repository data dictionary.
            license_key (str): The license key to check for.
            expected (bool): The expected result (True).

        Returns:
            None

        Raises:
            AssertionError: If the test fails.
        """
        result = GithubOrgClient.has_license(repo, license_key)
        self.assertEqual(result, expected)

    @parameterized.expand([
        ({"license": {"key": "mit"}}, "apache-2.0", False),
        ({"license": {"key": "gpl-3.0"}}, "mit", False),
        ({"license": None}, "mit", False),
        ({}, "mit", False),
    ])
    def test_has_license_false(
        self, repo: Dict[str, Any], license_key: str, expected: bool
    ) -> None:
        """
        Test the has_license method for cases that should return False.

        This method verifies that has_license correctly identifies
        repositories that do not have the specified license, including
        cases with None values and missing license fields.

        Args:
            repo (Dict[str, Any]): Repository data dictionary.
            license_key (str): The license key to check for.
            expected (bool): The expected result (False).

        Returns:
            None

        Raises:
            AssertionError: If the test fails.
        """
        result = GithubOrgClient.has_license(repo, license_key)
        self.assertEqual(result, expected)

    @patch('client.get_json')
    def test_public_repos_empty(self, mock_get_json: MagicMock) -> None:
        """
        Test the public_repos method with empty repository data.

        This method verifies that public_repos handles empty
        repository lists correctly.

        Args:
            mock_get_json (MagicMock): Mock object for get_json function.

        Returns:
            None

        Raises:
            AssertionError: If the test fails.
        """
        # Mock empty repository list
        mock_get_json.return_value = []

        # Mock the org property
        mock_payload = {"repos_url": "https://api.github.com/orgs/test/repos"}

        with patch('client.GithubOrgClient.org', new_callable=PropertyMock(
                return_value=mock_payload)):
            client = GithubOrgClient("test")
            result = client.public_repos()

            # Should return empty list
            self.assertEqual(result, [])

    @patch('client.get_json')
    def test_public_repos_missing_license_field(
        self, mock_get_json: MagicMock
    ) -> None:
        """
        Test public_repos with repositories missing the license field.

        This method verifies that public_repos handles repositories
        that don't have a license field at all.

        Args:
            mock_get_json (MagicMock): Mock object for get_json function.

        Returns:
            None

        Raises:
            AssertionError: If the test fails.
        """
        # Mock repos with missing license field
        mock_repos = [
            {"name": "repo1"},  # No license field
            {"name": "repo2", "license": {"key": "mit"}},
            {"name": "repo3"},  # No license field
        ]
        mock_get_json.return_value = mock_repos

        # Mock the org property
        mock_payload = {"repos_url": "https://api.github.com/orgs/test/repos"}

        with patch('client.GithubOrgClient.org', new_callable=PropertyMock(
                return_value=mock_payload)):
            client = GithubOrgClient("test")

            # Test without license filter - should return all repos
            result = client.public_repos()
            self.assertEqual(result, ["repo1", "repo2", "repo3"])

            # Test with license filter - should only return repo2
            result_mit = client.public_repos(license="mit")
            self.assertEqual(result_mit, ["repo2"])

    @patch('client.get_json')
    def test_public_repos_none_license_value(
        self, mock_get_json: MagicMock
    ) -> None:
        """
        Test public_repos with repositories having None as license value.

        This method verifies that public_repos handles repositories
        where the license field is explicitly set to None.

        Args:
            mock_get_json (MagicMock): Mock object for get_json function.

        Returns:
            None

        Raises:
            AssertionError: If the test fails.
        """
        # Mock repos with None license values
        mock_repos = [
            {"name": "repo1", "license": None},
            {"name": "repo2", "license": {"key": "mit"}},
            {"name": "repo3", "license": None},
        ]
        mock_get_json.return_value = mock_repos

        # Mock the org property
        mock_payload = {"repos_url": "https://api.github.com/orgs/test/repos"}

        with patch('client.GithubOrgClient.org', new_callable=PropertyMock(
                return_value=mock_payload)):
            client = GithubOrgClient("test")

            # Test with license filter - should only return repo2
            result = client.public_repos(license="mit")
            self.assertEqual(result, ["repo2"])


if __name__ == '__main__':
    unittest.main()
