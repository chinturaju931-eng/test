from playwright.sync_api import sync_playwright
import subprocess, tempfile, os, time, urllib.request
from pathlib import Path
with tempfile.TemporaryDirectory(prefix='commuteads-ui-') as data:
    server = subprocess.Popen(['node','server.js'], cwd=Path(__file__).resolve().parents[1], env={**os.environ, 'PORT':'3101','DATA_DIR':data,'SETUP_CODE':'browser-test-setup-only-123456789','NODE_ENV':'development'}, stdout=subprocess.PIPE)
    try:
        for i in range(40):
            try:
                urllib.request.urlopen('http://127.0.0.1:3101/api/state',timeout=1)
                break
            except OSError: time.sleep(.1)
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            page=browser.new_page(viewport={'width':1440,'height':1100})
            page.set_default_timeout(10000)
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto('http://127.0.0.1:3101/#setup=browser-test-setup-only-123456789')
            page.get_by_label('Your name',exact=True).fill('Workspace Owner')
            page.get_by_label('Email',exact=True).fill('owner@example.com')
            page.get_by_label('Password',exact=True).fill('Owner-browser-password')
            page.get_by_role('button',name='Create owner account',exact=True).click()
            page.get_by_role('heading',name='Your brand. In motion.').wait_for()
            page.screenshot(path='/tmp/commuteads-desktop.png',full_page=True)
            page.get_by_role('button',name='Content calendar',exact=True).click()
            page.get_by_label('What are you promoting?').fill('a Hyderabad retail launch')
            page.get_by_role('button',name='Generate 3 post drafts').click()
            page.get_by_role('heading',name='Meet your next audience').wait_for()
            assert page.locator('.draft-card').count()==3
            page.get_by_role('button',name='Edit',exact=True).first.click()
            page.get_by_label('Draft content').fill('A verified campaign idea from CommuteAds.')
            page.get_by_role('button',name='Save changes',exact=True).click()
            page.get_by_text('A verified campaign idea from CommuteAds.').wait_for()
            page.get_by_role('button',name='Approve',exact=True).first.click()
            page.get_by_label('Plan publish time (IST)').first.fill('2099-01-01T10:00')
            page.get_by_role('button',name='Save date',exact=True).first.click()
            page.get_by_text('Planned:',exact=False).wait_for()
            page.get_by_role('button',name='Leads & outreach',exact=True).click()
            page.get_by_label('Company',exact=True).fill('Example brand')
            page.get_by_label('Contact name',exact=True).fill('Priya')
            page.get_by_role('button',name='Add prospect',exact=False).click()
            page.get_by_role('button',name='Draft message',exact=True).click()
            page.get_by_role('heading',name='Introduction to Example brand').wait_for()
            page.get_by_role('button',name='Opt out',exact=True).click()
            page.get_by_text('Do not contact',exact=True).wait_for()
            page.get_by_role('button',name='Comment studio',exact=True).click()
            page.get_by_label('Brand or competitor').fill('Example media')
            page.get_by_label('Paste the post').fill('Our new Hyderabad campaign.')
            page.get_by_label('Your specific observation').fill('The local creative stands out.')
            page.get_by_role('button',name='Prepare comment draft',exact=False).click()
            page.get_by_role('heading',name='Example media',exact=True).wait_for()
            page.get_by_role('button',name='Brand settings',exact=True).click()
            page.get_by_label('Contact or booking information').fill('hello@example.com')
            with page.expect_response('**/api/profile'):
                page.get_by_role('button',name='Save brand settings').click()
            page.reload()
            page.get_by_role('button',name='Brand settings',exact=True).click()
            assert page.get_by_label('Contact or booking information').input_value()=='hello@example.com'
            page.get_by_role('button',name='Overview',exact=True).click()
            page.set_viewport_size({'width':390,'height':844})
            page.screenshot(path='/tmp/commuteads-mobile.png',full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile horizontal overflow'
            page.set_viewport_size({'width':1440,'height':1000})
            page.get_by_role('button',name='Team & account',exact=True).click()
            page.get_by_label('Name',exact=True).fill('Test Teammate')
            page.get_by_label('Email',exact=True).fill('teammate@example.com')
            page.get_by_label('Initial password',exact=True).fill('Member-browser-password')
            page.get_by_role('button',name='Create team account',exact=True).click()
            page.get_by_role('button',name='Remove access',exact=True).wait_for()
            guest=browser.new_context()
            other=guest.new_page()
            other.clock.install()
            other.goto('http://127.0.0.1:3101/')
            other.get_by_role('heading',name='Welcome back.').wait_for()
            assert guest.request.get('http://127.0.0.1:3101/api/state').status==401
            other.get_by_label('Email',exact=True).fill('teammate@example.com')
            other.get_by_label('Password',exact=True).fill('Member-browser-password')
            other.get_by_role('button',name='Sign in',exact=True).click()
            other.get_by_role('heading',name='Your brand. In motion.').wait_for()
            other.get_by_role('button',name='Team & account',exact=True).click()
            assert other.get_by_role('heading',name='Add a teammate').count()==0
            assert guest.request.post('http://127.0.0.1:3101/api/team/list',data={}).status==403
            other.get_by_role('button',name='Leads & outreach',exact=True).click()
            other.get_by_label('Company',exact=True).fill('Unsaved company input')
            assert page.request.post('http://127.0.0.1:3101/api/leads',data={'company':'Shared sync brand'}).status==200
            other.clock.fast_forward(21000)
            assert other.get_by_label('Company',exact=True).input_value()=='Unsaved company input'
            other.get_by_role('button',name='Overview',exact=True).click()
            other.clock.fast_forward(21000)
            other.get_by_text('Shared sync brand',exact=True).wait_for()
            page.get_by_role('button',name='Remove access',exact=True).click()
            page.get_by_text('Team access removed.',exact=True).wait_for()
            assert guest.request.get('http://127.0.0.1:3101/api/state').status==401
            other.get_by_role('button',name='Refresh',exact=True).click()
            other.get_by_role('heading',name='Welcome back.').wait_for()
            page.get_by_role('button',name='Sign out',exact=True).click()
            page.get_by_role('heading',name='Welcome back.').wait_for()
            page.screenshot(path='/tmp/commuteads-team-login.png',full_page=True)
            assert not errors, errors
            browser.close()
            print('Browser checks passed: owner setup, private login, team permissions, access revocation, desktop and mobile; posts, editing, approvals, dates, leads, opt-outs, comments, settings persistence; no JS errors.')
    finally:
        server.terminate()
        server.wait(timeout=10)
