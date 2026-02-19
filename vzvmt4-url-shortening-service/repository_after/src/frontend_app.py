
import logging
from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse
import httpx

from src.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="URL Shortener Frontend")

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shorty - Premium URL Shortener</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root {{
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --text: #1e293b;
            --text-muted: #64748b;
        }}
        body {{
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }}
        .card {{
            background: var(--card-bg);
            padding: 2.5rem;
            border-radius: 1rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 500px;
            text-align: center;
        }}
        h1 {{
            font-size: 2rem;
            margin-bottom: 0.5rem;
            color: var(--primary);
        }}
        p {{
            color: var(--text-muted);
            margin-bottom: 2rem;
        }}
        .input-group {{
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }}
        input[type="url"] {{
            padding: 0.75rem 1rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            font-size: 1rem;
            transition: border-color 0.2s;
        }}
        input[type="url"]:focus {{
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }}
        button {{
            background-color: var(--primary);
            color: white;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
        }}
        button:hover {{
            background-color: var(--primary-hover);
        }}
        .result {{
            margin-top: 2rem;
            padding: 1rem;
            background-color: #f1f5f9;
            border-radius: 0.5rem;
            text-align: left;
            word-break: break-all;
        }}
        .result a {{
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
        }}
        .result a:hover {{
            text-decoration: underline;
        }}
        .back-link {{
            display: block;
            margin-top: 1.5rem;
            font-size: 0.875rem;
            color: var(--text-muted);
            text-decoration: none;
        }}
    </style>
</head>
<body>
    <div class="card">
        {content}
    </div>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def index_page():
    content = """
        <h1>Shorty</h1>
        <p>Convert long links into powerful short URLs effortlessly.</p>
        <form action="/shorten-ui" method="post" class="input-group">
            <input type="url" name="target_url" placeholder="https://your-long-link.com" required>
            <button type="submit">Shorten URL</button>
        </form>
    """
    return HTML_TEMPLATE.format(content=content)


@app.post("/shorten-ui", response_class=HTMLResponse)
def shorten_url_ui(target_url: str = Form(...)):
    api_url = settings.API_BASE_URL.rstrip("/") + "/api/shorten"
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(api_url, json={"target_url": target_url})
        if resp.status_code == 200:
            data = resp.json()
            short_url = data.get("short_url", "")
            original = data.get("target_url", target_url)
            content = f"""
                <h1>Success!</h1>
                <p>Your premium short link is ready.</p>
                <div class="result">
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.5rem;">Short Link</div>
                    <a href="{short_url}" target="_blank">{short_url}</a>
                    <div style="margin-top: 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.5rem;">Original Destination</div>
                    <div style="font-size: 0.875rem; color: #334155;">{original}</div>
                </div>
                <a href="/" class="back-link">← Create another one</a>
            """
            return HTML_TEMPLATE.format(content=content)
        detail = resp.json().get("detail", "Unknown error") if resp.content else "Unknown error"
    except Exception as e:
        logger.error(f"Frontend error: {e}")
        detail = str(e)
    content = f"""
        <h1 style="color: #ef4444;">Oops!</h1>
        <p>We couldn't shorten that link. {detail}</p>
        <a href="/" class="back-link">← Try again</a>
    """
    return HTML_TEMPLATE.format(content=content)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
