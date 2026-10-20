"""
FreBook portal worker — live Income-tax portal fetch, nothing stored.

FreBook (on Vercel) can't run a browser, so this small service does: it opens the
e-filing portal in headless Chrome, logs in with the PAN + password the taxpayer
just typed, asks FreBook for the OTP when the portal wants one, then downloads the
requested documents (notices, 26AS, AIS, TIS, filed-return list) and hands them
back. It logs out, closes the browser and forgets the password as soon as the
login step is done. Nothing is written to disk except failure screenshots, which
are returned to FreBook and deleted.

Login steps are adapted from CSWA Notice Sentinel (app/fetchers/it_portal.py),
where they were checked against the live portal. OTP entry and the 26AS / AIS /
TIS navigation are NEW and UNVERIFIED: every step reports what it reached and
returns a screenshot on failure so selectors can be tuned after a real run.

Run:   pip install -r requirements.txt  &&  python -m playwright install-deps (Linux only)
       set WORKER_KEY=<long random secret, same value as PORTAL_WORKER_KEY in Vercel>
       uvicorn worker:app --host 127.0.0.1 --port 8765
Expose it to FreBook through a Cloudflare tunnel (HTTPS); never on plain HTTP.
"""
from __future__ import annotations

import asyncio
import base64
import hmac
import os
import re
import secrets
import time
from dataclasses import dataclass, field

from fastapi import FastAPI, Header, HTTPException
from playwright.async_api import Browser, Page, async_playwright
from pydantic import BaseModel

WORKER_KEY = os.environ.get("WORKER_KEY", "")
SESSION_TTL = 15 * 60          # a session (browser + page) lives at most 15 minutes
LOGIN_URL = "https://eportal.incometax.gov.in/iec/foservices/#/login"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"

OTP_MARKERS = ["Enter OTP", "OTP sent", "digit OTP", "One Time Password"]
BAD_PASSWORD_MARKERS = ["Invalid Password", "incorrect password", "does not match"]
PAN_NOT_FOUND = "PAN does not exist"
DUAL_LOGIN = "Dual Login Detected"
SECURE_ACCESS = "confirm your secure access message"

app = FastAPI(title="FreBook portal worker", docs_url=None, redoc_url=None)


@dataclass
class Sess:
    pan: str
    pw: object
    browser: Browser
    page: Page
    created: float = field(default_factory=time.time)
    state: str = "new"          # otp_required | logged_in | closed


SESSIONS: dict[str, Sess] = {}


class StepError(Exception):
    def __init__(self, message: str, screenshot: str | None = None):
        super().__init__(message)
        self.screenshot = screenshot


def _auth(key: str | None) -> None:
    if not WORKER_KEY or not key or not hmac.compare_digest(key.encode(), WORKER_KEY.encode()):
        raise HTTPException(status_code=401, detail="Not allowed")


async def _shot(page: Page) -> str | None:
    try:
        return base64.b64encode(await page.screenshot(type="jpeg", quality=60)).decode()
    except Exception:
        return None


async def _visible(page: Page, marker: str) -> bool:
    loc = page.get_by_text(marker, exact=False)
    for i in range(await loc.count()):
        try:
            if await loc.nth(i).is_visible():
                return True
        except Exception:
            continue
    return False


async def _continue(page: Page) -> None:
    btn = page.get_by_role("button", name="Continue", exact=True).first
    await btn.wait_for(state="visible", timeout=15000)
    await btn.click(timeout=10000)


async def _loader_gone(page: Page) -> None:
    try:
        await page.locator(".customLoaderBackdrop").wait_for(state="hidden", timeout=20000)
    except Exception:
        pass


async def _security_popup(page: Page) -> None:
    """'For security reasons… Are you sure you want to Logout?' — always answer No (Sentinel-verified)."""
    pop = page.locator("#securityReasonPopup")
    try:
        if await pop.count() and await pop.first.is_visible():
            no = pop.get_by_role("button", name="No", exact=True).first
            if await no.count():
                await no.click(timeout=3000)
    except Exception:
        pass


async def _dual_login(page: Page) -> None:
    if not await _visible(page, DUAL_LOGIN):
        return
    btn = page.get_by_role("button", name="Login Here", exact=True).first
    if not await btn.count():
        btn = page.get_by_text("Login Here", exact=False).first
    if await btn.count():
        await btn.click(timeout=10000)
        await page.wait_for_timeout(1500)


async def _settle(page: Page, timeout_ms: int = 20000) -> None:
    waited = 0
    while waited < timeout_ms:
        if await _visible(page, DUAL_LOGIN):
            return
        for m in OTP_MARKERS + BAD_PASSWORD_MARKERS:
            if await _visible(page, m):
                return
        if await page.locator("input[type='password']").count() == 0 and not await _visible(page, "Loading"):
            return
        await page.wait_for_timeout(500)
        waited += 500


async def _is_otp(page: Page) -> bool:
    for m in OTP_MARKERS:
        if await _visible(page, m):
            return True
    return False


async def _go(page: Page, *labels: str) -> bool:
    for label in labels:
        await _loader_gone(page)
        await _security_popup(page)
        link = page.get_by_text(label, exact=False).first
        if not await link.count():
            return False
        await link.click(timeout=15000)
        await _loader_gone(page)
        await page.wait_for_timeout(1500)
    return True


async def _logout_and_close(s: Sess) -> None:
    try:
        await _dual_login(s.page)
        link = s.page.get_by_text("Logout", exact=False).first
        if not await link.count() or not await link.is_visible():
            menu = s.page.locator("text=/Individual|HUF|Company|AOP|Firm/").first
            if await menu.count():
                await menu.click(timeout=5000)
                await s.page.wait_for_timeout(800)
                link = s.page.get_by_text("Logout", exact=False).first
        if await link.count() and await link.is_visible():
            await link.click(timeout=5000)
    except Exception:
        pass
    try:
        await s.browser.close()
        await s.pw.stop()  # type: ignore[attr-defined]
    except Exception:
        pass
    s.state = "closed"


async def _reaper() -> None:
    while True:
        await asyncio.sleep(30)
        for sid, s in list(SESSIONS.items()):
            if time.time() - s.created > SESSION_TTL:
                SESSIONS.pop(sid, None)
                await _logout_and_close(s)


@app.on_event("startup")
async def _start() -> None:
    asyncio.create_task(_reaper())


# ── API ──────────────────────────────────────────────────────────────────────
class StartBody(BaseModel):
    pan: str
    password: str


class OtpBody(BaseModel):
    session: str
    otp: str


class FetchBody(BaseModel):
    session: str
    items: list[str]            # notices, 26as, ais, tis, filed_returns
    fy: str | None = None       # "2025-26" (financial year) for 26AS / AIS / TIS


class CloseBody(BaseModel):
    session: str


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "sessions": len(SESSIONS)}


@app.post("/it/start")
async def it_start(body: StartBody, x_worker_key: str | None = Header(default=None)) -> dict:
    _auth(x_worker_key)
    pan = body.pan.strip().upper()
    if not re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", pan):
        raise HTTPException(400, "Enter a valid PAN.")
    pw = await async_playwright().start()
    # System Chrome (signed) — some office PCs block Playwright's bundled Chromium
    browser = await pw.chromium.launch(headless=True, channel="chrome", args=["--disable-blink-features=AutomationControlled"])
    ctx = await browser.new_context(user_agent=USER_AGENT, viewport={"width": 1366, "height": 768}, accept_downloads=True)
    ctx.set_default_timeout(60000)
    page = await ctx.new_page()
    s = Sess(pan=pan, pw=pw, browser=browser, page=page)
    sid = secrets.token_urlsafe(24)
    password = body.password
    try:
        await page.goto(LOGIN_URL, wait_until="domcontentloaded")
        field_ = page.locator("#panAdhaarUserId")
        await field_.wait_for(state="visible", timeout=20000)
        await field_.fill(pan)
        await _continue(page)
        try:
            await page.get_by_text(PAN_NOT_FOUND, exact=False).wait_for(state="visible", timeout=5000)
            raise StepError("This PAN isn't registered on the e-filing portal.")
        except StepError:
            raise
        except Exception:
            pass
        if await _is_otp(page):
            s.state = "otp_required"
        else:
            pwd = page.locator("input[type='password']")
            await pwd.wait_for(state="visible", timeout=20000)
            await pwd.fill(password)
            box = page.get_by_role("checkbox", name=re.compile(re.escape(SECURE_ACCESS), re.I))
            if await box.count():
                if not await box.first.is_checked():
                    await box.first.check()
            else:
                lbl = page.get_by_text(SECURE_ACCESS, exact=False).first
                if await lbl.count():
                    await lbl.click()
            await _continue(page)
            await _settle(page)
            await _dual_login(page)
            for m in BAD_PASSWORD_MARKERS:
                if await _visible(page, m):
                    raise StepError("The portal didn't accept that password.")
            s.state = "otp_required" if await _is_otp(page) else "logged_in"
    except StepError as e:
        shot = await _shot(page)
        await _logout_and_close(s)
        raise HTTPException(400, {"message": str(e), "screenshot": shot})
    except Exception as e:  # noqa: BLE001
        shot = await _shot(page)
        await _logout_and_close(s)
        raise HTTPException(502, {"message": f"Couldn't reach the login step: {e}", "screenshot": shot})
    finally:
        password = ""  # noqa: F841 — the password is never kept beyond this call
    SESSIONS[sid] = s
    return {"session": sid, "state": s.state}


@app.post("/it/otp")
async def it_otp(body: OtpBody, x_worker_key: str | None = Header(default=None)) -> dict:
    _auth(x_worker_key)
    s = SESSIONS.get(body.session)
    if not s:
        raise HTTPException(404, "The portal session has ended. Start again.")
    otp = re.sub(r"\D", "", body.otp)
    page = s.page
    try:
        # UNVERIFIED: the portal shows either one OTP box or six single-digit boxes
        boxes = page.locator("input[maxlength='1']")
        if await boxes.count() >= 4:
            for i, d in enumerate(otp[: await boxes.count()]):
                await boxes.nth(i).fill(d)
        else:
            one = page.locator("input[type='tel'], input[type='text'][maxlength='6'], input[name*='otp' i], input[id*='otp' i]").first
            await one.fill(otp)
        btn = page.get_by_role("button", name=re.compile(r"^(Login|Validate|Continue|Submit)$", re.I)).first
        await btn.click(timeout=10000)
        await _settle(page)
        await _dual_login(page)
        if await _is_otp(page) and await _visible(page, "invalid"):
            raise StepError("The portal didn't accept that OTP.")
        s.state = "logged_in"
        return {"state": s.state}
    except StepError as e:
        raise HTTPException(400, {"message": str(e), "screenshot": await _shot(page)})
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, {"message": f"OTP step failed: {e}", "screenshot": await _shot(page)})


async def _download_click(page: Page, locator, timeout: int = 30000) -> tuple[str, bytes] | None:
    try:
        async with page.expect_download(timeout=timeout) as info:
            await locator.click(timeout=10000)
        dl = await info.value
        path = await dl.path()
        data = open(path, "rb").read() if path else b""
        return (dl.suggested_filename or "document", data)
    except Exception:
        return None


async def _fetch_notices(page: Page) -> tuple[list[dict], list[tuple[str, bytes]]]:
    """Pending Actions → e-Proceedings / Worklist / Outstanding Demand (Sentinel-verified navigation); text + any PDFs."""
    found: list[dict] = []
    files: list[tuple[str, bytes]] = []
    for labels, name in [(("Pending Actions", "e-Proceedings"), "e-Proceedings"), (("Pending Actions", "Worklist"), "Worklist"),
                         (("Pending Actions", "Response to Outstanding Demand"), "Outstanding demand")]:
        await _go(page, "Dashboard")
        if not await _go(page, *labels):
            continue
        text = (await page.locator("body").inner_text())[:20000]
        found.append({"section": name, "text": text})
        links = page.locator("a:has-text('Download'), button:has-text('Download'), a:has-text('PDF')")
        for i in range(min(await links.count(), 15)):
            got = await _download_click(page, links.nth(i), 15000)
            if got:
                files.append((f"{name} - {got[0]}", got[1]))
    return found, files


async def _fetch_ais_tis(page: Page, fy: str | None, want: set[str]) -> tuple[list[str], list[tuple[str, bytes]]]:
    """UNVERIFIED: Services → Annual Information Statement (AIS) → Proceed → new tab (AIS portal) → AIS / TIS download."""
    notes: list[str] = []
    files: list[tuple[str, bytes]] = []
    await _go(page, "Dashboard")
    if not await _go(page, "AIS") and not await _go(page, "Services", "Annual Information Statement"):
        return ["AIS menu not found"], files
    try:
        async with page.context.expect_page(timeout=30000) as newp:
            proceed = page.get_by_role("button", name=re.compile("Proceed", re.I)).first
            await proceed.click(timeout=10000)
        ais = await newp.value
        await ais.wait_for_load_state("domcontentloaded")
        await ais.wait_for_timeout(4000)
        if fy:
            sel = ais.locator("select").first
            if await sel.count():
                try:
                    await sel.select_option(label=re.compile(fy.replace("-", r"\s*-\s*")))  # type: ignore[arg-type]
                except Exception:
                    notes.append(f"Couldn't choose FY {fy}; downloaded the default year")
        for kind, label in [("tis", "Taxpayer Information Summary"), ("ais", "Annual Information Statement")]:
            if kind not in want:
                continue
            tile = ais.get_by_text(label, exact=False).first
            if not await tile.count():
                notes.append(f"{kind.upper()} tile not found")
                continue
            container = tile.locator("xpath=ancestor::*[.//*[contains(.,'Download')]][1]")
            btn = container.get_by_text("Download", exact=False).first
            if not await btn.count():
                notes.append(f"{kind.upper()} download button not found")
                continue
            await btn.click(timeout=10000)
            await ais.wait_for_timeout(1500)
            pdf = ais.get_by_text("PDF", exact=False).first
            got = await _download_click(ais, pdf if await pdf.count() else btn, 45000)
            if got:
                files.append((f"{kind.upper()} - {got[0]}", got[1]))
            else:
                notes.append(f"{kind.upper()} download didn't start")
        await ais.close()
    except Exception as e:  # noqa: BLE001
        notes.append(f"AIS portal step failed: {e}")
    return notes, files


async def _fetch_26as(page: Page, fy: str | None) -> tuple[list[str], list[tuple[str, bytes]]]:
    """UNVERIFIED: e-File → Income Tax Returns → View Form 26AS → Confirm → TRACES → View Tax Credit → AY → PDF."""
    notes: list[str] = []
    files: list[tuple[str, bytes]] = []
    await _go(page, "Dashboard")
    if not await _go(page, "e-File", "Income Tax Returns", "View Form 26AS"):
        return ["26AS menu not found"], files
    try:
        async with page.context.expect_page(timeout=30000) as newp:
            await page.get_by_role("button", name=re.compile("Confirm", re.I)).first.click(timeout=10000)
        tr = await newp.value
        await tr.wait_for_load_state("domcontentloaded")
        await tr.wait_for_timeout(3000)
        box = tr.locator("input[type='checkbox']").first
        if await box.count():
            await box.check()
            proceed = tr.get_by_role("button", name=re.compile("Proceed", re.I)).first
            if await proceed.count():
                await proceed.click()
                await tr.wait_for_timeout(2500)
        link = tr.get_by_text("View Tax Credit", exact=False).first
        if await link.count():
            await link.click()
            await tr.wait_for_timeout(2500)
        if fy:
            ay = f"{int(fy[:4]) + 1}-{str(int(fy[:4]) + 2)[2:]}"
            sel = tr.locator("select#AssessmentYearDropDown, select[name*='ssessment' i]").first
            if await sel.count():
                await sel.select_option(label=re.compile(ay.split('-')[0]))  # type: ignore[arg-type]
        fmt = tr.locator("select#viewType, select[name*='view' i]").first
        if await fmt.count():
            try:
                await fmt.select_option(label="HTML")
            except Exception:
                pass
        view = tr.get_by_role("button", name=re.compile("View ?/ ?Download", re.I)).first
        if await view.count():
            await view.click()
            await tr.wait_for_timeout(4000)
        export = tr.get_by_text("Export as PDF", exact=False).first
        got = await _download_click(tr, export, 45000) if await export.count() else None
        if got:
            files.append((f"26AS - {got[0]}", got[1]))
        else:
            notes.append("26AS download didn't start (TRACES step) — screenshot attached")
        await tr.close()
    except Exception as e:  # noqa: BLE001
        notes.append(f"TRACES step failed: {e}")
    return notes, files


@app.post("/it/fetch")
async def it_fetch(body: FetchBody, x_worker_key: str | None = Header(default=None)) -> dict:
    _auth(x_worker_key)
    s = SESSIONS.get(body.session)
    if not s or s.state != "logged_in":
        raise HTTPException(409, "Not logged in yet.")
    page = s.page
    want = {i.lower() for i in body.items}
    out_files: list[dict] = []
    report: list[dict] = []
    shots: list[str] = []

    def add(kind: str, name: str, data: bytes) -> None:
        if data and len(data) < 15 * 1024 * 1024:
            out_files.append({"kind": kind, "name": name, "data": base64.b64encode(data).decode()})

    if "notices" in want:
        sections, files = await _fetch_notices(page)
        for n, d in files:
            add("notice", n, d)
        report.append({"item": "notices", "ok": bool(sections), "note": f"{len(sections)} sections read, {len(files)} documents"})
        for sec in sections:
            add("notice_text", f"{sec['section']}.txt", sec["text"].encode())
    if "filed_returns" in want:
        await _go(page, "Dashboard")
        ok = await _go(page, "e-File", "Income Tax Returns", "View Filed Returns")
        if ok:
            add("filed_returns", "Filed returns.txt", (await page.locator("body").inner_text())[:20000].encode())
        report.append({"item": "filed_returns", "ok": ok, "note": "Filed return list saved" if ok else "Page not found"})
    if want & {"ais", "tis"}:
        notes, files = await _fetch_ais_tis(page, body.fy, want)
        for n, d in files:
            add("ais" if n.startswith("AIS") else "tis", n, d)
        report.append({"item": "ais/tis", "ok": bool(files), "note": "; ".join(notes) or f"{len(files)} files"})
        if not files:
            sh = await _shot(page)
            if sh:
                shots.append(sh)
    if "26as" in want:
        notes, files = await _fetch_26as(page, body.fy)
        for n, d in files:
            add("26as", n, d)
        report.append({"item": "26as", "ok": bool(files), "note": "; ".join(notes) or "Downloaded"})
        if not files:
            sh = await _shot(page)
            if sh:
                shots.append(sh)
    return {"files": out_files, "report": report, "screenshots": shots[:2]}


@app.post("/it/close")
async def it_close(body: CloseBody, x_worker_key: str | None = Header(default=None)) -> dict:
    _auth(x_worker_key)
    s = SESSIONS.pop(body.session, None)
    if s:
        await _logout_and_close(s)
    return {"ok": True}
