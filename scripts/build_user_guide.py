"""Build the public user guide. Documentation-only dependency: reportlab."""
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'storage-social-user-guide.pdf'
GREEN = HexColor('#123c35')
GRAY = HexColor('#53635e')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleSS', fontName='Helvetica-Bold', fontSize=27, leading=31, textColor=GREEN, spaceAfter=14))
styles.add(ParagraphStyle(name='IntroSS', fontName='Helvetica', fontSize=12, leading=17, textColor=GRAY, spaceAfter=18))
styles.add(ParagraphStyle(name='BodySS', fontName='Helvetica', fontSize=11, leading=15.5, spaceAfter=10, textColor=HexColor('#253530')))
styles.add(ParagraphStyle(name='HeadSS', fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=GREEN, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='SmallSS', fontName='Helvetica', fontSize=9, leading=12, textColor=GRAY, spaceAfter=7))
story = []
def p(text, style='BodySS'): return Paragraph(text, styles[style])
def title(text, sub): story.extend([p(text,'TitleSS'), p(sub,'IntroSS')])
def section(head, text): story.append(KeepTogether([p(head,'HeadSS'),p(text)]))
def step(n, head, text): section(f'{n}. {head}', text)
def box(head, text):
    t=Table([[p(head,'HeadSS')],[p(text)]],colWidths=[480])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),HexColor('#eef5f1')),('BOX',(0,0),(-1,-1),0.6,HexColor('#cddfd5')),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story.extend([Spacer(1,8),t,Spacer(1,10)])
def link(url,label): return f'<link href="{url}" color="#136854"><u>{label}</u></link>'
def page(): story.append(PageBreak())

title('Storage Social', 'Simple user guide | Updated September 22, 2026')
box('New: replace your AI key', 'The step-by-step owner checklist is on <b>pages 7-8</b>. The current key was shown as expiring on <b>October 22, 2026</b>. Plan to replace it by <b>October 15</b>, and check the date shown in OpenAI before you begin.')
section('Open your workspace', f'Go to {link("https://social.storageaz.com","social.storageaz.com")} and sign in. The Planner is where you create posts and check their status.')
section('Choose the right type of post', '<b>Photo post:</b> product pictures.<br/><b>Video post:</b> a finished video file. Keep these two upload workflows separate.')
section('You stay in control', 'AI captions are optional and currently enabled. AI provides suggestions; you review the facts and decide what to save, schedule or publish. It does not create your photos or videos.')
section('Find what you need', '2 - Create a photo post<br/>3 - Create a video post<br/>4 - Save, review and schedule<br/>5 - Accounts, media, backups and GitHub<br/>6 - Use AI captions and follow a daily routine<br/>7 - Create and install a replacement API key<br/>8 - Test the new key and retire the old one')
page()

title('Create a photo post', 'Use this when you have pictures of a product, storage unit, promotion or event.')
step(1,'Start a new post','In Planner, choose <b>Photo post</b>. Give the post a clear internal name so you can find it later.')
step(2,'Enter product facts','Open <b>Product details</b>. Add the product name and confirmed features. Include the price or offer only when you know it is correct.')
step(3,'Add your pictures','Drop photos into the upload area or choose files from your computer. Use <b>Browse library</b> to reuse an earlier upload.')
step(4,'Choose the best order','Put the strongest picture first. Reorder pictures as needed. Cropping creates a new JPEG copy; your original remains unchanged.')
step(5,'Write or draft your caption','Write your own caption, use <b>Insert these details into caption</b> for your exact facts, or choose <b>Draft with AI</b>. Page 6 explains the AI review step.')
step(6,'Select destinations and save','Choose the location and social destinations. Customize platform captions where needed. Check the preview, then choose <b>Save draft</b>.')
box('Before you save','Check photos, spelling, prices, dates, product facts and links. AI can make mistakes. A photo alone does not confirm a product\'s size, condition, price or availability.')
page()

title('Create a video post', 'Upload a finished video through the separate video workflow.')
step(1,'Choose Video post','Start from Planner. Do not put a video into the photo-post workflow.')
step(2,'Upload the finished file','Choose an MP4 or MOV video. Wait for the upload to finish before leaving the page. The app currently allows up to 250 MB; destinations may have additional limits.')
step(3,'Add the story','Enter a title and caption. If using AI, write a short description of what happens in the video. <b>The assistant does not watch, send, edit or generate the video.</b>')
step(4,'Choose destinations','Select the channels you want. Complete any required Facebook, Pinterest, TikTok or YouTube fields shown by the app. Review visibility and audience choices carefully.')
step(5,'Review and save','Check the video, wording and selected destinations. Choose <b>Save draft</b> when it needs another review. Use the normal scheduling flow only when ready.')
box('Good video habits','Keep the opening clear. Use a title that explains what the viewer will see. Confirm every product claim and keep an original copy of the video in your company storage.')
page()

title('Save, review and schedule', 'Saving a draft does not publish it.')
step(1,'Save your work','Choose <b>Save draft</b>. Reopen it from Planner whenever you want to edit it.')
step(2,'Get approval when required','If your workspace requires approval, submit the post for review and wait for an approver. Follow the status shown in the app.')
step(3,'Choose a time','Set the date and time. This workspace uses <b>America/Phoenix</b>. Confirm the time zone before you schedule.')
step(4,'Review the final details','Choose <b>Review &amp; schedule</b> and follow the prompts. Check destinations, required fields and media. Live publishing requires connected, authorized accounts.')
step(5,'Check the result','Use List or Calendar in Planner. Return later to check actual delivery status. Scheduling does not guarantee every platform will accept a post.')
section('What the status means','<b>Draft:</b> still being prepared.<br/><b>Pending approval:</b> waiting for review.<br/><b>Approved / Scheduled:</b> approved or planned for later.<br/><b>Published:</b> all selected destinations confirmed publication.<br/><b>Partial:</b> results differ across destinations; read each result.<br/><b>Needs attention:</b> open the post and fix the issue shown.')
page()

title('Accounts, backups and GitHub', 'Your source code and your business content have different homes.')
section('Social accounts','Open <b>Social accounts</b> to review connections. Upload-Post connects the supported destinations. Google Business Profile, Facebook, Instagram, Pinterest, TikTok and YouTube have different requirements. AI billing does not connect these social accounts.')
section('Media library','Reuse uploaded photos and videos when appropriate. Keep original files in your normal company storage as well.')
step(1,'Download a full backup','Open <b>Settings &gt; Download full backup</b>. Do this before changing hosting configuration and regularly during normal use.')
step(2,'Keep it private','Save the backup in secure company storage. It includes posts, media, user records and sign-in information. Do not upload it to GitHub or send it casually by email.')
section('Yes, the app is in GitHub', f'{link("https://github.com/FirstFruitsApps/Social-Media-Posting-app","FirstFruitsApps / Social-Media-Posting-app")} stores the app source, tests and guides. The repository is currently public. It does <b>not</b> back up your live posts, photos, videos, passwords or API keys.')
box('Hosting setting to preserve','The app uses a private persistent data folder so content survives updates. In Hostinger, leave <b>DATA_DIR</b> unchanged. It points outside the deployment folders. Ask for help if it is missing.')
page()

title('Use AI captions', 'A first draft to review, not an automatic social post.')
step(1,'Prepare the post','Choose Photo post or Video post. Enter confirmed product facts and select destinations. For photos, upload your product pictures first.')
step(2,'Choose Draft with AI','Add helpful notes. For a video, describe what happens. Read the disclosure, then choose <b>Send to OpenAI &amp; draft</b>. This makes a paid API request.')
step(3,'Review the suggestions','Check the shared caption, platform captions and facts to confirm. Choose <b>Use suggestions</b> to put them into the unsaved post, or <b>Discard</b> to leave your wording unchanged.')
step(4,'Save when ready','Edit any wording you want, then choose <b>Save draft</b>. Scheduling and publication are separate steps.')
section('What goes to OpenAI','The assistant sends your company/location name, product facts, link, notes and selected destinations. Photo requests also send the first three selected pictures, up to 20 MB combined. Video requests send the written description only.')
section('Cost and controls','Owners can turn AI on or off in Settings. The current app allowance is <b>$10 per UTC month</b>, with at most <b>100 attempts</b>. The displayed cost is an estimate, not an account-wide billing cap. API credits are separate from ChatGPT. Check OpenAI billing for actual charges and any auto-reload settings.')
box('Daily routine','Collect your media. Create a draft. Review facts and pictures. Schedule only when ready. Check the delivery status later.')
page()

title('Replace the API key', 'Owner checklist - part 1 of 2')
box('When to do this','The current key was shown as expiring <b>October 22, 2026</b> when checked on September 22. Aim to finish by <b>October 15</b>. Verify the actual date in OpenAI. After replacing it, record the new expiry date.')
step(1,'Back up the app','In Storage Social, open <b>Settings &gt; Download full backup</b>. Keep it private. Have your OpenAI and Hostinger sign-ins ready.')
step(2,'Create a new OpenAI key',f'Open {link("https://platform.openai.com/api-keys","OpenAI API keys")}. Use the same organization and project as the existing Storage Social key. Choose <b>Create new secret key</b>. Give it a clear name such as <b>Storage Social - October 2026</b>. Review its permissions and expiry; it must allow the app to create Responses. Do not create an organization admin key.')
step(3,'Store the new key securely','Copy the new secret when it is shown and keep it in your password manager. Do not put it in this PDF, GitHub, email or chat. <b>Keep the old key active until the new one passes the test on page 8.</b>')
step(4,'Replace the value in Hostinger',f'Open {link("https://hpanel.hostinger.com/websites/social.storageaz.com/environment-variables","Hostinger environment variables for social.storageaz.com")}. Or choose <b>Websites &gt; social.storageaz.com &gt; Environment variables</b>. Find <b>OPENAI_API_KEY</b> and replace only its value with the new secret. Keep the variable name exactly the same.')
step(5,'Apply the change','Choose <b>Apply changes</b> or the save/apply button shown. Wait for Hostinger to finish. If a redeploy is requested, choose <b>Use previous files</b> and preserve the existing settings. No new source ZIP is needed for a key replacement.')
story.append(p('<b>Leave DATA_DIR, UPLOAD_POST_API_KEY and all other settings unchanged.</b>','SmallSS'))
page()

title('Test, then retire the old key', 'Owner checklist - part 2 of 2')
step(6,'Test inside Storage Social',f'Refresh {link("https://social.storageaz.com","Storage Social")}. Check <b>Settings &gt; Enable AI captions</b>. Open a photo draft with a product picture and confirmed facts. Choose <b>Draft with AI</b>, then <b>Send to OpenAI &amp; draft</b>. A small API charge may apply. You only need to see a suggestion; do not schedule or publish the test.')
step(7,'Revoke only the old key','Once the new key works, return to OpenAI API keys. Identify the old Storage Social key by its name and expiry date. Use its menu to <b>Revoke</b> or <b>Delete</b> it and confirm. Do not revoke the new key. If the old key also powers another app, update that app first.')
step(8,'Record the next date','Keep the new key name and expiry date in your password manager. Set your own calendar reminder one week before expiry. This PDF does not create a reminder automatically.')
section('If the test fails','<b>Authorization error:</b> confirm the correct key was pasted, with no extra spaces, and the change was applied. Check the project and key permissions.<br/><b>Billing or rate limit:</b> check API credits and limits in OpenAI; a replacement key does not add credits.<br/><b>Key already expired:</b> create and install a new key using page 7. Manual caption writing still works.<br/><b>Still stuck:</b> keep the old key active if valid and contact your app maintainer. Share the error message, never the secret.')
story.append(p('Useful links and sources (checked September 22, 2026):','SmallSS'))
story.append(p(link('https://platform.openai.com/settings/organization/billing/overview','OpenAI API billing')+' | '+link('https://developers.openai.com/api/reference/overview#authentication','OpenAI key security')+'<br/>'+link('https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/','Hostinger: edit environment variables'),'SmallSS'))

def furniture(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(GREEN); canvas.rect(0,756,612,36,fill=1,stroke=0)
    canvas.setFillColor(white); canvas.setFont('Helvetica-Bold',10); canvas.drawString(54,769,'STORAGE SOCIAL  /  SIMPLE USER GUIDE')
    canvas.setStrokeColor(HexColor('#d8e3dd')); canvas.line(54,44,558,44)
    canvas.setFillColor(GRAY); canvas.setFont('Helvetica',9)
    canvas.drawString(54,29,'social.storageaz.com  |  September 2026')
    canvas.drawRightString(558,29,f'{doc.page} / 8')
    canvas.restoreState()

doc=SimpleDocTemplate(str(OUT),pagesize=letter,rightMargin=54,leftMargin=54,topMargin=58,bottomMargin=58,title='Storage Social - Simple user guide and API key replacement',author='Advanced Storage')
doc.build(story,onFirstPage=furniture,onLaterPages=furniture)
print(OUT)

