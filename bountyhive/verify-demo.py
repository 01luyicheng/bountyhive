from playwright.sync_api import sync_playwright
import time
import os

ROOT = r'C:\Users\21601\Documents\project\evomap\bountyhive'

def save_screenshot(page, name):
    path = os.path.join(ROOT, f'verify-{name}.png')
    page.screenshot(path=path, full_page=True)
    print(f'screenshot: {path}')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    print('page loaded')
    save_screenshot(page, 'initial')

    # initial state checks
    status_text = page.locator('text=IDLE').first.inner_text(timeout=5000)
    print(f'initial status: {status_text}')

    # click start demo
    start_btn = page.locator('button:has-text("启动 Demo")').first
    start_btn.click()
    print('clicked start demo')
    save_screenshot(page, 'started')

    # wait for demo to complete (mock ~20s)
    print('waiting for demo to complete...')
    page.wait_for_selector('text=DONE', timeout=60000)
    print('status reached DONE')

    # wait a bit for logs to settle
    time.sleep(2)
    save_screenshot(page, 'completed')

    # read status values
    phase = page.locator('text=/phase/i').first.inner_text() if page.locator('text=/phase/i').count() > 0 else 'N/A'
    elapsed = page.locator('text=/elapsed/i').first.inner_text() if page.locator('text=/elapsed/i').count() > 0 else 'N/A'
    steps = page.locator('text=/steps/i').first.inner_text() if page.locator('text=/steps/i').count() > 0 else 'N/A'
    run_id = page.locator('text=/run_id/i').first.inner_text() if page.locator('text=/run_id/i').count() > 0 else 'N/A'
    logs_line = page.locator('text=/demo_logs/i').first.inner_text() if page.locator('text=/demo_logs/i').count() > 0 else 'N/A'

    print('--- final status ---')
    print(f'phase label: {phase}')
    print(f'elapsed: {elapsed}')
    print(f'steps: {steps}')
    print(f'run_id: {run_id}')
    print(f'logs header: {logs_line}')

    # verify key points
    page_content = page.content()
    assert 'DONE' in page_content, 'expected DONE status'
    assert 'run_' in page_content, 'expected run_id'

    browser.close()
    print('verification done')
