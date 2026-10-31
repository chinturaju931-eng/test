let state, viewer, teamUsers = [], view = 'overview', filter = 'all', unsavedInput = false;
let selectedDay = '', leadSearch = '', leadStage = 'all', leadOwner = 'all', approvalType = 'all';
const dayKey = value => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
let calendarMonth = dayKey(new Date()).slice(0,7);
const stageLabels = {new:'New',contacted:'Contacted',interested:'Interested',proposal:'Proposal sent',won:'Won',lost:'Lost'};
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const names = { overview: 'Overview', content: 'Content calendar', leads: 'Leads & outreach', comments: 'Comment studio', approvals: 'Approval queue', settings: 'Brand settings' };
const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const arrow = icon('<path d="M7 17 17 7M7 7h10v10"/>');
const icons = {
  overview: icon('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  content: icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3"/>'),
  leads: icon('<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5"/>'),
  comments: icon('<path d="M21 12a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/><path d="M8 9h8M8 13h5"/>'),
  approvals: icon('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 3h6M8 12l3 3 5-6"/>'),
  settings: icon('<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>')
};
const date = value => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
function toast(message, error = false) { const t = $('#toast'); t.textContent = message; t.className = error ? 'error' : ''; t.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 4500); }
async function api(path, data) {
  const response = await fetch('/api/' + path, data ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'If-Match': String(state?.version ?? 0) }, body: JSON.stringify(data) } : {});
  const result = await response.json(); if (response.status === 401) showAuth(false); if (!response.ok) throw Error(result.error || 'Request failed.');
  state = result; render(); return result;
}
const button = (label, action, id = '', cls = '') => `<button class="button ${cls}" data-action="${action}" data-id="${esc(id)}">${label.replaceAll('↗', arrow)}</button>`;
const heading = (eyebrow, title, subtitle, action = '') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
const empty = (title, description) => `<div class="empty"><span>✧</span><h3>${title}</h3><p>${description}</p></div>`;
function cards(items) {
  return items.length ? `<div class="draft-grid">${items.map(d => `<article class="draft-card"><div class="section-head"><span class="pill ${d.type}">${d.type === 'post' ? 'in · Company post' : d.type === 'message' ? '↗ · Outreach' : '☷ · Comment'}</span><span class="badge ${d.status}">${d.status}</span></div><h3>${esc(d.title)}</h3><p class="draft-body scroll-copy" tabindex="0">${esc(d.body)}</p>${d.source ? `<details><summary>Source post</summary><p class="draft-body">${esc(d.source)}</p></details>` : ''}${d.planDay ? `<p class="muted">Campaign day ${d.planDay} · ${d.language === 'both' ? 'English + Telugu' : d.language === 'te' ? 'Telugu' : 'English'}${d.scheduledAt ? '' : ' · date not assigned'}</p>` : ''}${d.scheduledAt ? `<p class="planned">▦ Planned: ${date(d.scheduledAt)} IST · manual publishing</p>` : ''}${d.reviewedBy ? `<p class="muted">${d.status === 'rejected' ? 'Rejected' : 'Reviewed'} by ${esc(d.reviewedBy)} · ${date(d.reviewedAt)} IST</p>` : ''}<details class="review-notes"><summary>Review notes (${(d.notes || []).length})</summary>${(d.notes || []).map(n=>`<div class="review-note"><strong>${esc(n.author)}</strong><small>${date(n.at)} IST</small><p>${esc(n.body)}</p></div>`).join('')}<form data-form="note" class="stack"><input type="hidden" name="id" value="${esc(d.id)}"><label>Add a review note<textarea name="note" required maxlength="1000" rows="2"></textarea></label><button class="button">Save note</button></form></details><div class="card-actions">${d.status !== 'completed' ? button('Edit', 'edit', d.id) : ''}${button('Copy text', 'copy', d.id)}${d.status === 'draft' ? button('Approve', 'approve', d.id, 'primary') : ''}${['draft','approved'].includes(d.status) ? button('Reject', 'reject', d.id, 'subtle') : ''}${d.status === 'rejected' ? button('Reopen', 'reopen', d.id) : ''}${d.status === 'approved' ? button('Mark manually completed', 'complete', d.id) : ''}${d.scheduledAt && d.status === 'approved' ? button('Remove date','unschedule',d.id,'subtle') : ''}${d.url ? `<a class="text-link" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Open LinkedIn ↗</a>` : ''}</div>${d.type === 'post' && d.status === 'approved' ? `<form data-form="schedule" class="schedule-form"><input type="hidden" name="id" value="${esc(d.id)}"><label>Plan publish time (IST)<input type="datetime-local" name="at" required value="${d.scheduledAt ? esc(new Date(new Date(d.scheduledAt).getTime()+19800000).toISOString().slice(0,16)) : ''}"></label><button class="button">Save date</button></form>` : ''}</article>`).join('')}</div>` : empty('A little blank space. A lot of possibility.', 'Create a draft to get started. Everything stays here until you choose what to do with it.');
}
function overview() {
  const drafts = state.drafts.filter(d => d.status === 'draft');
  const approved = state.drafts.filter(d => d.status === 'approved');
  const done = state.drafts.filter(d => d.status === 'completed');
  return heading('COMMUTE ADS / MARKETING STUDIO', 'Your brand. In motion.', 'Create with purpose. Connect with brands. Make every journey count.', button('＋ Create a campaign', 'navigate-content', '', 'primary')) +
    `<section class="hero"><div class="hero-topline"><span class="hero-tag"><span class="status-dot"></span> HYDERABAD, INDIA</span><span class="hero-tag">BUILT FOR BRANDS ON THE MOVE</span></div><div class="hero-center"><svg class="logo-mark" viewBox="0 0 104 90" fill="currentColor" aria-hidden="true"><path d="M28 21H60L31 66H89L74 88H14L0 66Z"/><path d="M72 0L102 45H73L60 21Z"/></svg><h2>Commute Ads</h2><p class="hero-slogan">Advertising that moves with the city.</p><p class="hero-description">Your next campaign starts here.<br>Turn a city in motion into a conversation about your brand.</p><div class="hero-actions">${button('Create your next post ↗', 'navigate-content', '', 'primary')}${button('Explore your leads', 'navigate-leads', '', 'glass')}</div></div><div class="hero-bottom"><span>IN-CAB TABLET ADVERTISING</span><span>LOCAL PRESENCE. BIG AMBITIONS.</span></div></section>` +
    `<section class="stats">${[['Drafts to review', drafts.length, 'Ready for your perspective'], ['Approved content', approved.length, 'Ready for manual sharing'], ['Prospects', state.leads.filter(l => !l.optedOut).length, 'Added by you'], ['Completed', done.length, 'Recorded manually']].map(([label,count,note]) => `<article><div class="stat-label">${label}${arrow}</div><strong>${count}</strong><small>${note}</small></article>`).join('')}</section>` +
    `${workAhead()}<div class="two-columns"><section class="panel"><div class="section-head"><h2>Your next move</h2><span class="tiny">LET’S GET MOVING</span></div><div class="steps">${[['01','Define your brand','Set your company details and contact information.','settings'],['02','Create your next campaign','Create three posts for your next campaign.','content'],['03','Find your next connection','Add a prospect and prepare a personal introduction.','leads']].map(([n,t,s,v]) => `<button class="step" data-action="navigate-${v}"><span class="step-number">${n}</span><span><strong>${t}</strong><small>${s}</small></span>${arrow}</button>`).join('')}</div></section><section class="panel"><div class="section-head"><h2>Recent activity</h2><span class="tiny">YOUR WORKSPACE</span></div>${state.activity.length ? `<div class="activity">${state.activity.slice(0,5).map(a => `<div><span class="activity-dot"></span><div><strong>${esc(a.action)}</strong><p>${esc(a.detail)}</p><small>${esc(a.actor || 'Workspace')} · ${date(a.at)} IST</small></div></div>`).join('')}</div>` : `<div class="quiet-state">${arrow}<h3>Your next chapter starts here</h3><p>Drafts, approvals, and completed tasks will appear as you work.</p></div>`}</section></div><div class="notice"><span>ⓘ</span><p><strong>You’re in control.</strong> Drafts use built-in templates. Dates are planning reminders. Copy approved content to LinkedIn and mark it completed after sharing.</p></div>`;
}
function calendar() {
  const [year,month]=calendarMonth.split('-').map(Number);
  const first=new Date(Date.UTC(year,month-1,1)), days=new Date(Date.UTC(year,month,0)).getUTCDate();
  const offset=(first.getUTCDay()+6)%7;
  const title=new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  const events=state.drafts.filter(d=>d.type==='post' && (d.status==='approved'&&d.scheduledAt || d.status==='completed'&&d.completedAt));
  let cells=Array.from({length:offset},()=>'<div class="calendar-blank" aria-hidden="true"></div>').join('');
  for(let n=1;n<=days;n++) {
    const day=calendarMonth+'-'+String(n).padStart(2,'0');
    const items=events.filter(d=>dayKey(d.status==='completed'?d.completedAt:d.scheduledAt)===day);
    const planned=items.filter(d=>d.status==='approved').length, completed=items.length-planned;
    cells+=`<button class="calendar-day ${day===dayKey(new Date())?'today':''} ${day===selectedDay?'selected':''}" data-action="calendar-day" data-id="${day}" aria-pressed="${day===selectedDay}" aria-label="${day}: ${planned} planned, ${completed} completed"><span>${n}</span>${planned?`<small class="planned-count">${planned} planned</small>`:''}${completed?`<small class="done-count">${completed} done</small>`:''}</button>`;
  }
  return `<section class="panel calendar-panel"><div class="section-head"><div><p class="eyebrow">YOUR PUBLISHING PLAN · IST</p><h2>${title}</h2></div><div class="calendar-controls">${button('Previous','calendar-prev')}${button('Today','calendar-today')}${button('Next','calendar-next')}</div></div><div class="calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid">${cells}</div><p class="muted">Choose a day to see its posts. Dates are reminders for manual publishing; completed posts appear on the day you marked them completed.</p></section>`;
}
function workAhead() {
  const now=new Date(), today=dayKey(now);
  const upcoming=state.drafts.filter(d=>d.status==='approved'&&d.scheduledAt).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)).slice(0,3);
  const due=state.leads.filter(l=>!l.optedOut&&!['won','lost'].includes(l.stage)&&l.followUp&&l.followUp<=today);
  return `<section class="panel work-ahead"><div class="section-head"><h2>What needs your attention</h2><span class="tiny">LIVE WORKSPACE COUNTS</span></div><div class="attention-grid"><button class="attention-item" data-action="navigate-approvals"><strong>${state.drafts.filter(d=>d.status==='draft').length}</strong><span>Waiting for review</span>${arrow}</button><button class="attention-item" data-action="due-leads"><strong>${due.length}</strong><span>Follow-ups due</span>${arrow}</button></div>${upcoming.length?`<div class="upcoming-list">${upcoming.map(d=>`<button data-action="open-planned" data-id="${dayKey(d.scheduledAt)}"><span><strong>${esc(d.title)}</strong><small>${date(d.scheduledAt)} IST</small></span><span class="badge ${new Date(d.scheduledAt)<now?'rejected':'approved'}">${new Date(d.scheduledAt)<now?'Overdue':'Planned'}</span></button>`).join('')}</div>`:'<p class="muted">Your upcoming posts will appear here after you approve them and set a date.</p>'}</section>`;
}
function content() {
  const posts=state.drafts.filter(d=>d.type==='post');
  const p=state.profile;
  const visible=selectedDay?posts.filter(d=>(d.status==='completed'&&d.completedAt&&dayKey(d.completedAt)===selectedDay)||(d.status==='approved'&&d.scheduledAt&&dayKey(d.scheduledAt)===selectedDay)):posts;
  return heading('A CONSISTENT PRESENCE','Content calendar','Plan, review, and prepare your next brand conversation.',button('＋ Write a post','compose','','primary'))+
    calendar()+`<div class="notice"><span>ⓘ</span><p><strong>Your content plan:</strong> One post every ${esc(p.cadenceDays)} days · ${p.languages==='both'?'English + Telugu':p.languages==='te'?'Telugu':'English'}. LinkedIn access is awaiting approval; publishing is manual.<br><strong>Audience:</strong> ${esc(p.audience)}</p></div><section class="panel section-space"><form data-form="posts" class="inline-form"><label>What are you promoting?<input name="topic" placeholder="e.g. a festive campaign for Hyderabad retailers" required maxlength="300"></label><button class="button primary">Generate 3 post drafts ↗</button></form><p class="muted">Template-based drafts · No invented reach, prices, or performance claims.</p></section><div class="section-head section-space"><h2>${selectedDay?`Posts for ${esc(selectedDay)}`:'All posts'} <span class="count">${visible.length}</span></h2>${selectedDay?button('Show all posts','calendar-clear'):''}</div>${visible.length?cards(visible):empty(selectedDay?'No posts planned for this day':'Start your next campaign',selectedDay?'Approve a post and save its date to add it to the calendar.':'Write your own post or generate a starting point above.')}`;
}
function leadPipeline() {
  const active=state.leads.filter(l=>!l.optedOut);
  return `<section class="lead-pipeline" aria-label="Lead pipeline">${Object.entries(stageLabels).map(([stage,label])=>`<button class="pipeline-stage ${leadStage===stage?'active':''}" data-action="pipeline-stage" data-id="${stage}" aria-pressed="${leadStage===stage}"><span>${label}</span><strong>${active.filter(l=>(l.stage||'new')===stage).length}</strong><small>${stage==='won'||stage==='lost'?'Closed leads':'Active conversations'}</small></button>`).join('')}</section>`;
}
function openLeadActivity(id) {
  const lead=state.leads.find(l=>l.id===id), dialog=$('#lead-activity');
  dialog.querySelector('h2').textContent=lead.company+' · Activity';
  $('#lead-timeline').innerHTML=(lead.touchpoints||[]).length?lead.touchpoints.map(t=>`<article class="review-note"><strong>${esc(t.channel.toUpperCase())} · ${esc(t.author)}</strong><small>${date(t.at)} IST</small><p>${esc(t.note)}</p></article>`).join(''):'<p class="muted">No activity recorded yet. Log calls, meetings, messages you sent manually, or internal notes.</p>';
  const f=$('#lead-log-form'); f.reset(); f.elements.id.value=id;
  f.elements.channel.innerHTML=Object.entries(lead.optedOut?{note:'Internal note'}:{call:'Phone call',email:'Email',linkedin:'LinkedIn message',meeting:'Meeting',note:'Internal note'}).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  if(!dialog.open) dialog.showModal();
}
function leads() {
  const visibleLeads=state.leads.filter(l=>(leadOwner==='all'||leadOwner==='mine'&&l.assigneeId===viewer.id||leadOwner==='unassigned'&&!l.assigneeId) && [l.company,l.name,l.sector].join(' ').toLowerCase().includes(leadSearch.toLowerCase()) && (leadStage==='all' || leadStage==='due'&& !l.optedOut&&!['won','lost'].includes(l.stage)&&l.followUp&&l.followUp<=dayKey(new Date()) || leadStage==='opted-out'&&l.optedOut || !l.optedOut&&(l.stage||'new')===leadStage));
  return heading('BETTER CONVERSATIONS', 'Leads & outreach', 'Track conversations, plan follow-ups, and prepare individual introductions.') + leadPipeline() + `<section class="panel section-space"><form data-search="leads" class="lead-search inline-form"><label>Search prospects<input name="query" value="${esc(leadSearch)}" placeholder="Company, contact, or sector"></label><div class="filter-field"><label for="lead-stage-filter">Stage</label><select id="lead-stage-filter" name="stage">${Object.entries({all:'All prospects',due:'Follow-ups due',...stageLabels,'opted-out':'Do not contact'}).map(([value,label])=>`<option value="${value}" ${leadStage===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="filter-field"><label for="lead-owner-filter">Owner</label><select id="lead-owner-filter" name="owner">${Object.entries({all:'Everyone',mine:'Assigned to me',unassigned:'Unassigned'}).map(([value,label])=>`<option value="${value}" ${leadOwner===value?'selected':''}>${label}</option>`).join('')}</select></div><button class="button">Search</button>${button('Reset','reset-leads','','subtle')}</form></section>` + `<div class="two-columns"><section class="panel"><h2>Add a prospect</h2><form data-form="lead" class="stack"><label>Company<input name="company" required maxlength="100" placeholder="Brand or agency name"></label><div class="form-row"><label>Contact name<input name="name" maxlength="100" placeholder="Optional"></label><label>Sector<input name="sector" maxlength="100" placeholder="Retail, real estate…"></label></div><label>LinkedIn profile or page URL<input name="url" type="url" placeholder="https://www.linkedin.com/…"></label><label>Personalization note<textarea name="context" rows="2" maxlength="1000" placeholder="e.g. your new store opening in Gachibowli"></textarea></label><button class="button primary">＋ Add prospect</button></form></section><section class="panel"><div class="section-head"><h2>Your prospects</h2><span class="count">${visibleLeads.length} / ${state.leads.length}</span></div>${visibleLeads.length ? `<div class="leads-list">${visibleLeads.map(l => `<article><div class="lead-icon">${esc(l.company.slice(0,2).toUpperCase())}</div><div class="lead-info"><strong>${esc(l.company)}</strong><small>${esc([l.name,l.sector].filter(Boolean).join(' · ') || 'No contact details yet')}</small>${l.optedOut ? '<span class="badge rejected">Do not contact</span>' : `<span class="badge">${stageLabels[l.stage||'new']}</span>`}<small>Owner: ${esc((state.members||[]).find(m=>m.id===l.assigneeId)?.name || (l.assigneeId?'Former teammate':'Unassigned'))}</small>${l.lastContactAt?`<small>Last contact: ${date(l.lastContactAt)} IST</small>`:''}${l.followUp&&!l.optedOut?`<small class="follow-up">Follow-up: ${esc(l.followUp)}${l.followUp<=dayKey(new Date())?' · Due':''}</small>`:''}</div><div>${button('Details','lead-details',l.id)}${button('Activity','lead-activity',l.id)}</div>${!l.optedOut ? `<div>${button('Draft message', 'message', l.id)}${button('Opt out', 'optout', l.id, 'subtle')}</div>` : ''}</article>`).join('')}</div>` : empty(state.leads.length?'No matching prospects':'Start with a brand you know',state.leads.length?'Try another search or stage.':'Add a business or agency to draft your first introduction.')}</section></div><div class="notice"><span>ⓘ</span><p>Send outreach manually from an eligible LinkedIn account. Company-page messaging has limitations. Opted-out contacts cannot receive new drafts.</p></div><h2 class="section-space">Message drafts</h2>${cards(state.drafts.filter(d => d.type === 'message'))}`;
}
function comments() {
  return heading('ADD TO THE CONVERSATION', 'Comment studio', 'Prepare thoughtful replies to brand and competitor posts you choose.') + `<section class="panel"><form data-form="comment" class="stack"><div class="form-row"><label>Brand or competitor<input name="brand" required maxlength="100" placeholder="Company name"></label><label>LinkedIn post URL<input name="url" type="url" placeholder="https://www.linkedin.com/…"></label></div><label>Paste the post you want to respond to<textarea name="source" required rows="3" maxlength="3000" placeholder="Add the original post for review context…"></textarea></label><label>Your specific observation<textarea name="insight" required rows="2" maxlength="1000" placeholder="What did you find useful or interesting about this post?"></textarea></label><div><button class="button primary">Prepare comment draft ↗</button></div><p class="muted">Your observation becomes the reply. The original post is kept as context; it is not automatically analyzed.</p></form></section><h2 class="section-space">Comment drafts</h2>${cards(state.drafts.filter(d => d.type === 'comment'))}`;
}
function approvals() {
  const items = state.drafts.filter(d => (filter === 'all' || d.status === filter) && (approvalType==='all'||d.type===approvalType));
  return heading('YOUR FINAL SAY', 'Approval queue', 'Review, edit, and approve every piece of content before sharing.') + `<div class="tabs" aria-label="Filter content type">${Object.entries({all:'All types',post:'Posts',message:'Messages',comment:'Comments'}).map(([value,label])=>`<button data-action="approval-type" data-id="${value}" class="${approvalType===value?'active':''}">${label}</button>`).join('')}</div><div class="tabs" aria-label="Filter drafts">${['all','draft','approved','completed','rejected'].map(s => `<button data-action="filter" data-id="${s}" class="${filter === s ? 'active' : ''}">${s === 'all' ? 'All content' : s[0].toUpperCase()+s.slice(1)} <span>${state.drafts.filter(d => (s === 'all' || d.status === s) && (approvalType === 'all' || d.type === approvalType)).length}</span></button>`).join('')}</div>${cards(items)}`;
}
function settings() {
  const p = state.profile;
  return heading('THE DETAILS THAT MATTER', 'Brand settings', 'Keep your business information accurate and ready for your next campaign.') + `<section class="panel settings-panel"><form data-form="profile" class="stack"><div class="form-row"><label>Company name<input name="company" value="${esc(p.company)}" required maxlength="100"></label><label>Operating city<input name="city" value="${esc(p.city)}" required maxlength="100"></label></div><label>LinkedIn company page<input name="page" type="url" value="${esc(p.page)}" placeholder="https://www.linkedin.com/company/…"></label><label>Website<input name="website" type="url" value="${esc(p.website)}" maxlength="500"></label><div class="form-row"><label>Business email<input name="email" type="email" value="${esc(p.email)}" maxlength="200"></label><label>Business phone<input name="phone" value="${esc(p.phone)}" maxlength="100"></label></div><label>Contact or booking information<input name="contact" value="${esc(p.contact)}" maxlength="200" placeholder="Business email or booking URL, included in post drafts"></label><div class="form-row"><label>Number of tablets<input name="tablets" value="${esc(p.tablets)}" maxlength="100"></label><label>Verified cab details (optional)<input name="cabs" value="${esc(p.cabs)}" maxlength="200" placeholder="Tablet count does not imply cab count"></label></div><label>Advertising packages and pricing<textarea name="pricing" rows="3" maxlength="1000" placeholder="Keep your package details here for reference">${esc(p.pricing)}</textarea></label><label>Target advertisers<textarea name="audience" rows="2" maxlength="1000">${esc(p.audience)}</textarea></label><div class="form-row"><label>Days between posts<input name="cadenceDays" type="number" min="1" max="30" step="1" required value="${esc(p.cadenceDays)}"></label><div class="language-field"><label for="post-languages">Post languages</label><select id="post-languages" name="languages"><option value="both" ${p.languages === 'both' ? 'selected' : ''}>English + Telugu</option><option value="en" ${p.languages === 'en' ? 'selected' : ''}>English</option><option value="te" ${p.languages === 'te' ? 'selected' : ''}>Telugu</option></select></div></div><p class="muted">Each bilingual draft contains both languages. Campaign topics stay as entered; Telugu templates are not automatic translations of your topic. Cadence guides planning and does not enable automatic publishing.</p><p class="muted">Fleet and pricing are private reference notes. Add verified figures to drafts yourself when relevant.</p><div><button class="button primary">Save brand settings</button></div></form></section><div class="notice"><span>ⓘ</span><p><strong>LinkedIn: not connected.</strong> This version supports drafting, review, and manual sharing. Automatic publishing needs an approved LinkedIn application and company-page permissions. There is no automatic message or comment sending.</p></div><section class="panel section-space"><h2>Your workspace data</h2><p class="muted">Download a JSON backup of your settings, leads, drafts, and activity. Store it securely; it may contain contact information.</p>${button('Download workspace backup ↓', 'export')}</section>`;
}
function render() {
  unsavedInput = false;
  $('.connection').innerHTML = `<span class="signed-in-user">${esc(viewer?.name || '')}</span>${button('Refresh', 'refresh')}${button('Sign out', 'logout')}`;
  $('#navigation').innerHTML = Object.entries(names).map(([id,name]) => `<button data-action="navigate-${id}" class="${view === id ? 'active' : ''}" ${view === id ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icons[id]}</span>${name}${id === 'approvals' ? `<span class="nav-count" aria-hidden="true">${state.drafts.filter(d => d.status === 'draft').length}</span>` : ''}</button>`).join('');
  $('#page-name').textContent = names[view];
  $('#content').innerHTML = ({ overview, content, leads, comments, approvals, settings, team })[view]();
}
document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  const { action, id } = target.dataset;
  if (action === 'logout') { try { await accountApi('auth/logout',{}); showAuth(false); } catch(error) { toast(error.message,true); } return; }
  if (action === 'refresh') { try { await api('state'); toast('Latest team updates loaded.'); } catch(error) { toast(error.message,true); } return; }
  if (action === 'remove-member') { try { teamUsers = (await accountApi('team/remove',{id})).users; render(); toast('Team access removed.'); } catch(error) { toast(error.message,true); } return; }
  if (action === 'navigate-team' && viewer?.role === 'owner') { try { teamUsers = (await accountApi('team/list',{})).users; } catch(error) { toast(error.message,true); return; } }
  if (action.startsWith('navigate-')) { view = action.slice(9); render(); window.scrollTo(0,0); return; }
  if (action === 'filter') { filter = id; render(); return; }
  if(action==='compose') { $('#compose-form').reset(); $('#composer').showModal(); return; }
  if(action==='close-composer') { $('#composer').close(); return; }
  if(action==='close-lead') { $('#lead-editor').close(); return; }
  if(action==='approval-type') { approvalType=id; render(); return; }
  if(action==='reset-leads') { leadSearch=''; leadStage='all'; leadOwner='all'; render(); return; }
  if(action==='due-leads') { leadSearch=''; leadStage='due'; leadOwner='all'; view='leads'; render(); return; }
  if(action==='pipeline-stage') { leadStage=id; leadSearch=''; leadOwner='all'; render(); return; }
  if(action==='lead-activity') { openLeadActivity(id); return; }
  if(action==='close-activity') { $('#lead-activity').close(); return; }
  if(action==='lead-details') {
    const lead=state.leads.find(l=>l.id===id), f=$('#lead-form');
    for(const key of ['company','name','sector','context','url']) f.elements[key].value=lead[key]||'';
    f.elements.assigneeId.innerHTML='<option value="">Unassigned</option>'+(state.members||[]).map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
    f.elements.assigneeId.value=lead.assigneeId||'';
    f.elements.id.value=id; f.elements.stage.value=lead.stage||'new'; f.elements.notes.value=lead.notes||''; f.elements.followUp.value=lead.followUp||'';
    f.elements.followUp.disabled=lead.optedOut; $('#lead-editor h2').textContent=lead.company; $('#lead-editor').showModal(); return;
  }
  if(action.startsWith('calendar-')||action==='open-planned') {
    if(action==='calendar-prev'||action==='calendar-next') { const month=new Date(calendarMonth+'-01T00:00:00Z'); month.setUTCMonth(month.getUTCMonth()+(action==='calendar-next'?1:-1)); calendarMonth=month.toISOString().slice(0,7); selectedDay=''; }
    if(action==='calendar-today') { calendarMonth=dayKey(new Date()).slice(0,7); selectedDay=''; }
    if(action==='calendar-day'||action==='open-planned') { selectedDay=id; calendarMonth=id.slice(0,7); view='content'; }
    if(action==='calendar-clear') selectedDay='';
    render(); return;
  }
  const d = state.drafts.find(d => d.id === id);
  try {
    target.disabled = true;
    if (action === 'unschedule') { await api('drafts/unschedule',{id}); toast('Planned date removed.'); }
    else if (action === 'edit') { const f = $('#edit-form'); f.elements.id.value = id; f.elements.body.value = d.body; $('#editor').showModal(); }
    else if (action === 'close-editor') $('#editor').close();
    else if (action === 'copy') { await navigator.clipboard.writeText(d.body); toast('Text copied. Review it in LinkedIn before sharing.'); }
    else if (['approve','reject','reopen','complete'].includes(action)) { await api('drafts/update', { id, status: { approve:'approved', reject:'rejected', reopen:'draft', complete:'completed' }[action] }); toast(action === 'complete' ? 'Recorded as manually completed.' : 'Draft updated.'); }
    else if (action === 'message') { await api('generate', { type:'message', leadId:id }); toast('Personalized message draft created.'); }
    else if (action === 'optout') { await api('leads/opt-out', { id }); toast('Contact suppressed. Pending message drafts rejected.'); }
    else if (action === 'export') { const url = URL.createObjectURL(new Blob([JSON.stringify(state,null,2)], { type:'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'commuteads-workspace.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }
  } catch (error) { toast(error.message, true); } finally { target.disabled = false; }
});
document.addEventListener('submit', async event => {
  const form = event.target;
  if(form.dataset.search === 'leads') { event.preventDefault(); const values=Object.fromEntries(new FormData(form)); leadSearch=values.query.trim(); leadStage=values.stage; leadOwner=values.owner; render(); return; }
  if (!form.dataset.form && !form.matches('#edit-form')) return;
  event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const submit = form.querySelector('button[type="submit"],button:not([type])'); if (submit) submit.disabled = true;
  try {
    if (form.matches('#edit-form')) { await api('drafts/update',values); $('#editor').close(); }
    else if (form.dataset.form === 'compose') { selectedDay=''; await api('drafts/create',values); $('#composer').close(); }
    else if (form.dataset.form === 'lead-update') { await api('leads/update',values); $('#lead-editor').close(); }
    else if (form.dataset.form === 'lead-log') { await api('leads/log',values); openLeadActivity(values.id); }
    else if (form.dataset.form === 'note') await api('drafts/note',values);
    else if (form.dataset.form === 'posts') { selectedDay=''; await api('generate', { type:'post', ...values }); }
    else if (form.dataset.form === 'comment') await api('generate', { type:'comment', ...values });
    else if (form.dataset.form === 'schedule') {
      // Input is explicitly IST, independent of the browser's local timezone.
      await api('drafts/schedule', { id:values.id, at:values.at + ':00+05:30' });
    } else await api(form.dataset.form === 'lead' ? 'leads' : 'profile', values);
    toast(form.dataset.form === 'schedule' ? 'Date planned. Publishing is manual.' : 'Saved to your workspace.');
  } catch (error) { toast(error.message,true); } finally { if (submit) submit.disabled = false; }
});
names.team = 'Team & account';
icons.team = icons.leads;
let setupCode = new URLSearchParams(location.hash.slice(1)).get('setup') || '';
if (location.hash) history.replaceState(null,'',location.pathname);
async function accountApi(path, data) {
  const response = await fetch('/api/' + path, data === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Request failed.');
  return result;
}
function showAuth(setupRequired) {
  state = null; viewer = null; teamUsers = []; view = 'overview';
  $('#content').innerHTML = ''; $('#navigation').innerHTML = ''; $('#editor').close(); $('#composer').close(); $('#lead-editor').close(); $('#lead-activity').close();
  document.body.classList.add('signed-out');
  $('#auth-root').innerHTML = `<div class="auth-card"><div class="auth-brand">${$('.brand').innerHTML}</div><p class="eyebrow">PRIVATE TEAM WORKSPACE</p><h1>${setupRequired ? 'Make it your workspace.' : 'Welcome back.'}</h1><p class="subtitle">${setupRequired ? 'Create your owner account, then add your teammates.' : 'Sign in to your Commute Ads workspace.'}</p><form class="stack" data-auth="${setupRequired ? 'setup' : 'login'}">${setupRequired ? `<label>Setup code<input name="code" type="password" required autocomplete="off" value="${esc(setupCode)}"></label><p class="muted">The Windows launcher fills this in for you. For hosted setup, use SETUP_CODE from your hosting settings.</p><label>Your name<input name="name" required maxlength="100" autocomplete="name"></label>` : ''}<label>Email<input name="email" type="email" required autocomplete="username"></label><label>Password<input name="password" type="password" required minlength="12" maxlength="200" autocomplete="${setupRequired ? 'new-password' : 'current-password'}"></label><p class="form-error" role="alert"></p><button class="button primary">${setupRequired ? 'Create owner account' : 'Sign in'}</button></form><p class="muted">Access is limited to accounts created by your workspace owner.</p></div>`;
}
function team() {
  return heading('PRIVATE BY INVITATION', 'Team & account', 'Give your team access to one shared marketing workspace.') + `<div class="notice"><span>ⓘ</span><p>Everyone using this same app address shares its drafts, leads, and activity. Separate local installations do not sync. Updates refresh every 20 seconds while you are not editing. You can also use Refresh. Share account details privately.</p></div><div class="two-columns section-space"><section class="panel"><h2>Your account</h2><p class="muted">${esc(viewer.name)} · ${esc(viewer.email)} · ${esc(viewer.role)}</p><form class="stack" data-account="password"><label>Current password<input name="currentPassword" type="password" required autocomplete="current-password"></label><label>New password<input name="password" type="password" required minlength="12" maxlength="200" autocomplete="new-password"></label><button class="button primary">Change password</button></form></section>${viewer.role === 'owner' ? `<section class="panel"><h2>Add a teammate</h2><form class="stack" data-account="add"><label>Name<input name="name" required maxlength="100" autocomplete="off"></label><label>Email<input name="email" type="email" required autocomplete="off"></label><label>Initial password<input name="password" type="password" required minlength="12" maxlength="200" autocomplete="new-password"></label><p class="muted">Use at least 12 characters. Give the teammate their login details privately and ask them to change this password after signing in. No email is sent automatically.</p><button class="button primary">Create team account</button></form></section>` : ''}</div>${viewer.role === 'owner' ? `<section class="panel"><h2>Workspace access</h2><div class="leads-list">${teamUsers.map(u=>`<article><div class="lead-info"><strong>${esc(u.name)}</strong><small>${esc(u.email)} · ${esc(u.role)}</small></div>${u.role !== 'owner' ? button('Remove access','remove-member',u.id) : ''}</article>`).join('')}</div></section>` : ''}`;
}
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!form.dataset.auth && !form.dataset.account) return;
  event.preventDefault();
  const submit=form.querySelector('button'); submit.disabled=true;
  const values=Object.fromEntries(new FormData(form));
  try {
    if(form.dataset.auth) {
      const result=await accountApi('auth/'+form.dataset.auth,values);
      viewer=result.user; setupCode='';
      document.body.classList.remove('signed-out'); $('#auth-root').innerHTML='';
      await api('state');
    } else if(form.dataset.account === 'add') {
      teamUsers=(await accountApi('team/add',values)).users; render(); toast('Account created. Share the login details privately.');
    } else {
      await accountApi('auth/password',values); form.reset(); toast('Password changed. Other sessions have been signed out.');
    }
  } catch(error) {
    if(form.dataset.auth) form.querySelector('.form-error').textContent=error.message;
    else toast(error.message,true);
  } finally { submit.disabled=false; }
});
(async()=>{
  try {
    const status=await accountApi('auth/status');
    if(!status.user) return showAuth(status.setupRequired);
    viewer=status.user; document.body.classList.remove('signed-out'); await api('state');
  } catch(error) { $('#auth-root').textContent='Unable to load the workspace. Check the server and reload.'; toast(error.message,true); }
})();

document.addEventListener('input',()=>{ unsavedInput=true; });
setInterval(async()=>{
  if(!viewer || document.hidden || unsavedInput || document.querySelector('dialog[open]')) return;
  try {
    const response=await fetch('/api/state');
    if(!viewer) return;
    if(response.status===401) return showAuth(false);
    if(!response.ok) return;
    const latest=await response.json();
    if(viewer && !unsavedInput && !document.querySelector('dialog[open]') && latest.version !== state?.version) { state=latest; render(); }
  } catch { /* The next refresh retries temporary connection failures. */ }
},20000);
