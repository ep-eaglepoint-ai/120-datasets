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


if __name__ == '__main__':
    unittest.main()
