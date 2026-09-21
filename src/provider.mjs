import { openAsBlob } from 'node:fs';
import { resolve } from 'node:path';
import { AppError, normalizeResult } from './domain.mjs';

export class UploadPostProvider {
  constructor(key, mediaDirectory, fetcher=fetch) { this.key=key; this.mediaDirectory=mediaDirectory; this.fetcher=fetcher; }
  get configured() { return Boolean(this.key); }
  async request(path, init={}) {
    if (!this.key) throw new AppError('Social publishing is not configured yet. Your draft is saved. Ask the owner to configure Upload-Post before connecting accounts.',503);
    const response=await this.fetcher(`https://api.upload-post.com${path}`,{...init,headers:{Authorization:`Apikey ${this.key}`,...init.headers},signal:AbortSignal.timeout(120000)});
    let data; try { data=await response.json(); } catch { throw new AppError('The publishing provider returned an unreadable response. Check status before retrying.',502); }
    if (!response.ok || data.success===false) { const error=new AppError(response.status===401?'Publishing credentials need attention.':`Publishing provider error (${response.status}). Check the provider dashboard.`,502); error.providerStatus=response.status; throw error; }
    return data;
  }
  async profiles() { const data=await this.request('/api/uploadposts/users'); return data.profiles||[]; }
  async connect(profile,origin) {
    const data=await this.request('/api/uploadposts/users/generate-jwt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:profile,redirect_url:`${origin}/#accounts`,show_calendar:false,connect_title:'Connect your Storage Social accounts'})});
    const u=new URL(data.access_url); if(u.protocol!=='https:' || u.hostname!=='app.upload-post.com') throw new AppError('Unexpected account connection address.',502);
    return u.href;
  }
  async options(profile,type) {
    const routes={pinterest:'/api/uploadposts/pinterest/boards',facebook:'/api/uploadposts/facebook/pages',google_business:'/api/uploadposts/google-business/locations',tiktok:'/api/uploadposts/tiktok/settings'};
    if (!routes[type]) throw new AppError('Unknown destination.');
    return this.request(`${routes[type]}?user=${encodeURIComponent(profile)}`);
  }
  async send(post,delivery,media) {
    const form=new FormData();
    form.set('user',delivery.profile); form.append('platform[]',delivery.platform);
    const caption=post.variants?.[delivery.platform]||post.caption;
    form.set('title',delivery.platform==='youtube'?post.options.youtube_title:caption);
    form.set('description',caption);
    form.set('request_id',delivery.request_id); form.set('external_id',post.id); form.set('async_upload','true');
    if (delivery.platform==='pinterest') {form.set('pinterest_title',post.title.slice(0,100));form.set('pinterest_description',caption);if(post.link)form.set('pinterest_link',post.link);}
    if (delivery.platform==='google_business' && post.link) {form.set('gbp_cta_type','LEARN_MORE');form.set('gbp_cta_url',post.link);}
    const allowed={facebook:['facebook_page_id'],pinterest:['pinterest_board_id'],google_business:['gbp_location_id'],youtube:['youtube_title'],tiktok:['privacy_level','brand_organic_toggle','brand_content_toggle','disable_comment','disable_duet','disable_stitch']};
    for(const key of allowed[delivery.platform]||[]) if(post.options[key]!==undefined && post.options[key]!=='') form.set(key,String(post.options[key]));
    if(delivery.platform==='youtube') {form.set('privacyStatus',post.options.youtube_privacy);form.set('selfDeclaredMadeForKids',String(post.options.made_for_kids));}
    if(delivery.platform==='tiktok') form.set('disable_inbox_fallback','true');
    if(delivery.platform==='instagram') form.set('media_type',post.kind==='video'?'REELS':'IMAGE');
    if(delivery.platform==='facebook' && post.kind==='video') form.set('facebook_media_type','VIDEO');
    for (const file of media) form.append(post.kind==='video'?'video':'photos[]',await openAsBlob(resolve(this.mediaDirectory,file.filename),{type:file.type}),file.name);
    return this.request(post.kind==='video'?'/api/upload':'/api/upload_photos',{method:'POST',headers:{'Idempotency-Key':delivery.request_id},body:form});
  }
  async status(delivery) {return normalizeResult(await this.request(`/api/uploadposts/status?request_id=${encodeURIComponent(delivery.request_id)}`),delivery.platform);}
}
