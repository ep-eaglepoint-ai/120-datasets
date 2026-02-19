from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient

# REQ-01: Accept long URL, generate short code
# REQ-02: Redirect users
# REQ-05: Idempotency (Same input -> Same output)
# Critical Scenarios


class TestIntegration:

    def test_create_short_url_api(self, api_client: TestClient):
        """REQ-01: Basic shortening API test."""
        long_url = "https://www.google.com/search?q=test"
        response = api_client.post("/api/shorten", json={"target_url": long_url})
        assert response.status_code == 200
        data = response.json()
        assert "short_code" in data
        assert "short_url" in data
        assert len(data["short_code"]) >= 5

    def test_create_short_url_idempotency(self, api_client: TestClient):
        """REQ-05: Exact same URL should return same code."""
        long_url = "https://www.duplicate.com/resource"
        resp1 = api_client.post("/api/shorten", json={"target_url": long_url})
        assert resp1.status_code == 200
        code1 = resp1.json()["short_code"]

        # Second call
        resp2 = api_client.post("/api/shorten", json={"target_url": long_url})
        assert resp2.status_code == 200
        code2 = resp2.json()["short_code"]

        assert code1 == code2, "Short codes must be identical for same URL"

    def test_redirect_flow(self, api_client: TestClient):
        """REQ-02: Verify redirection."""
        long_url = "https://www.redirect-me.com/target"
        create_resp = api_client.post("/api/shorten", json={"target_url": long_url})
        code = create_resp.json()["short_code"]

        redirect_resp = api_client.get(f"/{code}", follow_redirects=False)
        assert redirect_resp.status_code in (301, 302, 307, 308)
        assert redirect_resp.headers["location"] == long_url

    def test_invalid_url_rejection(self, api_client: TestClient):
        """REQ-04: Reject invalid URLs with strict 400 Bad Request."""
        response = api_client.post("/api/shorten", json={"target_url": "not-a-url"})
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower() or "url" in data["detail"].lower()

    def test_unreachable_url_rejection(self, api_client: TestClient):
        """Reject valid-format URLs that are not reachable when reachability check is enabled."""
        with patch("src.main_api.settings") as mock_settings:
            mock_settings.VALIDATE_URL_REACHABILITY = True
            mock_settings.BASE_URL = "http://localhost:8000"
            with patch(
                "src.main_api.is_url_reachable",
                new_callable=AsyncMock,
                return_value=False,
            ):
                response = api_client.post(
                    "/api/shorten",
                    json={"target_url": "https://example.com/unreachable"},
                )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "reachable" in data["detail"].lower()

    def test_non_existent_code_404(self, api_client: TestClient):
        """REQ-Critical: 404 for invalid code (redirect endpoint)."""
        response = api_client.get("/ZZZZZZ")
        assert response.status_code == 404

    def test_nonexistent_code_retrieval_404(self, api_client: TestClient):
        """Shortened URLs that don't exist must return HTTP 404 on retrieval endpoint."""
        response = api_client.get("/api/url/INVALIDCODE")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert (
            "not found" in data["detail"].lower() or "short" in data["detail"].lower()
        )

    def test_collision_resistance_bulk(self, api_client: TestClient):
        """REQ-Critical: Generate 100 codes, ensure uniqueness."""
        urls = [f"https://bulk.com/{i}" for i in range(100)]
        codes = set()
        for url in urls:
            resp = api_client.post("/api/shorten", json={"target_url": url})
            code = resp.json()["short_code"]
            assert code not in codes, f"Collision detected for code {code}"
            codes.add(code)

    def test_collision_resistance_1000(self, api_client: TestClient):
        """REQ-Critical: Generate 1,000 codes, ensure no collisions."""
        urls = [f"https://bulk1k.com/{i}" for i in range(1000)]
        codes = []
        for url in urls:
            resp = api_client.post("/api/shorten", json={"target_url": url})
            assert resp.status_code == 200
            codes.append(resp.json()["short_code"])
        assert len(codes) == 1000
        assert len(set(codes)) == 1000, "Collision detected among 1,000 short codes"

    def test_very_long_url(self, api_client: TestClient):
        """Edge case: very long URL (>2000 chars) is accepted and redirect works."""
        base = "https://example.com/path?"
        long_url = base + "x=" + "a" * (2000 - len(base))
        assert len(long_url) >= 2000
        resp = api_client.post("/api/shorten", json={"target_url": long_url})
        assert resp.status_code == 200
        data = resp.json()
        code = data["short_code"]
        get_resp = api_client.get(f"/api/url/{code}")
        assert get_resp.status_code == 200
        assert get_resp.json()["target_url"] == long_url
        redir_resp = api_client.get(f"/{code}", follow_redirects=False)
        assert redir_resp.status_code in (301, 302, 307, 308)
        assert redir_resp.headers["location"] == long_url

    def test_url_complexity(self, api_client: TestClient):
        """REQ-Critical: Unicode, special characters, fragments."""
        complex_url = "https://example.com/fübar?q=val#frag"
        resp = api_client.post("/api/shorten", json={"target_url": complex_url})
        assert resp.status_code == 200
        data = resp.json()
        code = data["short_code"]

        get_resp = api_client.get(f"/api/url/{code}")
        assert get_resp.status_code == 200
        assert get_resp.json()["target_url"] == complex_url

        redir_resp = api_client.get(f"/{code}", follow_redirects=False)
        assert redir_resp.status_code in (301, 302, 307, 308)
        assert redir_resp.headers["location"] == complex_url

    def test_ui_render(self, frontend_client: TestClient):
        """REQ-03: Verify minimal web UI rendering."""
        response = frontend_client.get("/")
        assert response.status_code == 200
        assert "Shorty" in response.text
        assert "<form" in response.text
        assert 'name="target_url"' in response.text

    def test_ui_submission(self, frontend_client: TestClient):
        """REQ-03: Verify UI form submission."""
        long_url = "https://ui-test.com/home"
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "target_url": long_url,
            "short_code": "0000a",
            "short_url": f"http://localhost:8000/0000a",
        }
        with patch("src.frontend_app.httpx.Client") as client_class:
            client_instance = client_class.return_value.__enter__.return_value
            client_instance.post.return_value = mock_response
            response = frontend_client.post(
                "/shorten-ui", data={"target_url": long_url}
            )
        assert response.status_code == 200
        assert "Success!" in response.text
        assert long_url in response.text
        assert "href=" in response.text

    def test_api_only_separately_deployable(self, api_client: TestClient):
        """Backend/frontend separately deployable: API is self-sufficient (no HTML)."""
        long_url = "https://api-only.example.com/page"
        create_resp = api_client.post("/api/shorten", json={"target_url": long_url})
        assert create_resp.status_code == 200
        data = create_resp.json()
        short_code = data["short_code"]
        short_url = data["short_url"]
        assert short_code and short_url
        get_resp = api_client.get(f"/api/url/{short_code}")
        assert get_resp.status_code == 200
        assert get_resp.json()["target_url"] == long_url
        redirect_resp = api_client.get(f"/{short_code}", follow_redirects=False)
        assert redirect_resp.status_code in (301, 302, 307, 308)
        assert redirect_resp.headers["location"] == long_url
        home_resp = api_client.get("/")
        assert home_resp.status_code == 404

    def test_frontend_does_not_expose_api(self, frontend_client: TestClient):
        response = frontend_client.post(
            "/api/shorten", json={"target_url": "https://nope.com"}
        )
        assert response.status_code == 404

    def test_concurrent_shorten(self, api_client: TestClient):
        """Concurrent shorten: many threads posting different URLs, all succeed, no duplicate codes."""
        num_urls = 50
        urls = [f"https://concurrent.com/{i}" for i in range(num_urls)]
        codes = []

        def shorten(url):
            resp = api_client.post("/api/shorten", json={"target_url": url})
            assert resp.status_code == 200
            return resp.json()["short_code"]

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(shorten, url) for url in urls]
            for f in as_completed(futures):
                codes.append(f.result())
        assert len(codes) == num_urls
        assert len(set(codes)) == num_urls, "Collision under concurrent shorten"

    def test_concurrent_redirect(self, api_client: TestClient):
        """Concurrent redirect: same short code hit many times; all return 307, same Location."""
        long_url = "https://concurrent-redirect.example.com/target"
        create_resp = api_client.post("/api/shorten", json={"target_url": long_url})
        assert create_resp.status_code == 200
        short_code = create_resp.json()["short_code"]

        def redirect():
            resp = api_client.get(f"/{short_code}", follow_redirects=False)
            return resp.status_code, resp.headers.get("location")

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(redirect) for _ in range(50)]
            results = [f.result() for f in as_completed(futures)]
        for status_code, location in results:
            assert status_code in (301, 302, 307, 308)
            assert location == long_url
